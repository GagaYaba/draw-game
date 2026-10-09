import { randomUUID } from "node:crypto";

import type { GuessValue, PublicRoomState } from "@drawing-game/shared";

import { MINIMUM_PLAYERS_TO_START, type RoomManager } from "../rooms/room-manager.js";
import { RoomManagerError } from "../rooms/room-types.js";
import { validateSubmitDrawingPayload } from "./drawing-validation.js";
import { validateSubmitGuessPayload } from "./guess-validation.js";
import { generateSecretLevel, selectDrawingPrompt, shufflePlayerIds } from "./game-random.js";
import type {
  DrawingPrompt,
  ContinueGameInternalResult,
  GameIdGenerator,
  GameManagerOptions,
  InternalGame,
  InternalTurn,
  PlayerAssignment,
  RequestRematchInternalResult,
  RoundEntry,
  StartGameInternalResult,
  SubmitDrawingInternalResult,
  SubmitGuessInternalResult,
} from "./game-types.js";
import { createPublicFinishedState } from "./game-public-state.js";
import {
  applyTurnScores,
  areAllGuessesSubmitted,
  cloneTurnScoreResult,
  getEligibleVoterIds,
  getNextStep,
  requireCurrentTurn,
} from "./game-rules.js";
import { DRAWING_PROMPTS } from "./prompt-bank.js";

export {
  createPublicFinishedState,
  createPublicRevealState,
  toPublicGameState,
} from "./game-public-state.js";
export {
  applyTurnScores,
  areAllGuessesSubmitted,
  buildLeaderboard,
  calculateDrawerPoints,
  calculateGuessPoints,
  getEligibleVoterIds,
  getNextStep,
  getSubmittedGuessCount,
} from "./game-rules.js";

export const ROUND_INTRO_DURATION_MS = 3_000;
export const TOTAL_ROUNDS = 2;

function defaultScheduleTimer(callback: () => void, delay: number): unknown {
  return setTimeout(callback, delay);
}

function defaultClearTimer(handle: unknown): void {
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function validateTurnOrder(
  originalPlayerIds: readonly string[],
  turnOrder: readonly string[],
): void {
  if (
    turnOrder.length !== originalPlayerIds.length ||
    new Set(turnOrder).size !== originalPlayerIds.length
  ) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "Impossible de déterminer un ordre de joueurs valide.",
    );
  }

  const expectedIds = new Set(originalPlayerIds);
  if (turnOrder.some((playerId) => !expectedIds.has(playerId))) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "Impossible de déterminer un ordre de joueurs valide.",
    );
  }
}

function validateSecretLevel(secretLevel: number): asserts secretLevel is GuessValue {
  if (!Number.isInteger(secretLevel) || secretLevel < 1 || secretLevel > 10) {
    throw new RoomManagerError("INTERNAL_ERROR", "Impossible de générer un niveau secret valide.");
  }
}

function validateTurnId(turnId: string): void {
  if (turnId.length === 0 || turnId.trim() !== turnId) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "Impossible de générer un identifiant de tour valide.",
    );
  }
}

export function createGameId(generateGameId: GameIdGenerator = randomUUID): string {
  let gameId: unknown;

  try {
    gameId = generateGameId();
  } catch {
    throw new RoomManagerError("INTERNAL_ERROR", "Impossible de générer un identifiant de partie.");
  }

  if (typeof gameId !== "string" || gameId.length === 0 || gameId.trim() !== gameId) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "Impossible de générer un identifiant de partie valide.",
    );
  }

  return gameId;
}

/** Prépare le dessin présenté : consigne, niveau et dessin de l'auteur. */
export function initializeTurn(turnId: string, authorId: string, entry: RoundEntry): InternalTurn {
  return {
    turnId,
    drawerPlayerId: authorId,
    prompt: entry.prompt,
    secretLevel: entry.secretLevel,
    drawing: entry.drawing,
    drawingSubmittedAt: entry.drawingSubmittedAt,
    guesses: {},
    scoresAppliedAt: null,
    scoreResult: null,
  };
}

