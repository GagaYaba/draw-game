import { useEffect, useRef, useState } from "react";

import {
  SOCKET_EVENTS,
  type CreateRoomPayload,
  type DrawingDocument,
  type GameCancelledPayload,
  type GamePhase,
  type GuessValue,
  type JoinRoomPayload,
  type PlayerSessionCredentials,
  type PublicGamePrompt,
  type PublicRoomState,
  type RestoreSessionPayload,
  type RestoreSessionSuccessData,
  type RoomSessionData,
  type SubmitGuessPayload,
  type TurnSecretPayload,
} from "@drawing-game/shared";

import {
  clearStoredDrawingDraft,
  matchesDrawingDraftContext,
  readStoredDrawingDraft,
} from "../session/stored-drawing-draft";
import {
  clearStoredGuessDraft,
  matchesGuessDraftContext,
  readStoredGuessDraft,
  writeStoredGuessDraft,
} from "../session/stored-guess-draft";
import { getOrCreateClientInstanceId } from "../session/client-instance";
import {
  clearStoredSession,
  parseStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredPlayerSession,
} from "../session/stored-session";
import {
  createManualSessionRestoreGate,
  type ManualSessionRestoreGate,
} from "../session/manual-session-restore";
import { socket } from "../socket/socket";

export interface ClientRoomSession {
  currentPlayerId: string | null;
  room: PublicRoomState | null;
}

export interface ClientGameSecrets {
  gameId: string | null;
  turnId: string | null;
  secretLevel: GuessValue | null;
  prompt: PublicGamePrompt | null;
}

export interface ClientGuessSubmission {
  value: GuessValue;
  submittedAt: number;
}

export interface ClientGuessState {
  selected: GuessValue | null;
  submitted: ClientGuessSubmission | null;
  isSubmitting: boolean;
  error: string | null;
}

export type ClientConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "restoring"
  | "restore-failed";

export type PendingRoomAction =
  | "create"
  | "join"
  | "ready"
  | "start"
  | "continue"
  | "rematch"
  | "submitDrawing"
  | "leave"
  | null;

const EMPTY_SESSION: ClientRoomSession = {
  currentPlayerId: null,
  room: null,
};

const EMPTY_GAME_SECRETS: ClientGameSecrets = {
  gameId: null,
  turnId: null,
  secretLevel: null,
  prompt: null,
};

const EMPTY_GUESS_STATE: ClientGuessState = {
  selected: null,
  submitted: null,
  isSubmitting: false,
  error: null,
};

const ACTION_TIMEOUT_MS = 8_000;
export const SESSION_RESTORE_RETRY_DELAYS_MS = [200, 500, 1_000] as const;
const REMATCH_READY_NOTICE = "La revanche est prête. Indiquez lorsque vous êtes prêt à jouer.";
const SESSION_RESTORED_ANNOUNCEMENT =
  "Votre session a été restaurée. Vous pouvez continuer la partie.";
const SESSION_STORAGE_WARNING =
  "La session fonctionne, mais le navigateur n’a pas pu conserver vos identifiants. Une actualisation de page ne pourra pas être restaurée.";

function getInitialRoomCode() {
  const roomCode = new URLSearchParams(window.location.search).get("room");
  return roomCode?.trim().toUpperCase() ?? "";
}

function normalizeNickname(nickname: string) {
  return nickname.trim().replace(/\s+/g, " ");
}

function validateNickname(nickname: string) {
  if (nickname.length < 2 || nickname.length > 20) {
    return "Le pseudonyme doit contenir entre 2 et 20 caractères.";
  }

  if (/\p{Cc}/u.test(nickname)) {
    return "Le pseudonyme contient un caractère non autorisé.";
  }

  return null;
}

function validateRoomCode(roomCode: string) {
  return /^[A-HJ-NP-Z2-9]{5}$/.test(roomCode)
    ? null
    : "Le code de la partie doit contenir 5 lettres ou chiffres.";
}

export function didPublicTurnChange(previousTurnId: string | null, nextTurnId: string | null) {
  return previousTurnId !== nextTurnId;
}

export function didPublicGameChange(previousGameId: string | null, nextGameId: string | null) {
  return previousGameId !== nextGameId;
}

export interface ClientGameActionContext {
  roomCode: string;
  gameId: string;
  turnId: string;
  phase: GamePhase;
}

export function getPublicGameActionContext(
  room: PublicRoomState | null,
): ClientGameActionContext | null {
  if (room === null || room.game === null) {
    return null;
  }

  return {
    roomCode: room.code,
    gameId: room.game.gameId,
    turnId: room.game.turnId,
    phase: room.game.phase,
  };
}

export function isGameActionContextCurrent(
  expected: ClientGameActionContext,
  current: ClientGameActionContext | null,
) {
  return (
    current !== null &&
    expected.roomCode === current.roomCode &&
    expected.gameId === current.gameId &&
    expected.turnId === current.turnId &&
    expected.phase === current.phase
  );
}

export function isTurnSecretForActiveDrawer(
  payload: TurnSecretPayload,
  context: {
    roomCode: string | null;
    gameId: string | null;
    turnId: string | null;
    playerId: string | null;
  },
) {
  return (
    context.playerId !== null &&
    context.roomCode !== null &&
    context.gameId !== null &&
    context.turnId !== null &&
    payload.roomCode === context.roomCode &&
    payload.gameId === context.gameId &&
    payload.turnId === context.turnId &&
    payload.drawerPlayerId === context.playerId &&
    Number.isInteger(payload.secretLevel) &&
    payload.secretLevel >= 1 &&
    payload.secretLevel <= 10
  );
}

export function createSubmitGuessPayload(turnId: string, value: GuessValue): SubmitGuessPayload {
  return { turnId, value };
}

export function buildCreateRoomPayload(
  nickname: string,
  clientInstanceId: string,
): CreateRoomPayload {
  return { nickname, clientInstanceId };
}

export function buildJoinRoomPayload(
  nickname: string,
  roomCode: string,
  clientInstanceId: string,
): JoinRoomPayload {
  return { nickname, roomCode, clientInstanceId };
}

