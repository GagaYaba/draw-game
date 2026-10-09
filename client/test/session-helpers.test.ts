import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicRoomState, TurnSecretPayload } from "@drawing-game/shared";

import {
  buildCreateRoomPayload,
  buildJoinRoomPayload,
  buildRestoreSessionPayload,
  createSubmitGuessPayload,
  didPublicGameChange,
  didPublicTurnChange,
  getPublicGameActionContext,
  getSessionRestoreRetryDelay,
  isAutomaticSessionRestoreRetryable,
  isGameActionContextCurrent,
  isPermanentSessionRestoreError,
  isTurnSecretForActiveDrawer,
  SESSION_RESTORE_RETRY_DELAYS_MS,
  shouldFailManualRestoreOnConnectError,
} from "../src/hooks/useRoomSession";

const ROOM = {
  code: "ABCDE",
  game: { gameId: "g1", turnId: "t1", phase: "VOTING" },
} as unknown as PublicRoomState;

const SECRET: TurnSecretPayload = {
  roomCode: "ABCDE",
  gameId: "g1",
  turnId: "t1",
  round: 1,
  drawerPlayerId: "p1",
  secretLevel: 4,
  prompt: { id: "x", statement: "x", lowLabel: "bas", highLabel: "haut" },
};
const CONTEXT = { roomCode: "ABCDE", gameId: "g1", turnId: "t1", playerId: "p1" };

describe("contexte des actions", () => {
  it("décrit la partie en cours et détecte un contexte périmé", () => {
    const context = getPublicGameActionContext(ROOM);

    assert.deepEqual(context, { roomCode: "ABCDE", gameId: "g1", turnId: "t1", phase: "VOTING" });
    assert.equal(getPublicGameActionContext(null), null);
    assert.equal(
      getPublicGameActionContext({ code: "ABCDE", game: null } as PublicRoomState),
      null,
    );

    assert.ok(context);
    assert.equal(isGameActionContextCurrent(context, context), true);
    assert.equal(isGameActionContextCurrent(context, null), false);
    for (const change of [
      { roomCode: "ZZZZZ" },
      { gameId: "g2" },
      { turnId: "t2" },
      { phase: "REVEAL" as const },
    ]) {
      assert.equal(isGameActionContextCurrent(context, { ...context, ...change }), false);
    }
    assert.equal(didPublicGameChange("g1", "g2"), true);
    assert.equal(didPublicGameChange("g1", "g1"), false);
    assert.equal(didPublicTurnChange(null, "t1"), true);
    assert.equal(didPublicTurnChange("t1", "t1"), false);
  });
});

describe("secret de manche", () => {
  const cases: [string, Partial<TurnSecretPayload>, Partial<typeof CONTEXT>, boolean][] = [
    ["conforme", {}, {}, true],
    ["autre salon", { roomCode: "ZZZZZ" }, {}, false],
    ["autre partie", { gameId: "g2" }, {}, false],
    ["autre manche", { turnId: "t2" }, {}, false],
    ["autre joueur", { drawerPlayerId: "p2" }, {}, false],
    ["niveau décimal", { secretLevel: 4.5 }, {}, false],
    ["niveau hors bornes", { secretLevel: 11 }, {}, false],
  ];

  for (const [label, payload, context, expected] of cases) {
    it(`accepte seulement un secret destiné à ce joueur : ${label}`, () => {
      assert.equal(
        isTurnSecretForActiveDrawer({ ...SECRET, ...payload }, { ...CONTEXT, ...context }),
        expected,
      );
    });
  }

  it("refuse tout secret tant que le contexte du client n'est pas connu", () => {
    assert.equal(isTurnSecretForActiveDrawer(SECRET, { ...CONTEXT, playerId: null }), false);
    assert.equal(isTurnSecretForActiveDrawer(SECRET, { ...CONTEXT, roomCode: null }), false);
    assert.equal(isTurnSecretForActiveDrawer(SECRET, { ...CONTEXT, gameId: null }), false);
    assert.equal(isTurnSecretForActiveDrawer(SECRET, { ...CONTEXT, turnId: null }), false);
  });
});

describe("charges utiles et restauration", () => {
  it("construit les charges utiles envoyées au serveur", () => {
    assert.deepEqual(createSubmitGuessPayload("t1", 5), { turnId: "t1", value: 5 });
    assert.deepEqual(buildCreateRoomPayload("Alice", "id"), {
      nickname: "Alice",
      clientInstanceId: "id",
    });
    assert.deepEqual(buildJoinRoomPayload("Alice", "ABCDE", "id"), {
      nickname: "Alice",
      roomCode: "ABCDE",
      clientInstanceId: "id",
    });
    assert.deepEqual(
      buildRestoreSessionPayload({ roomCode: "ABCDE", playerId: "p", token: "t" }, "id"),
      { roomCode: "ABCDE", playerId: "p", token: "t", clientInstanceId: "id" },
    );
  });

  it("décide des tentatives de restauration et de leurs délais", () => {
    assert.equal(isAutomaticSessionRestoreRetryable("INTERNAL_ERROR"), true);
    assert.equal(isAutomaticSessionRestoreRetryable("INVALID_SESSION"), false);
    for (const code of [
      "INVALID_SESSION",
      "SESSION_EXPIRED",
      "ROOM_NOT_FOUND",
      "PLAYER_NOT_FOUND",
    ]) {
      assert.equal(isPermanentSessionRestoreError(code), true);
    }
    assert.equal(isPermanentSessionRestoreError("SESSION_ALREADY_ACTIVE"), false);
    assert.equal(shouldFailManualRestoreOnConnectError(true, false), true);
    assert.equal(shouldFailManualRestoreOnConnectError(true, true), false);
    assert.equal(shouldFailManualRestoreOnConnectError(false, false), false);

    SESSION_RESTORE_RETRY_DELAYS_MS.forEach((delay, index) => {
      assert.equal(getSessionRestoreRetryDelay(index), delay);
    });
    assert.equal(getSessionRestoreRetryDelay(SESSION_RESTORE_RETRY_DELAYS_MS.length), null);
    assert.equal(getSessionRestoreRetryDelay(-1), null);
    assert.equal(getSessionRestoreRetryDelay(0.5), null);
  });
});