interface PreparedRound {
  roundId: string;
  entries: Record<string, RoundEntry>;
}

export class GameManager {
  private readonly clock;
  private readonly gameIdGenerator;
  private readonly createTurnId;
  private readonly introDurationMs;
  private readonly prompts: readonly DrawingPrompt[];
  private readonly shuffle;
  private readonly choosePrompt;
  private readonly createSecretLevel;
  private readonly scheduleTimer;
  private readonly clearTimer;
  private readonly onPublicRoomStateChanged;
  private readonly phaseTimers = new Map<string, unknown>();

  constructor(
    private readonly roomManager: RoomManager,
    options: GameManagerOptions = {},
  ) {
    this.clock = options.clock ?? Date.now;
    this.gameIdGenerator = options.generateGameId ?? randomUUID;
    this.createTurnId = options.generateTurnId ?? randomUUID;
    this.introDurationMs = options.introDurationMs ?? ROUND_INTRO_DURATION_MS;
    this.prompts = options.prompts ?? DRAWING_PROMPTS;
    this.shuffle = options.shufflePlayerIds ?? shufflePlayerIds;
    this.choosePrompt = options.selectPrompt ?? selectDrawingPrompt;
    this.createSecretLevel = options.generateSecretLevel ?? generateSecretLevel;
    this.scheduleTimer = options.scheduleTimer ?? defaultScheduleTimer;
    this.clearTimer = options.clearTimer ?? defaultClearTimer;
    this.onPublicRoomStateChanged = options.onPublicRoomStateChanged ?? (() => undefined);

    if (!Number.isSafeInteger(this.introDurationMs) || this.introDurationMs < 1) {
      throw new RangeError("introDurationMs doit être un entier positif.");
    }

    if (this.prompts.length === 0) {
      throw new RangeError("La banque de consignes ne peut pas être vide.");
    }

    if (new Set(this.prompts.map((prompt) => prompt.id)).size !== this.prompts.length) {
      throw new RangeError("Les identifiants de consigne doivent être uniques.");
    }
  }

