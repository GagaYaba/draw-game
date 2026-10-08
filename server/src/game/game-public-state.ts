import type { PublicFinishedState, PublicGameState, PublicRevealState } from "@drawing-game/shared";

import { RoomManagerError, type InternalPlayer } from "../rooms/room-types.js";
import { cloneDrawingDocument } from "./drawing-validation.js";
import {
  buildLeaderboard,
  getEligibleVoterIds,
  getNextTurnPosition,
  getSubmittedGuessCount,
} from "./game-rules.js";
import type { InternalGame } from "./game-types.js";

function clonePublicFinishedState(finishedState: PublicFinishedState): PublicFinishedState {
  return {
    leaderboard: finishedState.leaderboard.map((entry) => ({
      rank: entry.rank,
      player: { ...entry.player },
      score: entry.score,
    })),
    winners: finishedState.winners.map((winner) => ({ ...winner })),
    completedRounds: finishedState.completedRounds,
    completedTurns: finishedState.completedTurns,
  };
}

export function createPublicRevealState(
  game: InternalGame,
  players: readonly InternalPlayer[],
): PublicRevealState {
  const scoreResult = game.currentTurn.scoreResult;
  if (game.currentTurn.scoresAppliedAt === null || scoreResult === null) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "Les scores du tour doivent être calculés avant la révélation.",
    );
  }

  const eligibleVoterIds = getEligibleVoterIds(game, players);
  const eligibleVoterIdSet = new Set(eligibleVoterIds);

  const guesses = players
    .filter((player) => eligibleVoterIdSet.has(player.id))
    .map((player) => {
      const guess = game.currentTurn.guesses[player.id];
      const result = scoreResult.guesses[player.id];

      if (
        guess === undefined ||
        guess.playerId !== player.id ||
        !Number.isFinite(guess.submittedAt) ||
        result === undefined ||
        result.playerId !== player.id
      ) {
        throw new RoomManagerError("INTERNAL_ERROR", "Une estimation attendue est introuvable.");
      }

      return {
        player: {
          id: player.id,
          nickname: player.nickname,
        },
        value: guess.value,
        distance: result.distance,
        pointsEarned: result.pointsEarned,
        totalScore: result.totalScore,
      };
    });

  if (guesses.length !== eligibleVoterIds.length) {
    throw new RoomManagerError("INTERNAL_ERROR", "Impossible de publier toutes les estimations.");
  }

  const drawer = players.find((player) => player.id === game.currentTurn.drawerPlayerId);
  if (drawer === undefined || scoreResult.drawer.playerId !== drawer.id) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le résultat du dessinateur est introuvable.");
  }

  const nextPosition = getNextTurnPosition(game);
  const nextDrawerId =
    nextPosition === null ? null : game.turnOrder[nextPosition.currentDrawerIndex];
  const nextDrawer =
    nextDrawerId === null || nextDrawerId === undefined
      ? null
      : players.find((player) => player.id === nextDrawerId);

  if (nextDrawerId !== null && nextDrawer === undefined) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le prochain dessinateur est introuvable.");
  }

  return {
    secretLevel: game.currentTurn.secretLevel,
    guesses,
    drawerResult: {
      player: {
        id: drawer.id,
        nickname: drawer.nickname,
      },
      closeGuessCount: scoreResult.drawer.closeGuessCount,
      pointsEarned: scoreResult.drawer.pointsEarned,
      totalScore: scoreResult.drawer.totalScore,
    },
    leaderboard: buildLeaderboard(players, game.turnOrder),
    nextDrawer:
      nextDrawer === null || nextDrawer === undefined
        ? null
        : {
            id: nextDrawer.id,
            nickname: nextDrawer.nickname,
          },
  };
}

export function createPublicFinishedState(
  game: InternalGame,
  players: readonly InternalPlayer[],
): PublicFinishedState {
  const leaderboard = buildLeaderboard(players, game.turnOrder);
  const winningScore = leaderboard[0]?.score;

  if (winningScore === undefined) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le classement final ne contient aucun joueur.");
  }

  return {
    leaderboard,
    winners: leaderboard
      .filter((entry) => entry.score === winningScore)
      .map((entry) => ({
        id: entry.player.id,
        nickname: entry.player.nickname,
        score: entry.score,
      })),
    completedRounds: game.totalRounds,
    completedTurns: game.turnOrder.length * game.totalRounds,
  };
}

export function toPublicGameState(
  game: InternalGame,
  players: readonly InternalPlayer[],
): PublicGameState {
  const activeDrawer = players.find((player) => player.id === game.currentTurn.drawerPlayerId);
  const historicalDrawer =
    game.phase === "FINISHED"
      ? game.finishedState?.leaderboard.find(
          (entry) => entry.player.id === game.currentTurn.drawerPlayerId,
        )?.player
      : undefined;
  const drawer = activeDrawer ?? historicalDrawer;

  if (drawer === undefined) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le dessinateur du tour est introuvable.");
  }

  const { drawing, drawingSubmittedAt } = game.currentTurn;
  const submittedDrawingIsPublic = game.phase === "VOTING" || game.phase === "REVEAL";
  if (
    submittedDrawingIsPublic &&
    (drawing === null || drawingSubmittedAt === null || !Number.isFinite(drawingSubmittedAt))
  ) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le dessin soumis est introuvable.");
  }

  const eligibleVoterIds = getEligibleVoterIds(game, players);
  if (
    (game.phase === "FINISHED" && game.finishedState === null) ||
    (game.phase !== "FINISHED" && game.finishedState !== null)
  ) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "L’état final interne de la partie est incohérent.",
    );
  }

  return {
    gameId: game.gameId,
    phase: game.phase,
    turnId: game.currentTurn.turnId,
    totalRounds: game.totalRounds,
    currentRound: game.currentRound,
    currentTurnNumber:
      (game.currentRound - 1) * game.turnOrder.length + game.currentDrawerIndex + 1,
    totalTurns: game.turnOrder.length * game.totalRounds,
    currentDrawer: { id: drawer.id, nickname: drawer.nickname },
    prompt: {
      id: game.currentTurn.prompt.id,
      statement: game.currentTurn.prompt.statement,
      lowLabel: game.currentTurn.prompt.lowLabel,
      highLabel: game.currentTurn.prompt.highLabel,
    },
    phaseEndsAt: game.phaseEndsAt,
    submittedDrawing:
      submittedDrawingIsPublic && drawing !== null && drawingSubmittedAt !== null
        ? {
            document: cloneDrawingDocument(drawing),
            submittedAt: drawingSubmittedAt,
          }
        : null,
    voting:
      game.phase === "VOTING"
        ? {
            eligibleVoterCount: eligibleVoterIds.length,
            submittedGuessCount: getSubmittedGuessCount(game, eligibleVoterIds),
          }
        : null,
    reveal: game.phase === "REVEAL" ? createPublicRevealState(game, players) : null,
    finished:
      game.phase === "FINISHED"
        ? clonePublicFinishedState(game.finishedState as PublicFinishedState)
        : null,
  };
}
