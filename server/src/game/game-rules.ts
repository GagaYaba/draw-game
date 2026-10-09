import type { PublicLeaderboardEntry, RevealNextStep } from "@drawing-game/shared";

import { RoomManagerError, type InternalPlayer } from "../rooms/room-types.js";
import type { InternalGame, InternalTurn, InternalTurnScoreResult } from "./game-types.js";

function validatePlayerScore(player: InternalPlayer): void {
  if (!Number.isSafeInteger(player.score) || player.score < 0) {
    throw new RoomManagerError("INTERNAL_ERROR", "Un score de joueur interne est invalide.");
  }
}

export function cloneTurnScoreResult(result: InternalTurnScoreResult): InternalTurnScoreResult {
  return {
    guesses: Object.fromEntries(
      Object.entries(result.guesses).map(([playerId, guess]) => [playerId, { ...guess }]),
    ),
    drawer: { ...result.drawer },
  };
}

/** Estimation exacte : 2 points ; écart de 1 : 1 point ; au-delà : 0. */
export function calculateGuessPoints(distance: number): number {
  if (!Number.isFinite(distance) || !Number.isInteger(distance) || distance < 0) {
    return 0;
  }

  if (distance === 0) {
    return 2;
  }

  return distance === 1 ? 1 : 0;
}

/** L'auteur gagne la moyenne arrondie des points de ses votants (0 à 2). */
export function calculateDrawerPoints(distances: readonly number[]): number {
  if (distances.length === 0) {
    return 0;
  }

  const totalPoints = distances.reduce(
    (total, distance) => total + calculateGuessPoints(distance),
    0,
  );

  return Math.round(totalPoints / distances.length);
}

export function requireCurrentTurn(game: Pick<InternalGame, "currentTurn">): InternalTurn {
  if (game.currentTurn === null) {
    throw new RoomManagerError("INTERNAL_ERROR", "Aucun dessin n'est en cours de vote.");
  }

  return game.currentTurn;
}

type NextStepSource = Pick<
  InternalGame,
  "currentRound" | "totalRounds" | "votingIndex" | "votingOrder"
>;

/** Détermine ce qui suit la révélation du dessin en cours. */
export function getNextStep(game: NextStepSource): RevealNextStep {
  if (
    game.votingOrder.length < 1 ||
    !Number.isSafeInteger(game.votingIndex) ||
    game.votingIndex < 0 ||
    game.votingIndex >= game.votingOrder.length ||
    !Number.isSafeInteger(game.totalRounds) ||
    game.totalRounds < 1 ||
    !Number.isSafeInteger(game.currentRound) ||
    game.currentRound < 1 ||
    game.currentRound > game.totalRounds
  ) {
    throw new RoomManagerError("INTERNAL_ERROR", "La position du dessin actuel est invalide.");
  }

  if (game.votingIndex + 1 < game.votingOrder.length) {
    return "NEXT_DRAWING";
  }

  return game.currentRound < game.totalRounds ? "NEXT_ROUND" : "FINAL";
}

export function buildLeaderboard(
  players: readonly InternalPlayer[],
  turnOrder: readonly string[],
): PublicLeaderboardEntry[] {
  const orderByPlayerId = new Map(turnOrder.map((playerId, index) => [playerId, index]));

  const sortedPlayers = [...players].sort((left, right) => {
    validatePlayerScore(left);
    validatePlayerScore(right);

    if (left.score !== right.score) {
      return right.score - left.score;
    }

    const leftOrder = orderByPlayerId.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderByPlayerId.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder;
  });

  let previousScore: number | null = null;
  let previousRank = 0;

  return sortedPlayers.map((player, index) => {
    const rank =
      previousScore !== null && player.score === previousScore ? previousRank : index + 1;

    previousScore = player.score;
    previousRank = rank;

    return {
      rank,
      player: {
        id: player.id,
        nickname: player.nickname,
      },
      score: player.score,
    };
  });
}

