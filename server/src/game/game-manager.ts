import { randomUUID } from "node:crypto";

import type { GuessValue, PublicRoomState } from "@drawing-game/shared";

import type { RoomManager } from "../rooms/room-manager.js";
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
  RequestRematchInternalResult,
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
  getNextTurnPosition,
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
  getNextTurnPosition,
  getSubmittedGuessCount,
  hasNextTurn,
} from "./game-rules.js";
export type { NextTurnPosition } from "./game-rules.js";

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
      "Impossible de déterminer un ordre de dessinateurs valide.",
    );
  }

  const expectedIds = new Set(originalPlayerIds);
  if (turnOrder.some((playerId) => !expectedIds.has(playerId))) {
    throw new RoomManagerError(
      "INTERNAL_ERROR",
      "Impossible de déterminer un ordre de dessinateurs valide.",
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

export function initializeTurn(
  turnId: string,
  drawerPlayerId: string,
  prompt: DrawingPrompt,
  secretLevel: GuessValue,
): InternalTurn {
  return {
    turnId,
    drawerPlayerId,
    prompt,
    secretLevel,
    drawing: null,
    drawingSubmittedAt: null,
    guesses: {},
    scoresAppliedAt: null,
    scoreResult: null,
  };
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

    if (room.players.length < 3) {
      throw new RoomManagerError("NOT_ENOUGH_PLAYERS", "Il faut au moins 3 joueurs.");
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

    const drawerPlayerId = turnOrder[0];
    const drawer = room.players.find((player) => player.id === drawerPlayerId);
    if (drawer === undefined) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de sélectionner le premier dessinateur.",
      );
    }

    if (drawer.socketId === null) {
      throw new RoomManagerError(
        "PLAYERS_NOT_READY",
        "Le dessinateur doit être reconnecté avant de lancer la partie.",
      );
    }

    const currentTurn = this.prepareTurn(drawer.id, [], []);
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
      currentDrawerIndex: 0,
      currentTurn,
      usedPromptIds: [currentTurn.prompt.id],
      usedTurnIds: [currentTurn.turnId],
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
        drawerSocketId: drawer.socketId,
        secret: {
          roomCode: room.code,
          gameId,
          turnId: currentTurn.turnId,
          drawerPlayerId: drawer.id,
          secretLevel: currentTurn.secretLevel,
        },
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
    if (requester === undefined) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (requester.id !== game.currentTurn.drawerPlayerId) {
      throw new RoomManagerError(
        "NOT_CURRENT_DRAWER",
        "Seul le dessinateur actuel peut envoyer un dessin.",
      );
    }

    if (game.currentTurn.drawing !== null || game.currentTurn.drawingSubmittedAt !== null) {
      throw new RoomManagerError(
        "DRAWING_ALREADY_SUBMITTED",
        "Un dessin a déjà été envoyé pour ce tour.",
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
    const previousPhaseEndsAt = game.phaseEndsAt;
    game.currentTurn.drawing = validation.document;
    game.currentTurn.drawingSubmittedAt = submittedAt;
    game.phase = "VOTING";
    game.phaseEndsAt = null;

    try {
      return {
        room: this.roomManager.getPublicRoomState(room.code),
      };
    } catch (error) {
      game.currentTurn.drawing = null;
      game.currentTurn.drawingSubmittedAt = null;
      game.phase = previousPhase;
      game.phaseEndsAt = previousPhaseEndsAt;

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

    const requester = room.players.find((player) => player.socketId === socketId);
    if (requester === undefined) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (requester.id === game.currentTurn.drawerPlayerId) {
      throw new RoomManagerError(
        "DRAWER_CANNOT_GUESS",
        "Le dessinateur ne peut pas voter pour son propre dessin.",
      );
    }

    const eligibleVoterIds = getEligibleVoterIds(game, room.players);
    if (!eligibleVoterIds.includes(requester.id)) {
      throw new RoomManagerError("PLAYER_NOT_ELIGIBLE", "Vous ne pouvez pas participer à ce vote.");
    }

    const validation = validateSubmitGuessPayload(payload);
    if (validation.success && validation.data.turnId !== game.currentTurn.turnId) {
      throw new RoomManagerError(
        "STALE_TURN",
        "Cette estimation correspond à un tour qui n’est plus actif.",
      );
    }

    if (Object.hasOwn(game.currentTurn.guesses, requester.id)) {
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
    const previousScoresAppliedAt = game.currentTurn.scoresAppliedAt;
    const previousScoreResult =
      game.currentTurn.scoreResult === null
        ? null
        : cloneTurnScoreResult(game.currentTurn.scoreResult);

    game.currentTurn.guesses[requester.id] = guess;

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
      delete game.currentTurn.guesses[requester.id];
      game.phase = previousPhase;
      game.phaseEndsAt = previousPhaseEndsAt;
      game.currentTurn.scoresAppliedAt = previousScoresAppliedAt;
      game.currentTurn.scoreResult = previousScoreResult;
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
      throw new RoomManagerError("NOT_HOST", "Seul l’hôte peut lancer le tour suivant.");
    }

    if (game.phase === "FINISHED") {
      throw new RoomManagerError("GAME_ALREADY_FINISHED", "La partie est terminée.");
    }

    if (game.phase !== "REVEAL") {
      throw new RoomManagerError(
        "NOT_REVEAL_PHASE",
        "Le tour suivant ne peut pas encore commencer.",
      );
    }

    const eligibleVoterIds = getEligibleVoterIds(game, room.players);
    if (
      !areAllGuessesSubmitted(game, eligibleVoterIds) ||
      game.currentTurn.scoresAppliedAt === null ||
      game.currentTurn.scoreResult === null
    ) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Le tour actuel n’est pas prêt à être poursuivi.",
      );
    }

    const nextPosition = getNextTurnPosition(game);
    if (nextPosition === null) {
      const finishedState = createPublicFinishedState(game, room.players);
      const previousPhase = game.phase;
      const previousPhaseEndsAt = game.phaseEndsAt;
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

    const nextDrawerPlayerId = game.turnOrder[nextPosition.currentDrawerIndex];
    const nextDrawer = room.players.find((player) => player.id === nextDrawerPlayerId);
    if (nextDrawer === undefined) {
      throw new RoomManagerError("INTERNAL_ERROR", "Le prochain dessinateur est introuvable.");
    }

    const nextTurn = this.prepareTurn(nextDrawer.id, game.usedPromptIds, game.usedTurnIds);
    const introStartedAt = this.clock();
    if (!Number.isFinite(introStartedAt)) {
      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de dater le tour suivant.");
    }

    const previousPhase = game.phase;
    const previousPhaseEndsAt = game.phaseEndsAt;
    const previousRound = game.currentRound;
    const previousDrawerIndex = game.currentDrawerIndex;
    const previousTurn = game.currentTurn;
    const previousUsedPromptIds = [...game.usedPromptIds];
    const previousUsedTurnIds = [...game.usedTurnIds];

    game.phase = "ROUND_INTRO";
    game.phaseEndsAt = introStartedAt + this.introDurationMs;
    game.currentRound = nextPosition.currentRound;
    game.currentDrawerIndex = nextPosition.currentDrawerIndex;
    game.currentTurn = nextTurn;
    game.usedPromptIds = [...previousUsedPromptIds, nextTurn.prompt.id];
    game.usedTurnIds = [...previousUsedTurnIds, nextTurn.turnId];

    try {
      this.scheduleDrawingTransition(room.code, game);
      const publicRoom = this.roomManager.getPublicRoomState(room.code);

      return {
        room: publicRoom,
        nextTurn: {
          drawerSocketId: nextDrawer.socketId,
          secret: {
            roomCode: room.code,
            gameId: game.gameId,
            turnId: nextTurn.turnId,
            drawerPlayerId: nextDrawer.id,
            secretLevel: nextTurn.secretLevel,
          },
        },
      };
    } catch (error) {
      this.clearScheduledTransition(room.code);
      game.phase = previousPhase;
      game.phaseEndsAt = previousPhaseEndsAt;
      game.currentRound = previousRound;
      game.currentDrawerIndex = previousDrawerIndex;
      game.currentTurn = previousTurn;
      game.usedPromptIds = previousUsedPromptIds;
      game.usedTurnIds = previousUsedTurnIds;

      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de préparer le tour suivant.");
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

  private prepareTurn(
    drawerPlayerId: string,
    usedPromptIds: readonly string[],
    usedTurnIds: readonly string[],
  ): InternalTurn {
    const usedPromptIdSet = new Set(usedPromptIds);
    const availablePrompts = this.prompts.filter((prompt) => !usedPromptIdSet.has(prompt.id));

    if (availablePrompts.length === 0) {
      throw new RoomManagerError("INTERNAL_ERROR", "Aucune consigne inédite n’est disponible.");
    }

    let selectedPromptCandidate: DrawingPrompt;
    let secretLevel: number;
    let turnId: string;

    try {
      selectedPromptCandidate = this.choosePrompt(availablePrompts);
      secretLevel = this.createSecretLevel();
      turnId = this.createTurnId();
    } catch {
      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de préparer les données du tour.");
    }

    const selectedPrompt = availablePrompts.find(
      (prompt) => prompt.id === selectedPromptCandidate.id,
    );
    if (selectedPrompt === undefined) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de sélectionner une consigne inédite valide.",
      );
    }

    validateSecretLevel(secretLevel);
    validateTurnId(turnId);
    if (new Set(usedTurnIds).has(turnId)) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Le nouvel identifiant de tour doit être unique.",
      );
    }

    return initializeTurn(turnId, drawerPlayerId, selectedPrompt, secretLevel);
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
