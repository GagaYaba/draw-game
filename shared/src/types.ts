import { SOCKET_EVENTS } from "./events.js";
import type { DrawingDocument } from "./drawing.js";

export interface ClientPingPayload {
  sentAt: number;
}

export interface ServerPongPayload {
  sentAt: number;
  receivedAt: number;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  reconnectDeadline: number | null;
  score: number;
}

export type GamePhase = "LOBBY" | "ROUND_INTRO" | "DRAWING" | "VOTING" | "REVEAL" | "FINISHED";

export type GuessValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface PublicSubmittedDrawing {
  document: DrawingDocument;
  submittedAt: number;
}

export interface PublicGamePrompt {
  id: string;
  statement: string;
  lowLabel: string;
  highLabel: string;
}

export interface PublicVotingState {
  eligibleVoterCount: number;
  submittedGuessCount: number;
}

export interface PublicGuessResult {
  player: {
    id: string;
    nickname: string;
  };
  value: GuessValue;
  distance: number;
  pointsEarned: number;
  totalScore: number;
}

/** Résultat de l'auteur du dessin révélé. */
export interface PublicDrawerResult {
  player: {
    id: string;
    nickname: string;
  };
  /** Écart moyen entre les estimations des votants et le niveau secret. */
  averageDistance: number;
  pointsEarned: number;
  totalScore: number;
}

/** Suite de la partie après la révélation d'un dessin. */
export type RevealNextStep = "NEXT_DRAWING" | "NEXT_ROUND" | "FINAL";

export interface PublicLeaderboardEntry {
  rank: number;
  player: {
    id: string;
    nickname: string;
  };
  score: number;
}

export interface PublicRevealState {
  secretLevel: GuessValue;
  guesses: PublicGuessResult[];
  drawerResult: PublicDrawerResult;
  leaderboard: PublicLeaderboardEntry[];
  nextStep: RevealNextStep;
}

/** Avancement du dessin simultané : joueurs ayant déjà validé leur dessin. */
export interface PublicDrawingProgress {
  submittedPlayerIds: string[];
}

export interface PublicFinishedState {
  leaderboard: PublicLeaderboardEntry[];
  winners: Array<{
    id: string;
    nickname: string;
    score: number;
  }>;
  completedRounds: number;
  completedTurns: number;
}

export interface PublicGameState {
  gameId: string;
  phase: GamePhase;
  turnId: string;
  totalRounds: number;
  currentRound: number;
  currentTurnNumber: number;
  totalTurns: number;
  /** Auteur du dessin présenté ; absent tant que tous les joueurs dessinent. */
  currentDrawer: {
    id: string;
    nickname: string;
  } | null;
  /** Consigne du dessin présenté ; chaque joueur reçoit la sienne en privé pendant le dessin. */
  prompt: PublicGamePrompt | null;
  phaseEndsAt: number | null;
  drawing: PublicDrawingProgress | null;
  submittedDrawing: PublicSubmittedDrawing | null;
  voting: PublicVotingState | null;
  reveal: PublicRevealState | null;
  finished: PublicFinishedState | null;
}

export interface PublicRoomState {
  code: string;
  players: PublicPlayer[];
  playerCount: number;
  maxPlayers: number;
  minimumPlayersToStart: number;
  allPlayersReady: boolean;
  canStart: boolean;
  game: PublicGameState | null;
}

export interface CreateRoomPayload {
  nickname: string;
  clientInstanceId: string;
}

export interface JoinRoomPayload {
  nickname: string;
  roomCode: string;
  clientInstanceId: string;
}

export interface RestoreSessionPayload {
  roomCode: string;
  playerId: string;
  token: string;
  clientInstanceId: string;
}

export interface SetPlayerReadyPayload {
  isReady: boolean;
}

export interface SubmitDrawingPayload {
  drawing: DrawingDocument;
}

export interface SubmitDrawingSuccessData {
  room: PublicRoomState;
}

export interface SubmitGuessPayload {
  turnId: string;
  value: number;
}

export interface SubmitGuessSuccessData {
  value: GuessValue;
  submittedAt: number;
}

export type GuessErrorCode =
  | "GAME_NOT_STARTED"
  | "NOT_VOTING_PHASE"
  | "DRAWER_CANNOT_GUESS"
  | "PLAYER_NOT_ELIGIBLE"
  | "STALE_TURN"
  | "GUESS_ALREADY_SUBMITTED"
  | "INVALID_GUESS";

export type ContinueGameErrorCode =
  | "INVALID_GAME_CONTINUE_REQUEST"
  | "NOT_HOST"
  | "GAME_NOT_STARTED"
  | "NOT_REVEAL_PHASE"
  | "GAME_ALREADY_FINISHED";

export type RematchErrorCode = "GAME_NOT_STARTED" | "GAME_NOT_FINISHED" | "NOT_HOST";

export type SessionErrorCode =
  | "INVALID_SESSION"
  | "SESSION_EXPIRED"
  | "ROOM_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "SESSION_ALREADY_ACTIVE";

