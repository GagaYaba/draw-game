import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { RoomManager, RoomManagerError } from "../src/rooms/room-manager.js";
import { IDLE_ROOM_TTL_MS } from "../src/security/limits.js";

function clientId(): string {
  return randomUUID();
}

describe("bornes de joueurs", () => {
  it("accepte de 2 à 6 joueurs et refuse le septième", () => {
    const manager = new RoomManager();
    const host = manager.createRoom("socket-0", "Alice", clientId());
    const code = host.session.roomCode;

    for (let index = 1; index < 6; index += 1) {
      manager.joinRoom(`socket-${index}`, `Joueur${index}`, code, clientId());
    }

    assert.throws(
      () => manager.joinRoom("socket-6", "Septieme", code, clientId()),
      (error: unknown) => error instanceof RoomManagerError && error.code === "ROOM_FULL",
    );
  });

  it("n'autorise le lancement qu'à partir de deux joueurs prêts", () => {
    const manager = new RoomManager();
    const host = manager.createRoom("socket-0", "Alice", clientId());
    const code = host.session.roomCode;

    manager.setPlayerReady("socket-0", true);
    assert.equal(manager.getPublicRoomState(code).canStart, false);

    manager.joinRoom("socket-1", "Bob", code, clientId());
    manager.setPlayerReady("socket-1", true);
    assert.equal(manager.getPublicRoomState(code).canStart, true);
  });
});

describe("fermeture des salons inactifs", () => {
  it("ferme un salon sans activité pendant 24 heures, mais pas un salon actif", () => {
    let now = 0;
    const manager = new RoomManager({ clock: () => now });
    const idle = manager.createRoom("socket-idle", "Alice", clientId());
    const active = manager.createRoom("socket-active", "Bob", clientId());

    now += IDLE_ROOM_TTL_MS - 1;
    manager.touchRoomBySocketId("socket-active");
    now += 2;

    const closed = manager.closeIdleRooms(IDLE_ROOM_TTL_MS);
    assert.deepEqual(
      closed.map((room) => room.roomCode),
      [idle.session.roomCode],
    );
    assert.deepEqual(closed[0]?.socketIds, ["socket-idle"]);
    assert.equal(manager.getRoomByCode(active.session.roomCode) !== undefined, true);
  });
});
