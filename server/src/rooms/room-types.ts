import type {
  PlayerSessionCredentials,
  PublicRoomState,
  RestoreSessionPayload,
  RestoreSessionSuccessData,
  RoomErrorCode,
  RoomSessionData,
} from "@drawing-game/shared";
import type { InternalGame } from "../game/game-types.js";
import type { SessionTokenGenerator } from "../sessions/session-token.js";

export type { RoomErrorCode } from "@drawing-game/shared";

export interface InternalPlayer {
  id: string;
  socketId: string | null;
  activeClientInstanceId: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: number;
  score: number;
  sessionTokenHash: string;
  disconnectedAt: number | null;
  reconnectDeadline: number | null;
}

export interface InternalRoom {
  code: string;
  players: InternalPlayer[];
  createdAt: number;
  game: InternalGame | null;
}

export type RoomCodeGenerator = () => string;
export type PlayerIdGenerator = () => string;
export type Clock = () => number;

export interface RoomManagerOptions {
  codeGenerator?: RoomCodeGenerator;
  idGenerator?: PlayerIdGenerator;
  clock?: Clock;
  sessionTokenGenerator?: SessionTokenGenerator;
  maxCodeGenerationAttempts?: number;
}

export type CreateRoomResult = RoomSessionData;
export type JoinRoomResult = RoomSessionData;

export interface PlayerDisconnectionResult {
  roomCode: string;
  playerId: string;
  room: PublicRoomState;
  disconnectedAt: number;
  reconnectDeadline: number;
}

export interface SessionRestoreCandidate {
  roomCode: string;
  playerId: string;
  credentials: PlayerSessionCredentials;
}

export interface RestoreSessionRequest extends RestoreSessionPayload {
  socketId: string;
  restoredAt: number;
}

export interface RestoreSessionResult {
  data: RestoreSessionSuccessData;
  supersededSocketId: string | null;
}

export interface RoomDepartureResult {
  roomCode: string;
  playerId: string;
  room: PublicRoomState | null;
  roomDeleted: boolean;
}

export class RoomManagerError extends Error {
  readonly code: RoomErrorCode;

  constructor(code: RoomErrorCode, message: string) {
    super(message);
    this.name = "RoomManagerError";
    this.code = code;
  }
}