export type RoomErrorCode =
  | "INVALID_NICKNAME"
  | "INVALID_ROOM_CODE"
  | "INVALID_READY_STATUS"
  | "ROOM_FULL"
  | "NICKNAME_ALREADY_USED"
  | "ALREADY_IN_ROOM"
  | "NOT_IN_ROOM"
  | "INVALID_GAME_START_REQUEST"
  | "INVALID_GAME_CONTINUE_REQUEST"
  | "INVALID_GAME_REMATCH_REQUEST"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "PLAYERS_NOT_READY"
  | "GAME_ALREADY_STARTED"
  | "GAME_NOT_IN_LOBBY"
  | "GAME_NOT_FINISHED"
  | "NOT_REVEAL_PHASE"
  | "GAME_ALREADY_FINISHED"
  | "NOT_DRAWING_PHASE"
  | "NOT_CURRENT_DRAWER"
  | "EMPTY_DRAWING"
  | "INVALID_DRAWING"
  | "DRAWING_TOO_LARGE"
  | "DRAWING_ALREADY_SUBMITTED"
  | GuessErrorCode
  | SessionErrorCode
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ActionResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: RoomErrorCode;
        message: string;
      };
    };

export interface PlayerSessionCredentials {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface RoomSessionData {
  room: PublicRoomState;
  session: PlayerSessionCredentials;
}

export interface RestoredPrivatePlayerState {
  gameId: string | null;
  turnId: string | null;
  secretLevel: GuessValue | null;
  prompt: PublicGamePrompt | null;
  submittedGuess: SubmitGuessSuccessData | null;
  isCurrentDrawer: boolean;
}

export interface RestoreSessionSuccessData extends RoomSessionData {
  privateState: RestoredPrivatePlayerState;
}

export interface StartGameSuccessData {
  room: PublicRoomState;
}

export interface ContinueGameSuccessData {
  room: PublicRoomState;
}

export interface RequestRematchSuccessData {
  room: PublicRoomState;
}

/** Consigne et niveau secret propres à un joueur, envoyés en privé au début de chaque manche. */
export interface TurnSecretPayload {
  roomCode: string;
  gameId: string;
  /** Identifiant de la manche en cours. */
  turnId: string;
  round: number;
  drawerPlayerId: string;
  secretLevel: number;
  prompt: PublicGamePrompt;
}

export type GameCancellationReason = "PLAYER_LEFT" | "PLAYER_DISCONNECTED" | "RECONNECT_TIMEOUT";

export interface GameCancelledPayload {
  reason: GameCancellationReason;
  message: string;
}

export type ActionAcknowledgement<T> = (result: ActionResult<T>) => void;

export interface ClientToServerEvents {
  [SOCKET_EVENTS.CLIENT_PING]: (payload: ClientPingPayload) => void;
  [SOCKET_EVENTS.ROOM_CREATE]: (
    payload: CreateRoomPayload,
    acknowledge: ActionAcknowledgement<RoomSessionData>,
  ) => void;
  [SOCKET_EVENTS.ROOM_JOIN]: (
    payload: JoinRoomPayload,
    acknowledge: ActionAcknowledgement<RoomSessionData>,
  ) => void;
  [SOCKET_EVENTS.SESSION_RESTORE]: (
    payload: RestoreSessionPayload,
    acknowledge: ActionAcknowledgement<RestoreSessionSuccessData>,
  ) => void;
  [SOCKET_EVENTS.ROOM_LEAVE]: (acknowledge: ActionAcknowledgement<null>) => void;
  [SOCKET_EVENTS.PLAYER_SET_READY]: (
    payload: SetPlayerReadyPayload,
    acknowledge: ActionAcknowledgement<PublicRoomState>,
  ) => void;
  [SOCKET_EVENTS.GAME_START]: (acknowledge: ActionAcknowledgement<StartGameSuccessData>) => void;
  [SOCKET_EVENTS.GAME_CONTINUE]: (
    acknowledge: ActionAcknowledgement<ContinueGameSuccessData>,
  ) => void;
  [SOCKET_EVENTS.GAME_REQUEST_REMATCH]: (
    acknowledge: ActionAcknowledgement<RequestRematchSuccessData>,
  ) => void;
  [SOCKET_EVENTS.DRAWING_SUBMIT]: (
    payload: SubmitDrawingPayload,
    acknowledge: ActionAcknowledgement<SubmitDrawingSuccessData>,
  ) => void;
  [SOCKET_EVENTS.GUESS_SUBMIT]: (
    payload: SubmitGuessPayload,
    acknowledge: ActionAcknowledgement<SubmitGuessSuccessData>,
  ) => void;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.SERVER_PONG]: (payload: ServerPongPayload) => void;
  [SOCKET_EVENTS.ROOM_STATE]: (payload: PublicRoomState) => void;
  [SOCKET_EVENTS.TURN_SECRET]: (payload: TurnSecretPayload) => void;
  [SOCKET_EVENTS.GAME_CANCELLED]: (payload: GameCancelledPayload) => void;
}

export interface HealthResponse {
  status: "ok";
  service: "drawing-game-server";
  /** Début du commit déployé, lorsque la plateforme le fournit (preuve de la version servie). */
  commit?: string;
}
