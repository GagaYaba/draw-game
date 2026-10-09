import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import type { DrawingDocument, PublicGameState } from "@drawing-game/shared";

import { GameManager } from "../src/game/game-manager.js";
import {
  buildLeaderboard,
  calculateDrawerPoints,
  calculateGuessPoints,
  getNextStep,
} from "../src/game/game-rules.js";
import type { PlayerAssignment } from "../src/game/game-types.js";
import { RoomManager, RoomManagerError } from "../src/rooms/room-manager.js";
import type { InternalPlayer } from "../src/rooms/room-types.js";

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

describe("règles du jeu", () => {
  // Risque : un score faux fausse le classement, seule information finale du jeu.
  it("calcule les points des votants et de l'auteur, et la suite après chaque révélation", () => {
    const guessPoints: [number, number][] = [
      [0, 2],
      [1, 1],
      [2, 0],
      [9, 0],
      [-1, 0],
      [Number.NaN, 0],
    ];
    for (const [distance, expected] of guessPoints) {
      assert.equal(calculateGuessPoints(distance), expected, `écart ${distance}`);
    }

    const authorPoints: [number[], number][] = [
      [[], 0],
      [[0], 2],
      [[2], 0],
      [[0, 2], 1],
      [[0, 1], 2],
      [[2, 3, 4], 0],
    ];
    for (const [distances, expected] of authorPoints) {
      assert.equal(calculateDrawerPoints(distances), expected, `écarts ${distances}`);
    }

    const order = ["a", "b", "c"];
    const step = (votingIndex: number, currentRound: number) =>
      getNextStep({ votingIndex, votingOrder: order, currentRound, totalRounds: 2 });
    assert.equal(step(0, 1), "NEXT_DRAWING");
    assert.equal(step(2, 1), "NEXT_ROUND");
    assert.equal(step(2, 2), "FINAL");

    // Égalité : les ex æquo partagent le rang, le suivant saute les places occupées.
    const player = (id: string, score: number) => ({ id, nickname: id, score }) as InternalPlayer;
    const ranking = buildLeaderboard(
      [player("a", 4), player("b", 9), player("c", 9), player("d", 1)],
      ["a", "b", "c", "d"],
    );
    assert.deepEqual(
      ranking.map((entry) => [entry.player.id, entry.rank]),
      [
        ["b", 1],
        ["c", 1],
        ["a", 3],
        ["d", 4],
      ],
    );
  });
});

function expectError(action: () => unknown, code: string) {
  assert.throws(
    action,
    (error: unknown) => error instanceof RoomManagerError && error.code === code,
  );
}

describe("partie à dessin simultané", () => {
  // Risque : le serveur est autoritaire ; une fuite de secret ou un enchaînement faux casse l'équité.
  // 3 joueurs : cas courant ; 6 joueurs : maximum, cinq votants par dessin.
  it("joue deux manches : dessins simultanés, votes un par un, scores et fin", () => {
    for (const playerCount of [3, 6]) {
      playTwoRounds(playerCount);
    }
  });
});

function playTwoRounds(playerCount: number) {
  {
    const timers: (() => void)[] = [];
    const rooms = new RoomManager();
    const games = new GameManager(rooms, {
      generateSecretLevel: () => SECRET_LEVEL,
      scheduleTimer: (callback) => timers.push(callback),
      clearTimer: () => undefined,
    });
    // Le seul votant exact rapporte 2 points ; l'auteur reçoit la moyenne arrondie.
    const authorPoints = Math.round(2 / (playerCount - 1));
    const sockets = Array.from({ length: playerCount }, (_, index) => `s${index}`);
    const code = rooms.createRoom("s0", "Joueur0", randomUUID()).session.roomCode;
    for (const socketId of sockets.slice(1)) {
      rooms.joinRoom(socketId, `Joueur${socketId.slice(1)}`, code, randomUUID());
    }
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
      const assignments = roundStart.assignments ?? [];
      assert.equal(assignments.length, playerCount);
      assert.equal(new Set(assignments.map((entry) => entry.secret.prompt.id)).size, playerCount);
      assert.ok(assignments.every((entry) => entry.secret.round === round));
      assert.equal(JSON.stringify(publicGame()).includes("secretLevel"), false);
      assert.equal(publicGame().currentDrawer, null);

      timers.shift()?.();
      assert.equal(publicGame().phase, "DRAWING");

      games.submitDrawing("s1", { drawing: DRAWING });
      expectError(
        () => games.submitDrawing("s1", { drawing: DRAWING }),
        "DRAWING_ALREADY_SUBMITTED",
      );
      for (const socketId of sockets.filter((id) => id !== "s1")) {
        assert.equal(publicGame().phase, "DRAWING");
        games.submitDrawing(socketId, { drawing: DRAWING });
      }
      assert.equal(publicGame().phase, "VOTING");

      const authors: string[] = [];
      for (let index = 0; index < playerCount; index += 1) {
        const game = publicGame();
        assert.ok(game.currentDrawer);
        const authorId = game.currentDrawer.id;
        authors.push(authorId);
        expectError(
          () => games.submitGuess(socketOf(authorId), { turnId: game.turnId, value: 5 }),
          "DRAWER_CANNOT_GUESS",
        );

        // Premier votant : exact (2 points) ; les autres : écart de 2 (0 point).
        const voters = sockets.filter((socketId) => socketId !== socketOf(authorId));
        games.submitGuess(voters[0] as string, { turnId: game.turnId, value: SECRET_LEVEL });
        for (const voter of voters.slice(1)) {
          games.submitGuess(voter, { turnId: game.turnId, value: SECRET_LEVEL + 2 });
        }

        const revealed = publicGame();
        assert.equal(revealed.phase, "REVEAL");
        assert.equal(revealed.reveal?.secretLevel, SECRET_LEVEL);
        assert.equal(revealed.reveal?.drawerResult.pointsEarned, authorPoints);
        const expectedStep =
          index < playerCount - 1 ? "NEXT_DRAWING" : round === 1 ? "NEXT_ROUND" : "FINAL";
        assert.equal(revealed.reveal?.nextStep, expectedStep);

        if (index < playerCount - 1) {
          games.continueGame("s0");
        }
      }

      assert.equal(new Set(authors).size, playerCount, "chaque dessin est présenté une fois");
    };

    playRound(1, games.startGame("s0"));
    const secondRound = games.continueGame("s0");
    assert.equal(publicGame().currentRound, 2);
    playRound(2, secondRound);

    games.continueGame("s0");
    assert.equal(publicGame().phase, "FINISHED");

    // Chaque dessin rapporte 2 points aux votants (un exact, les autres à 0) et ceux de l'auteur.
    const scores = rooms.getPublicRoomState(code).players.map((player) => player.score);
    assert.equal(
      scores.reduce((total, score) => total + score, 0),
      2 * playerCount * (2 + authorPoints),
    );
  }
}
