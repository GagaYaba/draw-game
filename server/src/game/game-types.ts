import type {
  DrawingDocument,
  GamePhase,
  GuessValue,
  PublicFinishedState,
  PublicGamePrompt,
  PublicRoomState,
  SubmitGuessSuccessData,
  TurnSecretPayload,
} from "@drawing-game/shared";

export interface DrawingPrompt extends PublicGamePrompt {
  category: string;
}

export interface InternalGuess {
  playerId: string;
  value: GuessValue;
  submittedAt: number;
}

export interface InternalGuessScoreResult {
  playerId: string;
  distance: number;
  pointsEarned: number;
  totalScore: number;
}

export interface InternalDrawerScoreResult {
  playerId: string;
  closeGuessCount: number;
  pointsEarned: number;
  totalScore: number;
}

export interface InternalTurnScoreResult {
  guesses: Record<string, InternalGuessScoreResult>;
  drawer: InternalDrawerScoreResult;
}

export interface InternalTurn {
  turnId: string;
  drawerPlayerId: string;
  prompt: DrawingPrompt;
  secretLevel: GuessValue;
  drawing: DrawingDocument | null;
  drawingSubmittedAt: number | null;
  guesses: Record<string, InternalGuess>;
  scoresAppliedAt: number | null;
  scoreResult: InternalTurnScoreResult | null;
}

export interface InternalGame {
  gameId: string;
  phase: Exclude<GamePhase, "LOBBY">;
  totalRounds: number;
  currentRound: number;
  turnOrder: string[];
  currentDrawerIndex: number;
  currentTurn: InternalTurn;
  usedPromptIds: string[];
  usedTurnIds: string[];
  finishedState: PublicFinishedState | null;
  startedAt: number;
  phaseEndsAt: number | null;
}

export type GameClock = () => number;
export type GameIdGenerator = () => string;
export type TurnIdGenerator = () => string;
export type PlayerOrderShuffler = (playerIds: readonly string[]) => string[];
export type DrawingPromptSelector = (prompts: readonly DrawingPrompt[]) => DrawingPrompt;
export type SecretLevelGenerator = () => number;
export type GameTimerScheduler = (callback: () => void, delayMilliseconds: number) => unknown;
export type GameTimerClearer = (handle: unknown) => void;

export interface GameManagerOptions {
  clock?: GameClock;
  generateGameId?: GameIdGenerator;
  generateTurnId?: TurnIdGenerator;
  introDurationMs?: number;
  prompts?: readonly DrawingPrompt[];
  shufflePlayerIds?: PlayerOrderShuffler;
  selectPrompt?: DrawingPromptSelector;
  generateSecretLevel?: SecretLevelGenerator;
  scheduleTimer?: GameTimerScheduler;
  clearTimer?: GameTimerClearer;
  onPublicRoomStateChanged?: (roomCode: string, room: PublicRoomState) => void;
}

export interface StartGameInternalResult {
  room: PublicRoomState;
  drawerSocketId: string;
  secret: TurnSecretPayload;
}

export interface ContinueGameInternalResult {
  room: PublicRoomState;
  nextTurn?: {
    drawerSocketId: string | null;
    secret: TurnSecretPayload;
  };
}

export interface RequestRematchInternalResult {
  room: PublicRoomState;
}

export interface SubmitDrawingInternalResult {
  room: PublicRoomState;
}

export interface SubmitGuessInternalResult {
  room: PublicRoomState;
  guess: SubmitGuessSuccessData;
}