export function buildRestoreSessionPayload(
  session: StoredPlayerSession,
  clientInstanceId: string,
): RestoreSessionPayload {
  return { ...session, clientInstanceId };
}

export function isAutomaticSessionRestoreRetryable(code: string) {
  return code === "INTERNAL_ERROR";
}

export function shouldFailManualRestoreOnConnectError(
  isManualRestoreInFlight: boolean,
  isRestoreAttemptInFlight: boolean,
) {
  return isManualRestoreInFlight && !isRestoreAttemptInFlight;
}

export function getSessionRestoreRetryDelay(retryIndex: number) {
  if (!Number.isInteger(retryIndex) || retryIndex < 0) {
    return null;
  }

  return SESSION_RESTORE_RETRY_DELAYS_MS[retryIndex] ?? null;
}

function isGuessValue(value: unknown): value is GuessValue {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function isPermanentSessionRestoreError(code: string) {
  return (
    code === "INVALID_SESSION" ||
    code === "SESSION_EXPIRED" ||
    code === "ROOM_NOT_FOUND" ||
    code === "PLAYER_NOT_FOUND"
  );
}

export function useRoomSession() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState(getInitialRoomCode);
  const [session, setSession] = useState<ClientRoomSession>(EMPTY_SESSION);
  const clientInstanceIdRef = useRef<string | null>(null);
  if (clientInstanceIdRef.current === null) {
    clientInstanceIdRef.current = getOrCreateClientInstanceId();
  }
  const clientInstanceId = clientInstanceIdRef.current;
  const storedSessionRef = useRef<StoredPlayerSession | null>(null);
  const storedSessionWasReadRef = useRef(false);
  if (!storedSessionWasReadRef.current) {
    storedSessionRef.current = readStoredSession();
    if (storedSessionRef.current === null) {
      clearStoredDrawingDraft();
      clearStoredGuessDraft();
    }
    storedSessionWasReadRef.current = true;
  }
  const currentPlayerIdRef = useRef<string | null>(null);
  const currentRoomCodeRef = useRef<string | null>(null);
  const currentGameIdRef = useRef<string | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const currentGamePhaseRef = useRef<GamePhase | null>(null);
  const attachedSocketIdRef = useRef<string | null>(null);
  const restoreActionTokenRef = useRef(0);
  const restoreRetryTimerRef = useRef<number | null>(null);
  const restoreRetryIndexRef = useRef(0);
  const restoreAttemptInFlightRef = useRef(false);
  const restoreSuppressedRef = useRef(false);
  const manualRestoreGateRef = useRef<ManualSessionRestoreGate | null>(null);
  if (manualRestoreGateRef.current === null) {
    manualRestoreGateRef.current = createManualSessionRestoreGate();
  }
  const [gameSecrets, setGameSecrets] = useState<ClientGameSecrets>(EMPTY_GAME_SECRETS);
  const [guessState, setGuessState] = useState<ClientGuessState>(EMPTY_GUESS_STATE);
  const guessStateRef = useRef<ClientGuessState>(EMPTY_GUESS_STATE);
  const guessActionTokenRef = useRef(0);
  const [pendingAction, setPendingAction] = useState<PendingRoomAction>(null);
  const pendingActionRef = useRef<PendingRoomAction>(null);
  const actionTokenRef = useRef(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ClientConnectionStatus>(() =>
    storedSessionRef.current === null
      ? socket.connected
        ? "connected"
        : "connecting"
      : "restoring",
  );
  const connectionStatusRef = useRef<ClientConnectionStatus>(
    storedSessionRef.current === null
      ? socket.connected
        ? "connected"
        : "connecting"
      : "restoring",
  );
  const [connectionAnnouncement, setConnectionAnnouncement] = useState<string | null>(
    storedSessionRef.current === null ? null : "Restauration de votre session en cours.",
  );
  const [isRetryingSessionRestore, setIsRetryingSessionRestore] = useState(false);

  const updateGuessState = (
    update: ClientGuessState | ((currentState: ClientGuessState) => ClientGuessState),
  ) => {
    const nextState = typeof update === "function" ? update(guessStateRef.current) : update;

    guessStateRef.current = nextState;
    setGuessState(nextState);
  };

  const resetGuessState = () => {
    guessActionTokenRef.current += 1;
    updateGuessState(EMPTY_GUESS_STATE);
  };

  const updateConnectionStatus = (status: ClientConnectionStatus) => {
    connectionStatusRef.current = status;
    setConnectionStatus(status);
  };

  const clearRestoreRetryTimer = () => {
    if (restoreRetryTimerRef.current !== null) {
      window.clearTimeout(restoreRetryTimerRef.current);
      restoreRetryTimerRef.current = null;
    }
  };

  const finishManualRestore = (updateState = true) => {
    manualRestoreGateRef.current?.finish();
    if (updateState) {
      setIsRetryingSessionRestore(false);
    }
  };

  const stopRestoreSequence = (updateManualState = true, preserveManualAttempt = false) => {
    restoreActionTokenRef.current += 1;
    restoreAttemptInFlightRef.current = false;
    restoreRetryIndexRef.current = 0;
    clearRestoreRetryTimer();
    if (!preserveManualAttempt) {
      finishManualRestore(updateManualState);
    }
  };

  const clearPersistedPrivateState = () => {
    clearStoredDrawingDraft();
    clearStoredGuessDraft();
  };

  const clearPersistedSession = () => {
    clearStoredSession();
    storedSessionRef.current = null;
    setStorageWarning(null);
  };

  const storeSessionCredentials = (
    credentials: PlayerSessionCredentials,
  ): "persisted" | "memory-only" | null => {
    const storedCredentials = parseStoredSession(credentials);
    if (storedCredentials === null) {
      return null;
    }

    storedSessionRef.current = storedCredentials;
    if (writeStoredSession(credentials)) {
      return "persisted";
    }

    clearStoredSession();
    return "memory-only";
  };

  const updatePendingAction = (action: PendingRoomAction) => {
    pendingActionRef.current = action;
    setPendingAction(action);
  };

  const clearPendingAction = (invalidateAcknowledgement = false) => {
    if (invalidateAcknowledgement) {
      actionTokenRef.current += 1;
    }

    updatePendingAction(null);
  };

  const beginAction = (action: Exclude<PendingRoomAction, null>) => {
    actionTokenRef.current += 1;
    updatePendingAction(action);
    return actionTokenRef.current;
  };

  const clearTrackedGameContext = () => {
    currentGameIdRef.current = null;
    currentTurnIdRef.current = null;
    currentGamePhaseRef.current = null;
  };

  const clearTrackedSessionContext = () => {
    currentPlayerIdRef.current = null;
    currentRoomCodeRef.current = null;
    clearTrackedGameContext();
  };

  const syncTrackedRoomContext = (room: PublicRoomState) => {
    currentRoomCodeRef.current = room.code;
    currentGameIdRef.current = room.game?.gameId ?? null;
    currentTurnIdRef.current = room.game?.turnId ?? null;
    currentGamePhaseRef.current = room.game?.phase ?? null;
  };

  const reconcileStoredPrivateState = (room: PublicRoomState, playerId: string) => {
    const game = room.game;
    const drawingDraft = readStoredDrawingDraft();
    if (
      drawingDraft !== null &&
      (game === null ||
        game.phase !== "DRAWING" ||
        game.drawing === null ||
        game.drawing.submittedPlayerIds.includes(playerId) ||
        !matchesDrawingDraftContext(drawingDraft, {
          roomCode: room.code,
          gameId: game.gameId,
          turnId: game.turnId,
          playerId,
        }))
    ) {
      clearStoredDrawingDraft();
    }

    const guessDraft = readStoredGuessDraft();
    if (
      guessDraft !== null &&
      (game === null ||
        game.phase !== "VOTING" ||
        game.currentDrawer?.id === playerId ||
        !matchesGuessDraftContext(guessDraft, {
          roomCode: room.code,
          gameId: game.gameId,
          turnId: game.turnId,
          playerId,
        }))
    ) {
      clearStoredGuessDraft();
    }
  };

  const getTrackedGameActionContext = (): ClientGameActionContext | null => {
    if (
      currentRoomCodeRef.current === null ||
      currentGameIdRef.current === null ||
      currentTurnIdRef.current === null ||
      currentGamePhaseRef.current === null
    ) {
      return null;
    }

    return {
      roomCode: currentRoomCodeRef.current,
      gameId: currentGameIdRef.current,
      turnId: currentTurnIdRef.current,
      phase: currentGamePhaseRef.current,
    };
  };

  const applyRoomState = (room: PublicRoomState) => {
    const currentPlayerId = currentPlayerIdRef.current;

    if (currentPlayerId === null) {
      return;
    }

    const currentPlayerIsPresent = room.players.some((player) => player.id === currentPlayerId);

    if (!currentPlayerIsPresent) {
      stopRestoreSequence();
      clearTrackedSessionContext();
      clearPendingAction(true);
      attachedSocketIdRef.current = null;
      clearPersistedPrivateState();
      clearPersistedSession();
      setGameSecrets(EMPTY_GAME_SECRETS);
      resetGuessState();
      setNoticeMessage(null);
      setErrorMessage("Vous ne faites plus partie de ce salon. Vous pouvez en rejoindre un autre.");
      setSession(EMPTY_SESSION);
      return;
    }

    const previousGameId = currentGameIdRef.current;
    const previousTurnId = currentTurnIdRef.current;
    const previousPhase = currentGamePhaseRef.current;
    const nextGame = room.game;
    const nextGameId = nextGame?.gameId ?? null;
    const nextTurnId = nextGame?.turnId ?? null;
    const nextPhase = nextGame?.phase ?? null;
    const gameChanged = didPublicGameChange(previousGameId, nextGameId);
    const turnChanged = didPublicTurnChange(previousTurnId, nextTurnId);
    const returnedToLobbyAfterFinished =
      previousGameId !== null && previousPhase === "FINISHED" && nextGame === null;

    syncTrackedRoomContext(room);
    reconcileStoredPrivateState(room, currentPlayerId);

    const currentPendingAction = pendingActionRef.current;
    const pendingContextEnded =
      ((currentPendingAction === "ready" || currentPendingAction === "start") &&
        nextGame !== null) ||
      (currentPendingAction === "submitDrawing" &&
        (gameChanged ||
          turnChanged ||
          nextPhase !== "DRAWING" ||
          nextGame?.drawing?.submittedPlayerIds.includes(currentPlayerId) === true)) ||
      (currentPendingAction === "continue" &&
        (gameChanged || turnChanged || nextPhase !== "REVEAL")) ||
      (currentPendingAction === "rematch" && (gameChanged || nextPhase !== "FINISHED"));

    if (pendingContextEnded) {
      clearPendingAction(true);
    }

    if (
      gameChanged ||
      turnChanged ||
      nextGame === null ||
      (nextGame.phase !== "ROUND_INTRO" && nextGame.phase !== "DRAWING")
    ) {
      setGameSecrets(EMPTY_GAME_SECRETS);
    }

    const shouldKeepGuessState =
      !gameChanged &&
      !turnChanged &&
      nextGame !== null &&
      nextGame.phase === "VOTING" &&
      nextGame.currentDrawer?.id !== currentPlayerId;

    if (!shouldKeepGuessState) {
      resetGuessState();
    }

    if (returnedToLobbyAfterFinished) {
      setErrorMessage(null);
      setNoticeMessage(REMATCH_READY_NOTICE);
    } else if (nextGame !== null) {
      setNoticeMessage(null);
      setErrorMessage(null);
    }

    setSession({ currentPlayerId, room });
  };

  const resetClientSessionAfterRestoreFailure = (message: string) => {
    stopRestoreSequence();
    clearTrackedSessionContext();
    clearPendingAction(true);
    attachedSocketIdRef.current = null;
    setGameSecrets(EMPTY_GAME_SECRETS);
    resetGuessState();
    setNoticeMessage(null);
    setSession(EMPTY_SESSION);
    setErrorMessage(message);
    setConnectionAnnouncement(message);
    updateConnectionStatus("restore-failed");
    restoreSuppressedRef.current = true;
    clearPersistedPrivateState();
    clearPersistedSession();
  };

  const pauseClientSessionAfterRestoreFailure = (message: string) => {
    stopRestoreSequence();
    clearPendingAction(true);
    attachedSocketIdRef.current = null;
    restoreSuppressedRef.current = true;

    socket.disconnect();

    setErrorMessage(message);
    setConnectionAnnouncement(message);
    updateConnectionStatus("restore-failed");
  };

  const applyRestoredPrivateState = (data: RestoreSessionSuccessData) => {
    const playerId = data.session.playerId;
    const game = data.room.game;
    const privateState = data.privateState;
    const privateContextMatches =
      game !== null && privateState.gameId === game.gameId && privateState.turnId === game.turnId;

    if (
      privateContextMatches &&
      (game.phase === "ROUND_INTRO" || game.phase === "DRAWING") &&
      isGuessValue(privateState.secretLevel) &&
      privateState.prompt !== null
    ) {
      setGameSecrets({
        gameId: game.gameId,
        turnId: game.turnId,
        secretLevel: privateState.secretLevel,
        prompt: privateState.prompt,
      });
    } else {
      setGameSecrets(EMPTY_GAME_SECRETS);
    }

    if (privateContextMatches && game.phase === "VOTING" && game.currentDrawer?.id !== playerId) {
      if (
        privateState.submittedGuess !== null &&
        isGuessValue(privateState.submittedGuess.value) &&
        Number.isSafeInteger(privateState.submittedGuess.submittedAt) &&
        privateState.submittedGuess.submittedAt >= 0
      ) {
        clearStoredGuessDraft();
        updateGuessState({
          selected: privateState.submittedGuess.value,
          submitted: {
            value: privateState.submittedGuess.value,
            submittedAt: privateState.submittedGuess.submittedAt,
          },
          isSubmitting: false,
          error: null,
        });
        return;
      }

      const storedGuess = readStoredGuessDraft();
      const selectedGuess =
        storedGuess !== null &&
        matchesGuessDraftContext(storedGuess, {
          roomCode: data.room.code,
          gameId: game.gameId,
          turnId: game.turnId,
          playerId,
        })
          ? storedGuess.value
          : guessStateRef.current.selected;

      updateGuessState({
        selected: selectedGuess,
        submitted: null,
        isSubmitting: false,
        error: null,
      });
      return;
    }

    resetGuessState();
  };

  const acceptRestoredSession = (data: RestoreSessionSuccessData) => {
    const player = data.room.players.find((candidate) => candidate.id === data.session.playerId);
    if (data.room.code !== data.session.roomCode || player === undefined || !player.isConnected) {
      resetClientSessionAfterRestoreFailure(
        "La session restaurée contient des données incohérentes.",
      );
      return;
    }

    const credentialStorage = storeSessionCredentials(data.session);
    if (credentialStorage === null) {
      resetClientSessionAfterRestoreFailure("Les identifiants de session reçus sont invalides.");
      return;
    }
    currentPlayerIdRef.current = data.session.playerId;
    setRoomCode(data.session.roomCode);
    setNickname(player.nickname);
    applyRoomState(data.room);
    applyRestoredPrivateState(data);
    attachedSocketIdRef.current = socket.id ?? null;
    stopRestoreSequence();
    restoreSuppressedRef.current = false;
    setStorageWarning(credentialStorage === "memory-only" ? SESSION_STORAGE_WARNING : null);
    setErrorMessage(null);
    setConnectionAnnouncement(SESSION_RESTORED_ANNOUNCEMENT);
    updateConnectionStatus("connected");
  };

  const scheduleTransientRestoreRetry = (failureMessage: string) => {
    const retryDelay = getSessionRestoreRetryDelay(restoreRetryIndexRef.current);
    if (retryDelay === null) {
      pauseClientSessionAfterRestoreFailure(failureMessage);
      return;
    }

    restoreRetryIndexRef.current += 1;
    setConnectionAnnouncement(
      "La restauration prend plus de temps que prévu. Nouvelle tentative en cours.",
    );
    restoreRetryTimerRef.current = window.setTimeout(() => {
      restoreRetryTimerRef.current = null;
      restoreSession();
    }, retryDelay);
  };

  function restoreSession() {
    const storedSession = storedSessionRef.current;
    if (!socket.connected) {
      return;
    }

    if (restoreSuppressedRef.current) {
      return;
    }

    if (storedSession === null) {
      stopRestoreSequence();
      attachedSocketIdRef.current = null;
      updateConnectionStatus("connected");
      return;
    }

    if (attachedSocketIdRef.current !== null && attachedSocketIdRef.current === socket.id) {
      stopRestoreSequence();
      updateConnectionStatus("connected");
      return;
    }

    if (restoreAttemptInFlightRef.current) {
      return;
    }

    clearRestoreRetryTimer();
    restoreAttemptInFlightRef.current = true;
    restoreActionTokenRef.current += 1;
    const restoreActionToken = restoreActionTokenRef.current;
    updateConnectionStatus("restoring");
    setConnectionAnnouncement("Restauration de votre session en cours.");

    socket
      .timeout(ACTION_TIMEOUT_MS)
      .emit(
        SOCKET_EVENTS.SESSION_RESTORE,
        buildRestoreSessionPayload(storedSession, clientInstanceId),
        (timeoutError, result) => {
          if (restoreActionToken !== restoreActionTokenRef.current) {
            return;
          }

          restoreAttemptInFlightRef.current = false;
          if (!socket.connected) {
            return;
          }

          if (timeoutError) {
            scheduleTransientRestoreRetry("Impossible de restaurer la session pour le moment.");
            return;
          }

          if (result.success) {
            if (
              result.data.session.roomCode !== storedSession.roomCode ||
              result.data.session.playerId !== storedSession.playerId
            ) {
              resetClientSessionAfterRestoreFailure(
                "La session restaurée ne correspond pas aux identifiants enregistrés.",
              );
              return;
            }

            acceptRestoredSession(result.data);
            return;
          }

          if (isPermanentSessionRestoreError(result.error.code)) {
            resetClientSessionAfterRestoreFailure(result.error.message);
            return;
          }

          if (isAutomaticSessionRestoreRetryable(result.error.code)) {
            scheduleTransientRestoreRetry(result.error.message);
            return;
          }

          pauseClientSessionAfterRestoreFailure(result.error.message);
        },
      );
  }

  const retrySessionRestore = () => {
    const manualRestoreGate = manualRestoreGateRef.current;
    if (
      storedSessionRef.current === null ||
      manualRestoreGate === null ||
      restoreAttemptInFlightRef.current ||
      connectionStatusRef.current !== "restore-failed"
    ) {
      return false;
    }

    if (!manualRestoreGate.begin()) {
      return false;
    }

    stopRestoreSequence(true, true);
    restoreSuppressedRef.current = false;
    attachedSocketIdRef.current = null;
    setIsRetryingSessionRestore(true);
    setErrorMessage(null);
    setConnectionAnnouncement("Restauration de votre session en cours.");
    updateConnectionStatus("restoring");

    if (socket.connected) {
      restoreSession();
      return true;
    }

    socket.connect();
    return true;
  };

  const socketLifecycleHandlersRef = useRef({
    applyRoomState,
    clearPendingAction,
    clearPersistedPrivateState,
    clearRestoreRetryTimer,
    clearTrackedGameContext,
    clearTrackedSessionContext,
    pauseClientSessionAfterRestoreFailure,
    resetGuessState,
    restoreSession,
    stopRestoreSequence,
    updateConnectionStatus,
    updateGuessState,
  });
  socketLifecycleHandlersRef.current = {
    applyRoomState,
    clearPendingAction,
    clearPersistedPrivateState,
    clearRestoreRetryTimer,
    clearTrackedGameContext,
    clearTrackedSessionContext,
    pauseClientSessionAfterRestoreFailure,
    resetGuessState,
    restoreSession,
    stopRestoreSequence,
    updateConnectionStatus,
    updateGuessState,
  };

  useEffect(() => {
    const handleRoomState = (room: PublicRoomState) => {
      socketLifecycleHandlersRef.current.applyRoomState(room);
    };

    const handleTurnSecret = (payload: TurnSecretPayload) => {
      if (
        !isTurnSecretForActiveDrawer(payload, {
          roomCode: currentRoomCodeRef.current,
          gameId: currentGameIdRef.current,
          turnId: currentTurnIdRef.current,
          playerId: currentPlayerIdRef.current,
        })
      ) {
        return;
      }

      setGameSecrets({
        gameId: payload.gameId,
        turnId: payload.turnId,
        secretLevel: payload.secretLevel as GuessValue,
        prompt: payload.prompt,
      });
    };

    const handleGameCancelled = (payload: GameCancelledPayload) => {
      if (currentPlayerIdRef.current === null || currentRoomCodeRef.current === null) {
        return;
      }

      socketLifecycleHandlersRef.current.clearTrackedGameContext();
      socketLifecycleHandlersRef.current.clearPersistedPrivateState();
      setGameSecrets(EMPTY_GAME_SECRETS);
      socketLifecycleHandlersRef.current.resetGuessState();
      setErrorMessage(null);
      setNoticeMessage(payload.message);

      if (pendingActionRef.current !== null) {
        socketLifecycleHandlersRef.current.clearPendingAction(true);
      }
    };

    const handleConnect = () => {
      socketLifecycleHandlersRef.current.restoreSession();
    };

    const handleDisconnect = () => {
      const hadActiveSession = currentPlayerIdRef.current !== null;
      const hadPendingAction = pendingActionRef.current !== null;
      const canRestoreSession = storedSessionRef.current !== null;

      restoreActionTokenRef.current += 1;
      restoreAttemptInFlightRef.current = false;
      socketLifecycleHandlersRef.current.clearRestoreRetryTimer();
      attachedSocketIdRef.current = null;
      socketLifecycleHandlersRef.current.clearPendingAction(true);
      guessActionTokenRef.current += 1;

      if (guessStateRef.current.isSubmitting) {
        socketLifecycleHandlersRef.current.updateGuessState((currentState) => ({
          ...currentState,
          isSubmitting: false,
          error: null,
        }));
      }

      if (hadActiveSession || canRestoreSession) {
        if (restoreSuppressedRef.current) {
          return;
        }
        socketLifecycleHandlersRef.current.updateConnectionStatus("disconnected");
        setConnectionAnnouncement("Connexion interrompue. Tentative de reconnexion en cours.");
        return;
      }

      if (!hadPendingAction) {
        socketLifecycleHandlersRef.current.updateConnectionStatus("connecting");
        return;
      }

      socketLifecycleHandlersRef.current.clearTrackedSessionContext();
      setGameSecrets(EMPTY_GAME_SECRETS);
      socketLifecycleHandlersRef.current.resetGuessState();
      setNoticeMessage(null);
      setErrorMessage("La connexion au serveur a été interrompue avant sa réponse.");
      setSession(EMPTY_SESSION);
      socketLifecycleHandlersRef.current.updateConnectionStatus("connecting");
    };

    const handleConnectError = () => {
      if (
        shouldFailManualRestoreOnConnectError(
          manualRestoreGateRef.current?.isInFlight() === true,
          restoreAttemptInFlightRef.current,
        )
      ) {
        socketLifecycleHandlersRef.current.pauseClientSessionAfterRestoreFailure(
          "Impossible de se reconnecter au serveur pour restaurer la session.",
        );
        return;
      }

      if (currentPlayerIdRef.current !== null || storedSessionRef.current !== null) {
        socketLifecycleHandlersRef.current.updateConnectionStatus("disconnected");
        setConnectionAnnouncement("Connexion interrompue. Tentative de reconnexion en cours.");
      }
    };

    socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
    socket.on(SOCKET_EVENTS.TURN_SECRET, handleTurnSecret);
    socket.on(SOCKET_EVENTS.GAME_CANCELLED, handleGameCancelled);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socketLifecycleHandlersRef.current.stopRestoreSequence(false);
      socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
      socket.off(SOCKET_EVENTS.TURN_SECRET, handleTurnSecret);
      socket.off(SOCKET_EVENTS.GAME_CANCELLED, handleGameCancelled);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
    };
  }, []);

  const reconnectForAuthoritativeSessionState = (announcement: string) => {
    if (currentPlayerIdRef.current === null || storedSessionRef.current === null) {
      return false;
    }

    stopRestoreSequence();
    restoreSuppressedRef.current = false;
    attachedSocketIdRef.current = null;

    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();

    setErrorMessage(null);
    setConnectionAnnouncement(announcement);
    updateConnectionStatus("disconnected");
    return true;
  };

  const resetAfterUncertainAction = (actionToken: number) => {
    if (actionToken !== actionTokenRef.current) {
      return;
    }

    clearPendingAction(true);
    if (
      reconnectForAuthoritativeSessionState(
        "La réponse du serveur est incertaine. Restauration de votre session en cours.",
      )
    ) {
      return;
    }

    clearTrackedSessionContext();
    setGameSecrets(EMPTY_GAME_SECRETS);
    resetGuessState();
    setNoticeMessage(null);
    setSession(EMPTY_SESSION);
    setErrorMessage("La réponse du serveur est incertaine. Reconnectez-vous avant de réessayer.");

    if (socket.connected) {
      socket.disconnect();
      socket.connect();
    }
  };

  const ensureSocketIsConnected = () => {
    const hasActiveSession = currentPlayerIdRef.current !== null;
    const storedSessionIsRecovering =
      storedSessionRef.current !== null &&
      (connectionStatusRef.current === "restoring" ||
        connectionStatusRef.current === "disconnected");
    const activeSessionIsAttached =
      !hasActiveSession ||
      (connectionStatusRef.current === "connected" &&
        attachedSocketIdRef.current !== null &&
        attachedSocketIdRef.current === socket.id);

    if (socket.connected && !storedSessionIsRecovering && activeSessionIsAttached) {
      return true;
    }

    setErrorMessage("Connexion au serveur indisponible. Réessayez dans quelques instants.");
    return false;
  };

  const acceptNewRoomSession = (data: RoomSessionData) => {
    const player = data.room.players.find((candidate) => candidate.id === data.session.playerId);
    if (data.room.code !== data.session.roomCode || player === undefined || !player.isConnected) {
      setErrorMessage("Le serveur a renvoyé une session incohérente. Réessayez.");
      return false;
    }

    clearPersistedPrivateState();
    const credentialStorage = storeSessionCredentials(data.session);
    if (credentialStorage === null) {
      setErrorMessage("Le serveur a renvoyé des identifiants de session invalides.");
      return false;
    }
    stopRestoreSequence();
    restoreSuppressedRef.current = false;
    currentPlayerIdRef.current = data.session.playerId;
    attachedSocketIdRef.current = socket.id ?? null;
    setRoomCode(data.session.roomCode);
    setNickname(player.nickname);
    applyRoomState(data.room);
    setStorageWarning(credentialStorage === "memory-only" ? SESSION_STORAGE_WARNING : null);
    setErrorMessage(null);
    setConnectionAnnouncement(null);
    updateConnectionStatus("connected");
    return true;
  };

  const createRoom = () => {
    if (pendingActionRef.current !== null || !ensureSocketIsConnected()) {
      return;
    }

    const normalizedNickname = normalizeNickname(nickname);
    const validationError = validateNickname(normalizedNickname);

    if (validationError !== null) {
      setErrorMessage(validationError);
      return;
    }

    setNickname(normalizedNickname);
    setErrorMessage(null);
    setNoticeMessage(null);
    setGameSecrets(EMPTY_GAME_SECRETS);
    clearTrackedGameContext();
    resetGuessState();
    const actionToken = beginAction("create");

    socket
      .timeout(ACTION_TIMEOUT_MS)
      .emit(
        SOCKET_EVENTS.ROOM_CREATE,
        buildCreateRoomPayload(normalizedNickname, clientInstanceId),
        (timeoutError, result) => {
          if (actionToken !== actionTokenRef.current) {
            return;
          }

          if (timeoutError) {
            resetAfterUncertainAction(actionToken);
            return;
          }

          updatePendingAction(null);

          if (!result.success) {
            setErrorMessage(result.error.message);
            return;
          }

          acceptNewRoomSession(result.data);
        },
      );
  };

  const joinRoom = () => {
    if (pendingActionRef.current !== null || !ensureSocketIsConnected()) {
      return;
    }

    const normalizedNickname = normalizeNickname(nickname);
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const validationError =
      validateNickname(normalizedNickname) ?? validateRoomCode(normalizedRoomCode);

    if (validationError !== null) {
      setErrorMessage(validationError);
      return;
    }

    setNickname(normalizedNickname);
    setRoomCode(normalizedRoomCode);
    setErrorMessage(null);
    setNoticeMessage(null);
    setGameSecrets(EMPTY_GAME_SECRETS);
    clearTrackedGameContext();
    resetGuessState();
    const actionToken = beginAction("join");

    socket
      .timeout(ACTION_TIMEOUT_MS)
      .emit(
        SOCKET_EVENTS.ROOM_JOIN,
        buildJoinRoomPayload(normalizedNickname, normalizedRoomCode, clientInstanceId),
        (timeoutError, result) => {
          if (actionToken !== actionTokenRef.current) {
            return;
          }

          if (timeoutError) {
            resetAfterUncertainAction(actionToken);
            return;
          }

          updatePendingAction(null);

          if (!result.success) {
            setErrorMessage(result.error.message);
            return;
          }

          acceptNewRoomSession(result.data);
        },
      );
  };

  const setReady = (isReady: boolean) => {
    if (pendingActionRef.current !== null || session.room === null || !ensureSocketIsConnected()) {
      return;
    }

    setErrorMessage(null);
    const actionToken = beginAction("ready");

    socket
      .timeout(ACTION_TIMEOUT_MS)
      .emit(SOCKET_EVENTS.PLAYER_SET_READY, { isReady }, (timeoutError, result) => {
        if (actionToken !== actionTokenRef.current) {
          return;
        }

        if (timeoutError) {
          resetAfterUncertainAction(actionToken);
          return;
        }

        updatePendingAction(null);

        if (!result.success) {
          setErrorMessage(result.error.message);
          return;
        }

        applyRoomState(result.data);
      });
  };

  const startGame = () => {
    if (pendingActionRef.current !== null || session.room === null || !ensureSocketIsConnected()) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    resetGuessState();
    const actionToken = beginAction("start");

    socket.timeout(ACTION_TIMEOUT_MS).emit(SOCKET_EVENTS.GAME_START, (timeoutError, result) => {
      if (actionToken !== actionTokenRef.current) {
        return;
      }

      if (timeoutError) {
        resetAfterUncertainAction(actionToken);
        return;
      }

      updatePendingAction(null);

      if (!result.success) {
        setErrorMessage(result.error.message);
        return;
      }

      applyRoomState(result.data.room);
    });
  };

  const continueGame = () => {
    if (pendingActionRef.current !== null || session.room === null || !ensureSocketIsConnected()) {
      return false;
    }

    const game = session.room.game;
    const currentPlayer = session.room.players.find(
      (player) => player.id === session.currentPlayerId,
    );

    if (game === null || game.phase !== "REVEAL") {
      setErrorMessage("La partie ne peut continuer que depuis l’écran de révélation.");
      return false;
    }

    if (currentPlayer === undefined || !currentPlayer.isHost) {
      setErrorMessage("Seul l’hôte peut lancer la suite de la partie.");
      return false;
    }

    const actionContext = getPublicGameActionContext(session.room);
    if (actionContext === null) {
      setErrorMessage("Le contexte de la partie est indisponible.");
      return false;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    const actionToken = beginAction("continue");

    socket.timeout(ACTION_TIMEOUT_MS).emit(SOCKET_EVENTS.GAME_CONTINUE, (timeoutError, result) => {
      if (
        actionToken !== actionTokenRef.current ||
        !isGameActionContextCurrent(actionContext, getTrackedGameActionContext())
      ) {
        return;
      }

      if (timeoutError) {
        actionTokenRef.current += 1;
        updatePendingAction(null);
        setErrorMessage(
          "La réponse du serveur a expiré. Attendez la synchronisation de la partie avant de réessayer.",
        );
        return;
      }

      if (!result.success) {
        updatePendingAction(null);
        setErrorMessage(result.error.message);
        return;
      }

      updatePendingAction(null);
      clearPersistedPrivateState();
      applyRoomState(result.data.room);
    });

    return true;
  };

  const requestRematch = () => {
    if (pendingActionRef.current !== null || session.room === null || !ensureSocketIsConnected()) {
      return false;
    }

    const game = session.room.game;
    const currentPlayer = session.room.players.find(
      (player) => player.id === session.currentPlayerId,
    );

    if (game === null || game.phase !== "FINISHED") {
      setErrorMessage("Une revanche ne peut être proposée qu’après la fin de la partie.");
      return false;
    }

    if (currentPlayer === undefined || !currentPlayer.isHost) {
      setErrorMessage("Seul l’hôte peut proposer une revanche.");
      return false;
    }

    const actionContext = getPublicGameActionContext(session.room);
    if (actionContext === null) {
      setErrorMessage("Le contexte de la partie est indisponible.");
      return false;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    const actionToken = beginAction("rematch");

    socket
      .timeout(ACTION_TIMEOUT_MS)
      .emit(SOCKET_EVENTS.GAME_REQUEST_REMATCH, (timeoutError, result) => {
        if (
          actionToken !== actionTokenRef.current ||
          !isGameActionContextCurrent(actionContext, getTrackedGameActionContext())
        ) {
          return;
        }

        if (timeoutError) {
          actionTokenRef.current += 1;
          updatePendingAction(null);
          setErrorMessage(
            "La réponse du serveur a expiré. Attendez la synchronisation du salon avant de reproposer une revanche.",
          );
          return;
        }

        if (!result.success) {
          updatePendingAction(null);
          setErrorMessage(result.error.message);
          return;
        }

        updatePendingAction(null);
        clearPersistedPrivateState();
        applyRoomState(result.data.room);
      });

    return true;
  };

  const submitDrawing = (drawing: DrawingDocument) => {
    if (pendingActionRef.current !== null || session.room === null || !ensureSocketIsConnected()) {
      return false;
    }

    const game = session.room.game;
    if (game === null) {
      setErrorMessage("Aucune partie n’est en cours.");
      return false;
    }

    if (game.phase !== "DRAWING") {
      setErrorMessage("Le dessin ne peut pas être envoyé pendant cette phase.");
      return false;
    }

    if (session.currentPlayerId === null) {
      setErrorMessage("Votre session est indisponible.");
      return false;
    }

    if (game.drawing?.submittedPlayerIds.includes(session.currentPlayerId) === true) {
      setErrorMessage("Votre dessin a déjà été validé.");
      return false;
    }

    if (drawing.strokes.length === 0) {
      setErrorMessage("Le dessin est vide.");
      return false;
    }

    const actionContext = getPublicGameActionContext(session.room);
    if (actionContext === null) {
      setErrorMessage("Le contexte du tour est indisponible.");
      return false;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    const actionToken = beginAction("submitDrawing");

    socket
      .timeout(ACTION_TIMEOUT_MS)
      .emit(SOCKET_EVENTS.DRAWING_SUBMIT, { drawing }, (timeoutError, result) => {
        if (
          actionToken !== actionTokenRef.current ||
          !isGameActionContextCurrent(actionContext, getTrackedGameActionContext())
        ) {
          return;
        }

        if (timeoutError) {
          actionTokenRef.current += 1;
          updatePendingAction(null);
          setErrorMessage(
            "La réponse du serveur a expiré. Votre dessin est conservé ; attendez la synchronisation du salon avant de réessayer.",
          );
          return;
        }

        if (!result.success) {
          updatePendingAction(null);
          setErrorMessage(result.error.message);
          return;
        }

        clearStoredDrawingDraft();
        // En cas de succès, le serveur diffuse room:state. Cet événement est le
        // seul à faire quitter DRAWING ; on garde donc l'action bloquée jusque-là.
      });

    return true;
  };

  const selectGuess = (value: GuessValue) => {
    const game = session.room?.game ?? null;

    if (
      game === null ||
      game.phase !== "VOTING" ||
      session.currentPlayerId === null ||
      game.currentDrawer?.id === session.currentPlayerId ||
      guessStateRef.current.submitted !== null ||
      guessStateRef.current.isSubmitting ||
      !socket.connected ||
      connectionStatusRef.current !== "connected" ||
      attachedSocketIdRef.current !== socket.id
    ) {
      return;
    }

    updateGuessState((currentState) => ({
      ...currentState,
      selected: value,
      error: null,
    }));
    writeStoredGuessDraft({
      roomCode: session.room?.code ?? "",
      gameId: game.gameId,
      turnId: game.turnId,
      playerId: session.currentPlayerId,
      value,
      savedAt: Date.now(),
    });
  };

  const submitGuess = () => {
    const game = session.room?.game ?? null;
    const currentGuessState = guessStateRef.current;

    if (pendingActionRef.current !== null) {
      return false;
    }

    if (
      !socket.connected ||
      connectionStatusRef.current !== "connected" ||
      attachedSocketIdRef.current !== socket.id
    ) {
      updateGuessState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: "Connexion au serveur indisponible. Votre estimation n’a pas été envoyée.",
      }));
      return false;
    }

    if (game === null || game.phase !== "VOTING") {
      updateGuessState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: "Le vote n’est plus ouvert.",
      }));
      return false;
    }

    if (session.currentPlayerId === null || game.currentDrawer?.id === session.currentPlayerId) {
      updateGuessState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: "Vous ne pouvez pas voter pour votre propre dessin.",
      }));
      return false;
    }

    if (currentGuessState.submitted !== null) {
      updateGuessState((currentState) => ({
        ...currentState,
        error: "Votre estimation a déjà été envoyée.",
      }));
      return false;
    }

    if (currentGuessState.selected === null) {
      updateGuessState((currentState) => ({
        ...currentState,
        error: "Choisissez un niveau entre 1 et 10 avant de valider.",
      }));
      return false;
    }

    const selectedValue = currentGuessState.selected;
    const actionContext = session.room === null ? null : getPublicGameActionContext(session.room);
    if (actionContext === null) {
      updateGuessState((currentState) => ({
        ...currentState,
        isSubmitting: false,
        error: "Le contexte du vote est indisponible.",
      }));
      return false;
    }

    guessActionTokenRef.current += 1;
    const guessActionToken = guessActionTokenRef.current;

    updateGuessState((currentState) => ({
      ...currentState,
      isSubmitting: true,
      error: null,
    }));

    socket
      .timeout(ACTION_TIMEOUT_MS)
      .emit(
        SOCKET_EVENTS.GUESS_SUBMIT,
        createSubmitGuessPayload(game.turnId, selectedValue),
        (timeoutError, result) => {
          if (
            guessActionToken !== guessActionTokenRef.current ||
            !isGameActionContextCurrent(actionContext, getTrackedGameActionContext())
          ) {
            return;
          }

          if (timeoutError) {
            updateGuessState((currentState) => ({
              ...currentState,
              isSubmitting: false,
              error: null,
            }));

            if (
              reconnectForAuthoritativeSessionState(
                "La réponse du vote est incertaine. Vérification de votre estimation auprès du serveur.",
              )
            ) {
              return;
            }

            updateGuessState((currentState) => ({
              ...currentState,
              error:
                "La réponse du serveur a expiré. Votre sélection est conservée ; vérifiez la progression avant de réessayer.",
            }));
            return;
          }

          if (!result.success) {
            updateGuessState((currentState) => ({
              ...currentState,
              isSubmitting: false,
              error: result.error.message,
            }));
            return;
          }

          updateGuessState({
            selected: result.data.value,
            submitted: result.data,
            isSubmitting: false,
            error: null,
          });
          clearStoredGuessDraft();
        },
      );

    return true;
  };

  const leaveRoom = () => {
    if (
      pendingActionRef.current !== null ||
      guessStateRef.current.isSubmitting ||
      session.room === null ||
      !ensureSocketIsConnected()
    ) {
      return;
    }

    setErrorMessage(null);
    const actionToken = beginAction("leave");

    socket.timeout(ACTION_TIMEOUT_MS).emit(SOCKET_EVENTS.ROOM_LEAVE, (timeoutError, result) => {
      if (actionToken !== actionTokenRef.current) {
        return;
      }

      if (timeoutError) {
        resetAfterUncertainAction(actionToken);
        return;
      }

      updatePendingAction(null);

      if (!result.success) {
        setErrorMessage(result.error.message);
        return;
      }

      setErrorMessage(null);
      stopRestoreSequence();
      clearTrackedSessionContext();
      attachedSocketIdRef.current = null;
      clearPersistedPrivateState();
      clearPersistedSession();
      setGameSecrets(EMPTY_GAME_SECRETS);
      resetGuessState();
      setNoticeMessage(null);
      setSession(EMPTY_SESSION);
      setConnectionAnnouncement(null);
      updateConnectionStatus("connected");
    });
  };

  return {
    nickname,
    roomCode,
    session,
    gameSecrets,
    guessState,
    pendingAction,
    errorMessage: errorMessage ?? storageWarning,
    noticeMessage,
    connectionStatus,
    connectionAnnouncement,
    isRetryingSessionRestore,
    hasStoredSession: storedSessionRef.current !== null,
    isConnectionBlocked:
      connectionStatus === "disconnected" ||
      connectionStatus === "restoring" ||
      (connectionStatus === "restore-failed" && storedSessionRef.current !== null),
    setNickname,
    setRoomCode: (value: string) => setRoomCode(value.toUpperCase()),
    createRoom,
    joinRoom,
    setReady,
    startGame,
    continueGame,
    requestRematch,
    submitDrawing,
    selectGuess,
    submitGuess,
    leaveRoom,
    retrySessionRestore,
  };
}
