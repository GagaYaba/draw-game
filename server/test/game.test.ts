import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import type { DrawingDocument, PublicGameState } from "@drawing-game/shared";

import { GameManager } from "../src/game/game-manager.js";
import type { PlayerAssignment } from "../src/game/game-types.js";
import {
  calculateDrawerPoints,
  calculateGuessPoints,
  getNextStep,
} from "../src/game/game-rules.js";
import { RoomManager, RoomManagerError } from "../src/rooms/room-manager.js";

const DRAWING: DrawingDocument = {
  version: 2,
  aspectRatio: "4:3",
  backgroundColor: "#FFFFFF",
  strokes: [
    {
      tool: "pen",
      color: "#111111",
      width: 4,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
      ],
    },
  ],
};

const SECRET_LEVEL = 5;

describe("barème", () => {
  const guessCases: [number, number][] = [
    [0, 2],
    [1, 1],
    [2, 0],
    [9, 0],
    [-1, 0],
    [Number.NaN, 0],
  ];

  for (const [distance, expected] of guessCases) {
    it(`un écart de ${distance} rapporte ${expected} point(s) au votant`, () => {
      assert.equal(calculateGuessPoints(distance), expected);
    });
  }

  const authorCases: [number[], number][] = [
    [[], 0],
    [[0], 2],
    [[1], 1],
    [[2], 0],
    [[0, 2], 1],
    [[0, 1], 2],
    [[0, 2, 2], 1],
    [[2, 3, 4], 0],
  ];

  for (const [distances, expected] of authorCases) {
    it(`des écarts ${JSON.stringify(distances)} rapportent ${expected} point(s) à l'auteur`, () => {
      assert.equal(calculateDrawerPoints(distances), expected);
    });
  }
});

describe("suite après une révélation", () => {
  const cases: [number, number, number, string][] = [
    [0, 3, 1, "NEXT_DRAWING"],
    [2, 3, 1, "NEXT_ROUND"],
    [2, 3, 2, "FINAL"],
  ];

  for (const [votingIndex, playerCount, currentRound, expected] of cases) {
    it(`dessin ${votingIndex + 1}/${playerCount} de la manche ${currentRound} : ${expected}`, () => {
      assert.equal(
        getNextStep({
          votingIndex,
          votingOrder: Array.from({ length: playerCount }, (_, index) => `p${index}`),
          currentRound,
          totalRounds: 2,
        }),
        expected,
      );
    });
  }
});

function expectError(action: () => unknown, code: string) {
  assert.throws(
    action,
    (error: unknown) => error instanceof RoomManagerError && error.code === code,
  );
}

describe("partie à dessin simultané", () => {
  it("joue deux manches : dessins simultanés, votes un par un, scores et fin", () => {
    const timers: (() => void)[] = [];
    const rooms = new RoomManager();
    const games = new GameManager(rooms, {
      generateSecretLevel: () => SECRET_LEVEL,
      scheduleTimer: (callback) => timers.push(callback),
      clearTimer: () => undefined,
    });
    const sockets = ["s0", "s1", "s2"];
    const code = rooms.createRoom("s0", "Alice", randomUUID()).session.roomCode;
    rooms.joinRoom("s1", "Bob", code, randomUUID());
    rooms.joinRoom("s2", "Chloe", code, randomUUID());
    for (const socketId of sockets) {
      rooms.setPlayerReady(socketId, true);
    }

    const room = rooms.getRoomByCode(code);
    assert.ok(room);
    const socketOf = (playerId: string) =>
      room.players.find((player) => player.id === playerId)?.socketId ?? "";
    const publicGame = (): PublicGameState => {
      const game = rooms.getPublicRoomState(code).game;
      assert.ok(game);
      return game;
    };

    const playRound = (round: number, roundStart: { assignments?: PlayerAssignment[] }) => {
      // Une consigne et un niveau propres à chaque joueur, sans fuite dans l'état public.
      const assignments = roundStart.assignments ?? [];
      assert.equal(assignments.length, 3);
      assert.equal(new Set(assignments.map((entry) => entry.secret.prompt.id)).size, 3);
      assert.ok(assignments.every((entry) => entry.secret.round === round));
      assert.equal(JSON.stringify(publicGame()).includes("secretLevel"), false);
      assert.equal(publicGame().currentDrawer, null);

      timers.shift()?.();
      assert.equal(publicGame().phase, "DRAWING");

      // Tous dessinent : le vote ne démarre qu'après la dernière validation.
      games.submitDrawing("s1", { drawing: DRAWING });
      expectError(
        () => games.submitDrawing("s1", { drawing: DRAWING }),
        "DRAWING_ALREADY_SUBMITTED",
      );
      games.submitDrawing("s2", { drawing: DRAWING });
      assert.equal(publicGame().phase, "DRAWING");
      assert.equal(publicGame().drawing?.submittedPlayerIds.length, 2);
      games.submitDrawing("s0", { drawing: DRAWING });
      assert.equal(publicGame().phase, "VOTING");

      const authors: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        const game = publicGame();
        assert.equal(game.phase, "VOTING");
        assert.ok(game.currentDrawer);
        const authorId = game.currentDrawer.id;
        authors.push(authorId);

        expectError(
          () => games.submitGuess(socketOf(authorId), { turnId: game.turnId, value: 5 }),
          "DRAWER_CANNOT_GUESS",
        );

        // Premier votant : exact (2 points) ; second votant : écart de 2 (0 point).
        const voters = sockets.filter((socketId) => socketId !== socketOf(authorId));
        games.submitGuess(voters[0] as string, { turnId: game.turnId, value: SECRET_LEVEL });
        assert.equal(publicGame().phase, "VOTING");
        games.submitGuess(voters[1] as string, { turnId: game.turnId, value: SECRET_LEVEL + 2 });

        const revealed = publicGame();
        assert.equal(revealed.phase, "REVEAL");
        assert.equal(revealed.reveal?.secretLevel, SECRET_LEVEL);
        assert.equal(
          revealed.reveal?.guesses
            .map((guess) => guess.pointsEarned)
            .sort()
            .join(),
          "0,2",
        );
        assert.equal(revealed.reveal?.drawerResult.pointsEarned, 1);

        expectError(() => games.continueGame("s1"), "NOT_HOST");
        const expectedStep = index < 2 ? "NEXT_DRAWING" : round === 1 ? "NEXT_ROUND" : "FINAL";
        assert.equal(revealed.reveal?.nextStep, expectedStep);

        if (index < 2) {
          games.continueGame("s0");
        }
      }

      assert.equal(new Set(authors).size, 3, "chaque dessin est présenté une fois");
    };

    playRound(1, games.startGame("s0"));
    assert.equal(publicGame().currentTurnNumber, 3);

    const secondRound = games.continueGame("s0");
    assert.equal(publicGame().currentRound, 2);
    assert.equal(publicGame().phase, "ROUND_INTRO");
    playRound(2, secondRound);

    games.continueGame("s0");
    assert.equal(publicGame().phase, "FINISHED");
    expectError(() => games.continueGame("s0"), "GAME_ALREADY_FINISHED");
    assert.equal(publicGame().finished?.completedRounds, 2);

    // Six dessins, chacun rapportant 2 points (estimation exacte), 0 point (écart de 2)
    // et 1 point à l'auteur (moyenne arrondie) : 18 points en tout.
    const scores = rooms.getPublicRoomState(code).players.map((player) => player.score);
    assert.equal(
      scores.reduce((total, score) => total + score, 0),
      18,
    );
  });
});
