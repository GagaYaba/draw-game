import type { PublicFinishedState, PublicGameState, PublicRevealState } from "@drawing-game/shared";

import { RoomManagerError, type InternalPlayer } from "../rooms/room-types.js";
import { cloneDrawingDocument } from "./drawing-validation.js";
import {
  buildLeaderboard,
  getEligibleVoterIds,
  getNextStep,
  getSubmittedGuessCount,
  requireCurrentTurn,
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
  const turn = requireCurrentTurn(game);
  const scoreResult = turn.scoreResult;
  if (turn.scoresAppliedAt === null || scoreResult === null) {
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
      const guess = turn.guesses[player.id];
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

  const author = players.find((player) => player.id === turn.drawerPlayerId);
  if (author === undefined || scoreResult.drawer.playerId !== author.id) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le résultat de l'auteur est introuvable.");
  }

  return {
    secretLevel: turn.secretLevel,
    guesses,
    drawerResult: {
      player: {
        id: author.id,
        nickname: author.nickname,
      },
      averageDistance: scoreResult.drawer.averageDistance,
      pointsEarned: scoreResult.drawer.pointsEarned,
      totalScore: scoreResult.drawer.totalScore,
    },
    leaderboard: buildLeaderboard(players, game.turnOrder),
    nextStep: getNextStep(game),
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
  const turn = game.currentTurn;
  const isShowingDrawing = game.phase === "VOTING" || game.phase === "REVEAL";

  if (isShowingDrawing && (turn === null || turn.drawing === null)) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le dessin soumis est introuvable.");
  }

  if (
    isShowingDrawing &&
    turn !== null &&
    (turn.drawingSubmittedAt === null || !Number.isFinite(turn.drawingSubmittedAt))
  ) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le dessin soumis est introuvable.");
  }

  const activeAuthor =
    turn === null ? undefined : players.find((player) => player.id === turn.drawerPlayerId);
  const historicalAuthor =
    game.phase === "FINISHED" && turn !== null
      ? game.finishedState?.leaderboard.find((entry) => entry.player.id === turn.drawerPlayerId)
          ?.player
      : undefined;
  const author = activeAuthor ?? historicalAuthor;
  const showsAuthor = turn !== null && game.phase !== "ROUND_INTRO" && game.phase !== "DRAWING";

  if (showsAuthor && author === undefined) {
    throw new RoomManagerError("INTERNAL_ERROR", "L'auteur du dessin est introuvable.");
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
    turnId: showsAuthor && turn !== null ? turn.turnId : game.roundId,
    totalRounds: game.totalRounds,
    currentRound: game.currentRound,
    currentTurnNumber: (game.currentRound - 1) * game.turnOrder.length + game.votingIndex + 1,
    totalTurns: game.turnOrder.length * game.totalRounds,
    currentDrawer:
      showsAuthor && author !== undefined ? { id: author.id, nickname: author.nickname } : null,
    prompt:
      showsAuthor && turn !== null
        ? {
            id: turn.prompt.id,
            statement: turn.prompt.statement,
            lowLabel: turn.prompt.lowLabel,
            highLabel: turn.prompt.highLabel,
          }
        : null,
    phaseEndsAt: game.phaseEndsAt,
    drawing:
      game.phase === "DRAWING"
        ? {
            submittedPlayerIds: game.turnOrder.filter(
              (playerId) => game.entries[playerId]?.drawingSubmittedAt != null,
            ),
          }
        : null,
    submittedDrawing:
      isShowingDrawing && turn !== null && turn.drawing !== null && turn.drawingSubmittedAt !== null
        ? {
            document: cloneDrawingDocument(turn.drawing),
            submittedAt: turn.drawingSubmittedAt,
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
