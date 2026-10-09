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
  /** Écart moyen entre les estimations et le niveau secret. */
  averageDistance: number;
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

/** Consigne, niveau secret et dessin d'un joueur pour la manche en cours. */
export interface RoundEntry {
  prompt: DrawingPrompt;
  secretLevel: GuessValue;
  drawing: DrawingDocument | null;
  drawingSubmittedAt: number | null;
}

export interface InternalGame {
  gameId: string;
  phase: Exclude<GamePhase, "LOBBY">;
  totalRounds: number;
  currentRound: number;
  /** Joueurs de la partie, dans l'ordre du tirage initial (sert à départager les égalités). */
  turnOrder: string[];
  /** Identifiant de la manche en cours. */
  roundId: string;
  /** Une entrée par joueur : tout le monde dessine en même temps. */
  entries: Record<string, RoundEntry>;
  /** Ordre de présentation des dessins, fixé quand tous ont validé leur dessin. */
  votingOrder: string[];
  votingIndex: number;
  /** Dessin en cours de vote ou de révélation ; absent pendant le dessin. */
  currentTurn: InternalTurn | null;
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

/** Consigne et niveau secret à envoyer en privé à un joueur. */
export interface PlayerAssignment {
  socketId: string | null;
  secret: TurnSecretPayload;
}

export interface StartGameInternalResult {
  room: PublicRoomState;
  assignments: PlayerAssignment[];
}

export interface ContinueGameInternalResult {
  room: PublicRoomState;
  /** Présent lorsqu'une nouvelle manche commence. */
  assignments?: PlayerAssignment[];
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