  startGame(socketId: string | null): StartGameInternalResult {
    const room = this.roomManager.getPlayerRoomBySocketId(socketId);

    if (room === undefined) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    const requester = room.players.find((player) => player.socketId === socketId);
    if (requester === undefined) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (!requester.isHost) {
      throw new RoomManagerError("NOT_HOST", "Seul l’hôte peut lancer la partie.");
    }

    if (room.game !== null) {
      throw new RoomManagerError("GAME_ALREADY_STARTED", "Une partie est déjà en cours.");
    }

    if (room.players.length < MINIMUM_PLAYERS_TO_START) {
      throw new RoomManagerError(
        "NOT_ENOUGH_PLAYERS",
        `Il faut au moins ${MINIMUM_PLAYERS_TO_START} joueurs.`,
      );
    }

    if (!room.players.every((player) => player.isReady)) {
      throw new RoomManagerError("PLAYERS_NOT_READY", "Tous les joueurs doivent être prêts.");
    }

    if (!room.players.every((player) => player.isConnected && player.socketId !== null)) {
      throw new RoomManagerError(
        "PLAYERS_NOT_READY",
        "Tous les joueurs doivent être reconnectés avant de lancer la partie.",
      );
    }

    const playerIds = room.players.map((player) => player.id);
    let turnOrder: string[];

    try {
      turnOrder = this.shuffle([...playerIds]);
      validateTurnOrder(playerIds, turnOrder);
    } catch (error) {
      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de préparer la partie.");
    }

    const round = this.prepareRound(turnOrder, [], []);
    const gameId = createGameId(this.gameIdGenerator);
    const startedAt = this.clock();
    if (!Number.isFinite(startedAt)) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de dater le lancement de la partie.",
      );
    }

    const previousScores = room.players.map((player) => player.score);
    for (const player of room.players) {
      player.score = 0;
    }

    const game: InternalGame = {
      gameId,
      phase: "ROUND_INTRO",
      totalRounds: TOTAL_ROUNDS,
      currentRound: 1,
      turnOrder,
      roundId: round.roundId,
      entries: round.entries,
      votingOrder: [],
      votingIndex: 0,
      currentTurn: null,
      usedPromptIds: turnOrder.map((playerId) => round.entries[playerId]?.prompt.id ?? ""),
      usedTurnIds: [round.roundId],
      finishedState: null,
      startedAt,
      phaseEndsAt: startedAt + this.introDurationMs,
    };

    room.game = game;

    try {
      this.scheduleDrawingTransition(room.code, game);
      const publicRoom = this.roomManager.getPublicRoomState(room.code);

      return {
        room: publicRoom,
        assignments: this.buildAssignments(room.code, game, room.players),
      };
    } catch (error) {
      room.game = null;
      this.clearScheduledTransition(room.code);
      room.players.forEach((player, index) => {
        player.score = previousScores[index] ?? 0;
      });

      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de programmer le début du dessin.");
    }
  }

  submitDrawing(socketId: string | null, payload: unknown): SubmitDrawingInternalResult {
    const room = this.roomManager.getPlayerRoomBySocketId(socketId);
    if (room === undefined) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    const game = room.game;
    if (game === null) {
      throw new RoomManagerError("GAME_NOT_STARTED", "Aucune partie n’est en cours.");
    }

    if (game.phase !== "DRAWING") {
      throw new RoomManagerError(
        "NOT_DRAWING_PHASE",
        "Le dessin ne peut pas être envoyé pendant cette phase.",
      );
    }

    const requester = room.players.find((player) => player.socketId === socketId);
    const entry = requester === undefined ? undefined : game.entries[requester.id];
    if (requester === undefined || entry === undefined) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (entry.drawing !== null || entry.drawingSubmittedAt !== null) {
      throw new RoomManagerError(
        "DRAWING_ALREADY_SUBMITTED",
        "Un dessin a déjà été envoyé pour cette manche.",
      );
    }

    const validation = validateSubmitDrawingPayload(payload);
    if (!validation.success) {
      throw new RoomManagerError(validation.error.code, validation.error.message);
    }

    const submittedAt = this.clock();
    if (!Number.isFinite(submittedAt)) {
      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de dater la soumission du dessin.");
    }

    const previousPhase = game.phase;
    const previousVotingOrder = game.votingOrder;
    const previousVotingIndex = game.votingIndex;
    const previousUsedTurnIds = [...game.usedTurnIds];
    entry.drawing = validation.document;
    entry.drawingSubmittedAt = submittedAt;

    try {
      if (game.turnOrder.every((playerId) => game.entries[playerId]?.drawing != null)) {
        this.startVoting(game);
      }

      return {
        room: this.roomManager.getPublicRoomState(room.code),
      };
    } catch (error) {
      entry.drawing = null;
      entry.drawingSubmittedAt = null;
      game.phase = previousPhase;
      game.currentTurn = null;
      game.votingOrder = previousVotingOrder;
      game.votingIndex = previousVotingIndex;
      game.usedTurnIds = previousUsedTurnIds;

      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de publier le dessin soumis.");
    }
  }

  submitGuess(socketId: string | null, payload: unknown): SubmitGuessInternalResult {
    const room = this.roomManager.getPlayerRoomBySocketId(socketId);
    if (room === undefined) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    const game = room.game;
    if (game === null) {
      throw new RoomManagerError("GAME_NOT_STARTED", "Aucune partie n’est en cours.");
    }

    if (game.phase !== "VOTING") {
      throw new RoomManagerError(
        "NOT_VOTING_PHASE",
        "Les estimations ne sont pas ouvertes pendant cette phase.",
      );
    }

    const turn = requireCurrentTurn(game);
    const requester = room.players.find((player) => player.socketId === socketId);
    if (requester === undefined) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (requester.id === turn.drawerPlayerId) {
      throw new RoomManagerError(
        "DRAWER_CANNOT_GUESS",
        "Vous ne pouvez pas voter pour votre propre dessin.",
      );
    }

    const eligibleVoterIds = getEligibleVoterIds(game, room.players);
    if (!eligibleVoterIds.includes(requester.id)) {
      throw new RoomManagerError("PLAYER_NOT_ELIGIBLE", "Vous ne pouvez pas participer à ce vote.");
    }

    const validation = validateSubmitGuessPayload(payload);
    if (validation.success && validation.data.turnId !== turn.turnId) {
      throw new RoomManagerError(
        "STALE_TURN",
        "Cette estimation correspond à un dessin qui n’est plus actif.",
      );
    }

    if (Object.hasOwn(turn.guesses, requester.id)) {
      throw new RoomManagerError("GUESS_ALREADY_SUBMITTED", "Votre estimation a déjà été validée.");
    }

    if (!validation.success) {
      throw new RoomManagerError(validation.error.code, validation.error.message);
    }

    const submittedAt = this.clock();
    if (!Number.isFinite(submittedAt)) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de dater la soumission de l’estimation.",
      );
    }

    const guess = {
      playerId: requester.id,
      value: validation.data.value,
      submittedAt,
    };
    const previousPhase = game.phase;
    const previousPhaseEndsAt = game.phaseEndsAt;
    const previousScores = room.players.map((player) => player.score);
    const previousScoresAppliedAt = turn.scoresAppliedAt;
    const previousScoreResult =
      turn.scoreResult === null ? null : cloneTurnScoreResult(turn.scoreResult);

    turn.guesses[requester.id] = guess;

    try {
      if (areAllGuessesSubmitted(game, eligibleVoterIds)) {
        game.phase = "REVEAL";
        game.phaseEndsAt = null;
        applyTurnScores(game, room.players, submittedAt);
      }

      return {
        room: this.roomManager.getPublicRoomState(room.code),
        guess: {
          value: guess.value,
          submittedAt: guess.submittedAt,
        },
      };
    } catch (error) {
      delete turn.guesses[requester.id];
      game.phase = previousPhase;
      game.phaseEndsAt = previousPhaseEndsAt;
      turn.scoresAppliedAt = previousScoresAppliedAt;
      turn.scoreResult = previousScoreResult;
      room.players.forEach((player, index) => {
        player.score = previousScores[index] ?? 0;
      });

      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de publier l’estimation.");
    }
  }

  continueGame(socketId: string | null): ContinueGameInternalResult {
    const room = this.roomManager.getPlayerRoomBySocketId(socketId);
    if (room === undefined) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    const game = room.game;
    if (game === null) {
      throw new RoomManagerError("GAME_NOT_STARTED", "Aucune partie n’est en cours.");
    }

    const requester = room.players.find((player) => player.socketId === socketId);
    if (requester === undefined) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (!requester.isHost) {
      throw new RoomManagerError("NOT_HOST", "Seul l’hôte peut passer à la suite.");
    }

    if (game.phase === "FINISHED") {
      throw new RoomManagerError("GAME_ALREADY_FINISHED", "La partie est terminée.");
    }

    if (game.phase !== "REVEAL") {
      throw new RoomManagerError(
        "NOT_REVEAL_PHASE",
        "La suite de la partie ne peut pas encore commencer.",
      );
    }

    const turn = requireCurrentTurn(game);
    const eligibleVoterIds = getEligibleVoterIds(game, room.players);
    if (
      !areAllGuessesSubmitted(game, eligibleVoterIds) ||
      turn.scoresAppliedAt === null ||
      turn.scoreResult === null
    ) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Le dessin actuel n’est pas prêt à être poursuivi.",
      );
    }

    const nextStep = getNextStep(game);
    const previousPhase = game.phase;
    const previousPhaseEndsAt = game.phaseEndsAt;

    if (nextStep === "FINAL") {
      const finishedState = createPublicFinishedState(game, room.players);
      const previousFinishedState = game.finishedState;
      game.phase = "FINISHED";
      game.phaseEndsAt = null;
      game.finishedState = finishedState;

      try {
        return {
          room: this.roomManager.getPublicRoomState(room.code),
        };
      } catch (error) {
        game.phase = previousPhase;
        game.phaseEndsAt = previousPhaseEndsAt;
        game.finishedState = previousFinishedState;

        if (error instanceof RoomManagerError) {
          throw error;
        }

        throw new RoomManagerError("INTERNAL_ERROR", "Impossible de terminer la partie.");
      }
    }

    const previousTurn = turn;
    const previousVotingIndex = game.votingIndex;
    const previousUsedTurnIds = [...game.usedTurnIds];

    if (nextStep === "NEXT_DRAWING") {
      try {
        game.votingIndex = previousVotingIndex + 1;
        const authorId = game.votingOrder[game.votingIndex];
        if (authorId === undefined) {
          throw new RoomManagerError("INTERNAL_ERROR", "Le prochain dessin est introuvable.");
        }
        game.currentTurn = this.createVotingTurn(game, authorId);
        game.phase = "VOTING";
        game.phaseEndsAt = null;

        return {
          room: this.roomManager.getPublicRoomState(room.code),
        };
      } catch (error) {
        game.phase = previousPhase;
        game.phaseEndsAt = previousPhaseEndsAt;
        game.votingIndex = previousVotingIndex;
        game.currentTurn = previousTurn;
        game.usedTurnIds = previousUsedTurnIds;

        if (error instanceof RoomManagerError) {
          throw error;
        }

        throw new RoomManagerError("INTERNAL_ERROR", "Impossible de préparer le dessin suivant.");
      }
    }

    const introStartedAt = this.clock();
    if (!Number.isFinite(introStartedAt)) {
      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de dater la manche suivante.");
    }

    const previousRound = game.currentRound;
    const previousRoundId = game.roundId;
    const previousEntries = game.entries;
    const previousVotingOrder = game.votingOrder;
    const previousUsedPromptIds = [...game.usedPromptIds];

    try {
      const round = this.prepareRound(game.turnOrder, game.usedPromptIds, game.usedTurnIds);
      game.phase = "ROUND_INTRO";
      game.phaseEndsAt = introStartedAt + this.introDurationMs;
      game.currentRound = previousRound + 1;
      game.roundId = round.roundId;
      game.entries = round.entries;
      game.votingOrder = [];
      game.votingIndex = 0;
      game.currentTurn = null;
      game.usedPromptIds = [
        ...previousUsedPromptIds,
        ...game.turnOrder.map((playerId) => round.entries[playerId]?.prompt.id ?? ""),
      ];
      game.usedTurnIds = [...previousUsedTurnIds, round.roundId];

      this.scheduleDrawingTransition(room.code, game);

      return {
        room: this.roomManager.getPublicRoomState(room.code),
        assignments: this.buildAssignments(room.code, game, room.players),
      };
    } catch (error) {
      this.clearScheduledTransition(room.code);
      game.phase = previousPhase;
      game.phaseEndsAt = previousPhaseEndsAt;
      game.currentRound = previousRound;
      game.roundId = previousRoundId;
      game.entries = previousEntries;
      game.votingOrder = previousVotingOrder;
      game.votingIndex = previousVotingIndex;
      game.currentTurn = previousTurn;
      game.usedPromptIds = previousUsedPromptIds;
      game.usedTurnIds = previousUsedTurnIds;

      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de préparer la manche suivante.");
    }
  }

  requestRematch(socketId: string | null): RequestRematchInternalResult {
    const room = this.roomManager.getPlayerRoomBySocketId(socketId);
    if (room === undefined) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    const requester = room.players.find((player) => player.socketId === socketId);
    if (requester === undefined) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (room.game === null) {
      throw new RoomManagerError(
        "GAME_NOT_STARTED",
        "Aucune partie n’est disponible pour une revanche.",
      );
    }

    if (!requester.isHost) {
      throw new RoomManagerError("NOT_HOST", "Seul l’hôte peut proposer une revanche.");
    }

    if (room.game.phase !== "FINISHED") {
      throw new RoomManagerError(
        "GAME_NOT_FINISHED",
        "La revanche ne peut être proposée qu’après la fin de la partie.",
      );
    }

    return {
      room: this.resetRoomForRematch(room.code),
    };
  }

  resetRoomForRematch(roomCode: string): PublicRoomState {
    const room = this.roomManager.getRoomByCode(roomCode);
    if (room === undefined) {
      throw new RoomManagerError("ROOM_NOT_FOUND", "Aucun salon ne correspond à ce code.");
    }

    if (room.game === null) {
      throw new RoomManagerError(
        "GAME_NOT_STARTED",
        "Aucune partie n’est disponible pour une revanche.",
      );
    }

    if (room.game.phase !== "FINISHED") {
      throw new RoomManagerError(
        "GAME_NOT_FINISHED",
        "La revanche ne peut être proposée qu’après la fin de la partie.",
      );
    }

    this.clearScheduledTransition(room.code);
    const previousGame = room.game;
    const previousPlayerStates = room.players.map((player) => ({
      isReady: player.isReady,
      score: player.score,
    }));

    room.game = null;
    for (const player of room.players) {
      player.isReady = false;
      player.score = 0;
    }

    try {
      return this.roomManager.getPublicRoomState(room.code);
    } catch (error) {
      room.game = previousGame;
      room.players.forEach((player, index) => {
        const previousState = previousPlayerStates[index];
        if (previousState !== undefined) {
          player.isReady = previousState.isReady;
          player.score = previousState.score;
        }
      });

      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de préparer le salon pour une revanche.",
      );
    }
  }

  cancelGame(roomCode: string): boolean {
    const room = this.roomManager.getRoomByCode(roomCode);
    this.clearScheduledTransition(roomCode);

    if (room === undefined || room.game === null) {
      return false;
    }

    if (room.game.phase === "FINISHED") {
      return false;
    }

    room.game = null;
    for (const player of room.players) {
      player.isReady = false;
      player.score = 0;
    }

    return true;
  }

  dispose(): void {
    for (const timer of this.phaseTimers.values()) {
      this.clearTimer(timer);
    }
    this.phaseTimers.clear();
  }

  /** Tire une consigne distincte et un niveau secret pour chaque joueur de la manche. */
  private prepareRound(
    playerIds: readonly string[],
    usedPromptIds: readonly string[],
    usedTurnIds: readonly string[],
  ): PreparedRound {
    const usedPromptIdSet = new Set(usedPromptIds);
    let availablePrompts = this.prompts.filter((prompt) => !usedPromptIdSet.has(prompt.id));

    if (availablePrompts.length < playerIds.length) {
      throw new RoomManagerError("INTERNAL_ERROR", "Aucune consigne inédite n’est disponible.");
    }

    const entries: Record<string, RoundEntry> = {};
    let roundId: string;

    try {
      for (const playerId of playerIds) {
        const selectedCandidate = this.choosePrompt(availablePrompts);
        const selectedPrompt = availablePrompts.find(
          (prompt) => prompt.id === selectedCandidate.id,
        );
        if (selectedPrompt === undefined) {
          throw new RoomManagerError(
            "INTERNAL_ERROR",
            "Impossible de sélectionner une consigne inédite valide.",
          );
        }

        const secretLevel = this.createSecretLevel();
        validateSecretLevel(secretLevel);
        availablePrompts = availablePrompts.filter((prompt) => prompt.id !== selectedPrompt.id);
        entries[playerId] = {
          prompt: selectedPrompt,
          secretLevel,
          drawing: null,
          drawingSubmittedAt: null,
        };
      }

      roundId = this.createTurnId();
    } catch (error) {
      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de préparer les données de la manche.",
      );
    }

    validateTurnId(roundId);
    if (new Set(usedTurnIds).has(roundId)) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Le nouvel identifiant de manche doit être unique.",
      );
    }

    return { roundId, entries };
  }

  private buildAssignments(
    roomCode: string,
    game: InternalGame,
    players: readonly { id: string; socketId: string | null }[],
  ): PlayerAssignment[] {
    return game.turnOrder.map((playerId) => {
      const entry = game.entries[playerId];
      const player = players.find((candidate) => candidate.id === playerId);
      if (entry === undefined || player === undefined) {
        throw new RoomManagerError("INTERNAL_ERROR", "Une consigne de joueur est introuvable.");
      }

      return {
        socketId: player.socketId,
        secret: {
          roomCode,
          gameId: game.gameId,
          turnId: game.roundId,
          round: game.currentRound,
          drawerPlayerId: playerId,
          secretLevel: entry.secretLevel,
          prompt: {
            id: entry.prompt.id,
            statement: entry.prompt.statement,
            lowLabel: entry.prompt.lowLabel,
            highLabel: entry.prompt.highLabel,
          },
        },
      };
    });
  }

  /** Fixe l'ordre de présentation et ouvre le vote du premier dessin. */
  private startVoting(game: InternalGame): void {
    const votingOrder = this.shuffle([...game.turnOrder]);
    validateTurnOrder(game.turnOrder, votingOrder);

    const firstAuthorId = votingOrder[0];
    if (firstAuthorId === undefined) {
      throw new RoomManagerError("INTERNAL_ERROR", "Aucun dessin à présenter.");
    }

    game.votingOrder = votingOrder;
    game.votingIndex = 0;
    game.currentTurn = this.createVotingTurn(game, firstAuthorId);
    game.phase = "VOTING";
    game.phaseEndsAt = null;
  }

  private createVotingTurn(game: InternalGame, authorId: string): InternalTurn {
    const entry = game.entries[authorId];
    if (entry === undefined || entry.drawing === null || entry.drawingSubmittedAt === null) {
      throw new RoomManagerError("INTERNAL_ERROR", "Le dessin à présenter est introuvable.");
    }

    const turnId = this.createTurnId();
    validateTurnId(turnId);
    if (game.usedTurnIds.includes(turnId)) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Le nouvel identifiant de tour doit être unique.",
      );
    }

    game.usedTurnIds = [...game.usedTurnIds, turnId];
    return initializeTurn(turnId, authorId, entry);
  }

  private scheduleDrawingTransition(roomCode: string, game: InternalGame): void {
    const delay = Math.max(0, (game.phaseEndsAt ?? this.clock()) - this.clock());
    const timer = this.scheduleTimer(() => {
      this.phaseTimers.delete(roomCode);
      const room = this.roomManager.getRoomByCode(roomCode);

      if (room === undefined || room.game !== game || game.phase !== "ROUND_INTRO") {
        return;
      }

      game.phase = "DRAWING";
      game.phaseEndsAt = null;
      this.onPublicRoomStateChanged(roomCode, this.roomManager.getPublicRoomState(roomCode));
    }, delay);

    this.phaseTimers.set(roomCode, timer);
  }

  private clearScheduledTransition(roomCode: string): void {
    if (!this.phaseTimers.has(roomCode)) {
      return;
    }

    const timer = this.phaseTimers.get(roomCode);
    this.clearTimer(timer);
    this.phaseTimers.delete(roomCode);
  }
}