export function getEligibleVoterIds(
  game: InternalGame,
  players: readonly InternalPlayer[],
): string[] {
  if (game.currentTurn === null) {
    return [];
  }

  const authorId = game.currentTurn.drawerPlayerId;
  const gamePlayerIds = new Set(game.turnOrder);

  return players
    .filter((player) => player.id !== authorId && gamePlayerIds.has(player.id))
    .map((player) => player.id);
}

export function getSubmittedGuessCount(
  game: InternalGame,
  eligibleVoterIds: readonly string[],
): number {
  const guesses = game.currentTurn?.guesses ?? {};

  return eligibleVoterIds.reduce(
    (count, playerId) => (Object.hasOwn(guesses, playerId) ? count + 1 : count),
    0,
  );
}

export function areAllGuessesSubmitted(
  game: InternalGame,
  eligibleVoterIds: readonly string[],
): boolean {
  return (
    eligibleVoterIds.length > 0 &&
    getSubmittedGuessCount(game, eligibleVoterIds) === eligibleVoterIds.length
  );
}

export function applyTurnScores(
  game: InternalGame,
  players: readonly InternalPlayer[],
  appliedAt: number,
): InternalTurnScoreResult {
  const turn = requireCurrentTurn(game);
  const hasAppliedTimestamp = turn.scoresAppliedAt !== null;
  const hasScoreResult = turn.scoreResult !== null;

  if (hasAppliedTimestamp || hasScoreResult) {
    if (!hasAppliedTimestamp || !hasScoreResult) {
      throw new RoomManagerError("INTERNAL_ERROR", "Le calcul des scores du tour est incohérent.");
    }

    return cloneTurnScoreResult(turn.scoreResult as InternalTurnScoreResult);
  }

  if (!Number.isFinite(appliedAt)) {
    throw new RoomManagerError("INTERNAL_ERROR", "Impossible de dater le calcul des scores.");
  }

  const eligibleVoterIds = getEligibleVoterIds(game, players);
  if (!areAllGuessesSubmitted(game, eligibleVoterIds)) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "Toutes les estimations doivent être présentes avant le calcul des scores.",
    );
  }

  const playersById = new Map(players.map((player) => [player.id, player]));
  const drawer = playersById.get(turn.drawerPlayerId);
  if (drawer === undefined) {
    throw new RoomManagerError("INTERNAL_ERROR", "Le dessinateur du tour est introuvable.");
  }

  validatePlayerScore(drawer);

  const distances: number[] = [];
  const guessResults: InternalTurnScoreResult["guesses"] = {};
  const scoreUpdates = new Map<string, number>();

  for (const playerId of eligibleVoterIds) {
    const player = playersById.get(playerId);
    const guess = turn.guesses[playerId];

    if (player === undefined || guess === undefined || guess.playerId !== playerId) {
      throw new RoomManagerError("INTERNAL_ERROR", "Une estimation attendue est introuvable.");
    }

    validatePlayerScore(player);
    const distance = Math.abs(guess.value - turn.secretLevel);
    const pointsEarned = calculateGuessPoints(distance);
    const totalScore = player.score + pointsEarned;

    distances.push(distance);
    scoreUpdates.set(playerId, totalScore);
    guessResults[playerId] = {
      playerId,
      distance,
      pointsEarned,
      totalScore,
    };
  }

  const averageDistance =
    distances.reduce((total, distance) => total + distance, 0) / distances.length;
  const drawerPoints = calculateDrawerPoints(distances);
  const drawerTotalScore = drawer.score + drawerPoints;
  const result: InternalTurnScoreResult = {
    guesses: guessResults,
    drawer: {
      playerId: drawer.id,
      averageDistance,
      pointsEarned: drawerPoints,
      totalScore: drawerTotalScore,
    },
  };

  scoreUpdates.set(drawer.id, drawerTotalScore);
  for (const [playerId, totalScore] of scoreUpdates) {
    const player = playersById.get(playerId);
    if (player === undefined) {
      throw new RoomManagerError("INTERNAL_ERROR", "Un joueur à créditer est introuvable.");
    }
    player.score = totalScore;
  }

  turn.scoreResult = result;
  turn.scoresAppliedAt = appliedAt;

  return cloneTurnScoreResult(result);
}
