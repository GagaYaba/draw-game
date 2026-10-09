import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { RoomManager, RoomManagerError } from "../src/rooms/room-manager.js";
import { IDLE_ROOM_TTL_MS } from "../src/security/limits.js";

describe("salons", () => {
  // Risque : les bornes de joueurs sont une règle du jeu décidée par le porteur du projet.
  it("accepte de 2 à 6 joueurs, refuse le septième et n'autorise le lancement qu'à deux prêts", () => {
    const manager = new RoomManager();
    const code = manager.createRoom("socket-0", "Alice", randomUUID()).session.roomCode;

    manager.setPlayerReady("socket-0", true);
    assert.equal(manager.getPublicRoomState(code).canStart, false, "un seul joueur");
    manager.joinRoom("socket-1", "Joueur1", code, randomUUID());
    manager.setPlayerReady("socket-1", true);
    assert.equal(manager.getPublicRoomState(code).canStart, true, "deux joueurs prêts");

    for (let index = 2; index < 6; index += 1) {
      manager.joinRoom(`socket-${index}`, `Joueur${index}`, code, randomUUID());
    }
    assert.throws(
      () => manager.joinRoom("socket-6", "Septieme", code, randomUUID()),
      (error: unknown) => error instanceof RoomManagerError && error.code === "ROOM_FULL",
    );
  });

  // Risque : des salons abandonnés saturent la mémoire d'une instance unique.
  it("ferme un salon sans activité pendant 24 heures, mais pas un salon actif", () => {
    let now = 0;
    const manager = new RoomManager({ clock: () => now });
    const idle = manager.createRoom("socket-idle", "Alice", randomUUID());
    const active = manager.createRoom("socket-active", "Bob", randomUUID());

    now += IDLE_ROOM_TTL_MS - 1;
    manager.touchRoomBySocketId("socket-active");
    now += 2;

    const closed = manager.closeIdleRooms(IDLE_ROOM_TTL_MS);
    assert.deepEqual(
      closed.map((room) => room.roomCode),
      [idle.session.roomCode],
    );
    assert.equal(manager.getRoomByCode(active.session.roomCode) !== undefined, true);
  });
});
