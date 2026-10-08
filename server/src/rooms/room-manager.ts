import { randomInt, randomUUID } from "node:crypto";

import type { PublicPlayer, PublicRoomState } from "@drawing-game/shared";

import { toPublicGameState } from "../game/game-public-state.js";
import { isValidClientInstanceId } from "../sessions/client-instance-validation.js";
import {
  createSessionToken,
  hashSessionToken,
  isValidSessionToken,
  verifySessionToken,
} from "../sessions/session-token.js";
import {
  getNicknameComparisonKey,
  normalizeNickname,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  validateReadyStatus,
} from "./room-validation.js";
import {
  RoomManagerError,
  type CreateRoomResult,
  type InternalPlayer,
  type InternalRoom,
  type JoinRoomResult,
  type PlayerDisconnectionResult,
  type RestoreSessionRequest,
  type RestoreSessionResult,
  type RoomDepartureResult,
  type RoomManagerOptions,
  type SessionRestoreCandidate,
} from "./room-types.js";

export { RoomManagerError } from "./room-types.js";
export type {
  Clock,
  CreateRoomResult,
  InternalPlayer,
  InternalRoom,
  JoinRoomResult,
  PlayerDisconnectionResult,
  PlayerIdGenerator,
  RestoreSessionRequest,
  RestoreSessionResult,
  RoomCodeGenerator,
  RoomDepartureResult,
  RoomErrorCode,
  RoomManagerOptions,
  SessionRestoreCandidate,
} from "./room-types.js";

export const MAX_PLAYERS = 8;
export const MINIMUM_PLAYERS_TO_START = 3;

const DEFAULT_MAX_CODE_GENERATION_ATTEMPTS = 100;

function createRandomRoomCode(): string {
  let code = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
  }

  return code;
}

export class RoomManager {
  private readonly rooms = new Map<string, InternalRoom>();
  private readonly roomCodeBySocketId = new Map<string, string>();
  private readonly codeGenerator: () => string;
  private readonly idGenerator: () => string;
  private readonly clock: () => number;
  private readonly sessionTokenGenerator: () => string;
  private readonly maxCodeGenerationAttempts: number;

  constructor(options: RoomManagerOptions = {}) {
    this.codeGenerator = options.codeGenerator ?? createRandomRoomCode;
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.clock = options.clock ?? Date.now;
    this.sessionTokenGenerator = options.sessionTokenGenerator ?? createSessionToken;
    this.maxCodeGenerationAttempts =
      options.maxCodeGenerationAttempts ?? DEFAULT_MAX_CODE_GENERATION_ATTEMPTS;

    if (
      !Number.isSafeInteger(this.maxCodeGenerationAttempts) ||
      this.maxCodeGenerationAttempts < 1
    ) {
      throw new RangeError("maxCodeGenerationAttempts doit être un entier positif.");
    }
  }

  createRoom(socketId: string, nickname: string, clientInstanceId: string): CreateRoomResult {
    this.assertSocketIsAvailable(socketId);
    this.assertClientInstanceId(clientInstanceId);
    const normalizedNickname = normalizeNickname(nickname);
    const code = this.generateUniqueRoomCode();
    const timestamp = this.clock();
    const { player, token } = this.createPlayer(
      socketId,
      normalizedNickname,
      true,
      timestamp,
      clientInstanceId,
    );
    const room: InternalRoom = {
      code,
      players: [player],
      createdAt: timestamp,
      game: null,
    };

    this.rooms.set(code, room);
    this.roomCodeBySocketId.set(socketId, code);

    return {
      room: this.toPublicRoomState(room),
      session: {
        roomCode: code,
        playerId: player.id,
        token,
      },
    };
  }

  joinRoom(
    socketId: string,
    nickname: string,
    roomCode: string,
    clientInstanceId: string,
  ): JoinRoomResult {
    this.assertSocketIsAvailable(socketId);
    this.assertClientInstanceId(clientInstanceId);
    const code = normalizeRoomCode(roomCode);
    const normalizedNickname = normalizeNickname(nickname);
    const room = this.rooms.get(code);

    if (!room) {
      throw new RoomManagerError("ROOM_NOT_FOUND", "Aucun salon ne correspond à ce code.");
    }

    if (room.game !== null) {
      throw new RoomManagerError("GAME_ALREADY_STARTED", "Cette partie a déjà commencé.");
    }

    if (room.players.length >= MAX_PLAYERS) {
      throw new RoomManagerError("ROOM_FULL", "Ce salon a déjà atteint sa limite de joueurs.");
    }

    const nicknameKey = getNicknameComparisonKey(normalizedNickname);
    const nicknameAlreadyUsed = room.players.some(
      (player) => getNicknameComparisonKey(player.nickname) === nicknameKey,
    );

    if (nicknameAlreadyUsed) {
      throw new RoomManagerError(
        "NICKNAME_ALREADY_USED",
        "Ce pseudonyme est déjà utilisé dans le salon.",
      );
    }

    const { player, token } = this.createPlayer(
      socketId,
      normalizedNickname,
      false,
      this.clock(),
      clientInstanceId,
    );
    room.players.push(player);
    this.roomCodeBySocketId.set(socketId, code);

    return {
      room: this.toPublicRoomState(room),
      session: {
        roomCode: code,
        playerId: player.id,
        token,
      },
    };
  }

  leaveRoom(socketId: string): RoomDepartureResult {
    const roomCode = this.roomCodeBySocketId.get(socketId);

    if (!roomCode) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    return this.removePlayer(socketId, roomCode);
  }

  markPlayerDisconnected(
    socketId: string,
    disconnectedAt: number,
    reconnectDeadline: number,
  ): PlayerDisconnectionResult | null {
    const roomCode = this.roomCodeBySocketId.get(socketId);

    if (!roomCode) {
      return null;
    }

    if (
      !Number.isFinite(disconnectedAt) ||
      !Number.isFinite(reconnectDeadline) ||
      reconnectDeadline < disconnectedAt
    ) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Le délai de reconnexion du joueur est invalide.",
      );
    }

    const room = this.rooms.get(roomCode);
    const player = room?.players.find((candidate) => candidate.socketId === socketId);

    if (!room || !player) {
      this.roomCodeBySocketId.delete(socketId);
      return null;
    }

    this.roomCodeBySocketId.delete(socketId);
    player.socketId = null;
    player.isConnected = false;
    player.disconnectedAt = disconnectedAt;
    player.reconnectDeadline = reconnectDeadline;

    return {
      roomCode,
      playerId: player.id,
      room: this.toPublicRoomState(room),
      disconnectedAt,
      reconnectDeadline,
    };
  }

  prepareSessionRestore(
    socketId: string,
    payload: {
      roomCode: string;
      playerId: string;
      token: string;
      clientInstanceId: string;
    },
    restoredAt: number,
  ): SessionRestoreCandidate {
    if (!Number.isFinite(restoredAt)) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de dater la restauration de session.",
      );
    }

    const roomCode = normalizeRoomCode(payload.roomCode);
    const room = this.rooms.get(roomCode);

    if (!room) {
      throw new RoomManagerError("ROOM_NOT_FOUND", "Cette partie n’existe plus.");
    }

    const player = room.players.find((candidate) => candidate.id === payload.playerId);

    if (!player) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Ce joueur n’est plus présent dans la partie.",
      );
    }

    if (!verifySessionToken(payload.token, player.sessionTokenHash)) {
      throw new RoomManagerError("INVALID_SESSION", "La session enregistrée n’est pas valide.");
    }

    this.assertClientInstanceId(payload.clientInstanceId);

    const socketRoomCode = this.roomCodeBySocketId.get(socketId);

    if (socketRoomCode !== undefined) {
      const isIdempotentRestore =
        socketRoomCode === roomCode &&
        player.socketId === socketId &&
        player.isConnected &&
        player.activeClientInstanceId === payload.clientInstanceId;

      if (!isIdempotentRestore) {
        throw new RoomManagerError(
          "SESSION_ALREADY_ACTIVE",
          "Cette session est déjà ouverte dans un autre onglet.",
        );
      }
    } else if (player.isConnected || player.socketId !== null) {
      if (!player.isConnected || player.socketId === null) {
        throw new RoomManagerError(
          "INTERNAL_ERROR",
          "L’association réseau du joueur est incohérente.",
        );
      }

      if (player.activeClientInstanceId !== payload.clientInstanceId) {
        throw new RoomManagerError(
          "SESSION_ALREADY_ACTIVE",
          "Cette session est déjà ouverte dans un autre onglet.",
        );
      }
    } else {
      if (player.disconnectedAt === null || player.reconnectDeadline === null) {
        throw new RoomManagerError("INVALID_SESSION", "La session enregistrée n’est pas valide.");
      }

      if (restoredAt >= player.reconnectDeadline) {
        throw new RoomManagerError("SESSION_EXPIRED", "Le délai de reconnexion est expiré.");
      }
    }

    return {
      roomCode,
      playerId: player.id,
      credentials: {
        roomCode,
        playerId: player.id,
        token: payload.token,
      },
    };
  }

  restoreSession(request: RestoreSessionRequest): RestoreSessionResult {
    const candidate = this.prepareSessionRestore(request.socketId, request, request.restoredAt);
    const room = this.rooms.get(candidate.roomCode);
    const player = room?.players.find((currentPlayer) => currentPlayer.id === candidate.playerId);

    if (!room || !player) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Ce joueur n’est plus présent dans la partie.",
      );
    }

    const previousSocketId = player.socketId;
    const previousIsConnected = player.isConnected;
    const previousDisconnectedAt = player.disconnectedAt;
    const previousReconnectDeadline = player.reconnectDeadline;
    const previousClientInstanceId = player.activeClientInstanceId;
    const previousIncomingSocketRoomCode = this.roomCodeBySocketId.get(request.socketId);
    const previousSocketRoomCode =
      previousSocketId === null ? undefined : this.roomCodeBySocketId.get(previousSocketId);
    const supersededSocketId =
      previousSocketId !== null && previousSocketId !== request.socketId ? previousSocketId : null;

    if (supersededSocketId !== null) {
      this.roomCodeBySocketId.delete(supersededSocketId);
    }

    player.socketId = request.socketId;
    player.isConnected = true;
    player.disconnectedAt = null;
    player.reconnectDeadline = null;
    player.activeClientInstanceId = request.clientInstanceId;
    this.roomCodeBySocketId.set(request.socketId, room.code);

    try {
      const game = room.game;
      const isCurrentDrawer = game !== null && game.currentTurn.drawerPlayerId === player.id;
      const submittedGuess = game === null ? undefined : game.currentTurn.guesses[player.id];

      return {
        data: {
          room: this.toPublicRoomState(room),
          session: candidate.credentials,
          privateState: {
            gameId: game?.gameId ?? null,
            turnId: game?.currentTurn.turnId ?? null,
            secretLevel: game !== null && isCurrentDrawer ? game.currentTurn.secretLevel : null,
            submittedGuess:
              submittedGuess === undefined
                ? null
                : {
                    value: submittedGuess.value,
                    submittedAt: submittedGuess.submittedAt,
                  },
            isCurrentDrawer,
          },
        },
        supersededSocketId,
      };
    } catch (error) {
      this.roomCodeBySocketId.delete(request.socketId);

      if (previousIncomingSocketRoomCode !== undefined) {
        this.roomCodeBySocketId.set(request.socketId, previousIncomingSocketRoomCode);
      }

      if (
        previousSocketId !== null &&
        previousSocketId !== request.socketId &&
        previousSocketRoomCode !== undefined
      ) {
        this.roomCodeBySocketId.set(previousSocketId, previousSocketRoomCode);
      }

      player.socketId = previousSocketId;
      player.isConnected = previousIsConnected;
      player.disconnectedAt = previousDisconnectedAt;
      player.reconnectDeadline = previousReconnectDeadline;
      player.activeClientInstanceId = previousClientInstanceId;

      if (error instanceof RoomManagerError) {
        throw error;
      }

      throw new RoomManagerError("INTERNAL_ERROR", "Impossible de restaurer la session du joueur.");
    }
  }

  isReconnectExpirationCurrent(
    roomCode: string,
    playerId: string,
    reconnectDeadline: number,
  ): boolean {
    const room = this.rooms.get(roomCode);
    const player = room?.players.find((candidate) => candidate.id === playerId);

    return (
      player !== undefined &&
      !player.isConnected &&
      player.socketId === null &&
      player.reconnectDeadline === reconnectDeadline
    );
  }

  removePlayerById(roomCode: string, playerId: string): RoomDepartureResult | null {
    const room = this.rooms.get(roomCode);
    const playerIndex = room?.players.findIndex((player) => player.id === playerId);

    if (!room || playerIndex === undefined || playerIndex < 0) {
      return null;
    }

    return this.removePlayerAtIndex(room, playerIndex);
  }

  setPlayerReady(socketId: string | null, isReady: boolean): PublicRoomState {
    const readyStatus = validateReadyStatus(isReady);
    if (socketId === null) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    const roomCode = this.roomCodeBySocketId.get(socketId);

    if (!roomCode) {
      throw new RoomManagerError("NOT_IN_ROOM", "Cette connexion n'appartient à aucun salon.");
    }

    const room = this.rooms.get(roomCode);
    const player = room?.players.find((candidate) => candidate.socketId === socketId);

    if (!room || !player) {
      this.roomCodeBySocketId.delete(socketId);
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (room.game !== null) {
      throw new RoomManagerError("GAME_ALREADY_STARTED", "Cette partie a déjà commencé.");
    }

    player.isReady = readyStatus;

    return this.toPublicRoomState(room);
  }

  getRoomByCode(roomCode: string): InternalRoom | undefined {
    try {
      return this.rooms.get(normalizeRoomCode(roomCode));
    } catch (error) {
      if (error instanceof RoomManagerError) {
        return undefined;
      }

      throw error;
    }
  }

  getPlayerRoomBySocketId(socketId: string | null): InternalRoom | undefined {
    if (socketId === null) {
      return undefined;
    }

    const roomCode = this.roomCodeBySocketId.get(socketId);
    return roomCode ? this.rooms.get(roomCode) : undefined;
  }

  isActivePlayerSocket(socketId: string): boolean {
    const roomCode = this.roomCodeBySocketId.get(socketId);
    const room = roomCode === undefined ? undefined : this.rooms.get(roomCode);
    const player = room?.players.find((candidate) => candidate.socketId === socketId);

    return player?.isConnected === true;
  }

  getPublicRoomState(roomCode: string): PublicRoomState {
    const code = normalizeRoomCode(roomCode);
    const room = this.rooms.get(code);

    if (!room) {
      throw new RoomManagerError("ROOM_NOT_FOUND", "Aucun salon ne correspond à ce code.");
    }

    return this.toPublicRoomState(room);
  }

  private assertSocketIsAvailable(socketId: string): void {
    if (this.roomCodeBySocketId.has(socketId)) {
      throw new RoomManagerError("ALREADY_IN_ROOM", "Cette connexion appartient déjà à un salon.");
    }
  }

  private assertClientInstanceId(clientInstanceId: string): void {
    if (!isValidClientInstanceId(clientInstanceId)) {
      throw new RoomManagerError("INVALID_SESSION", "L’instance cliente est invalide.");
    }
  }

  private createPlayer(
    socketId: string,
    nickname: string,
    isHost: boolean,
    joinedAt: number,
    activeClientInstanceId: string,
  ): { player: InternalPlayer; token: string } {
    let token: unknown;

    try {
      token = this.sessionTokenGenerator();
    } catch {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de créer les identifiants privés du joueur.",
      );
    }

    if (!isValidSessionToken(token)) {
      throw new RoomManagerError(
        "INTERNAL_ERROR",
        "Impossible de créer des identifiants privés valides.",
      );
    }

    return {
      player: {
        id: this.idGenerator(),
        socketId,
        activeClientInstanceId,
        nickname,
        isHost,
        isReady: false,
        isConnected: true,
        joinedAt,
        score: 0,
        sessionTokenHash: hashSessionToken(token),
        disconnectedAt: null,
        reconnectDeadline: null,
      },
      token,
    };
  }

  private generateUniqueRoomCode(): string {
    for (let attempt = 0; attempt < this.maxCodeGenerationAttempts; attempt += 1) {
      let code: string;

      try {
        code = normalizeRoomCode(this.codeGenerator());
      } catch {
        throw new RoomManagerError(
          "INTERNAL_ERROR",
          "Le générateur de codes de salon a produit un code invalide.",
        );
      }

      if (!this.rooms.has(code)) {
        return code;
      }
    }

    throw new RoomManagerError("INTERNAL_ERROR", "Impossible de générer un code de salon unique.");
  }

  private removePlayer(socketId: string, roomCode: string): RoomDepartureResult {
    const room = this.rooms.get(roomCode);
    const playerIndex = room?.players.findIndex((player) => player.socketId === socketId);

    if (!room || playerIndex === undefined || playerIndex < 0) {
      this.roomCodeBySocketId.delete(socketId);
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    return this.removePlayerAtIndex(room, playerIndex);
  }

  private removePlayerAtIndex(room: InternalRoom, playerIndex: number): RoomDepartureResult {
    const [departingPlayer] = room.players.splice(playerIndex, 1);

    if (!departingPlayer) {
      throw new RoomManagerError(
        "PLAYER_NOT_FOUND",
        "Le joueur associé à cette connexion est introuvable.",
      );
    }

    if (departingPlayer.socketId !== null) {
      this.roomCodeBySocketId.delete(departingPlayer.socketId);
    }

    if (room.players.length === 0) {
      this.rooms.delete(room.code);

      return {
        roomCode: room.code,
        playerId: departingPlayer.id,
        room: null,
        roomDeleted: true,
      };
    }

    if (departingPlayer.isHost) {
      for (const player of room.players) {
        player.isHost = false;
      }

      const oldestPlayer = room.players.reduce((oldest, player) =>
        player.joinedAt < oldest.joinedAt ? player : oldest,
      );
      oldestPlayer.isHost = true;
    }

    return {
      roomCode: room.code,
      playerId: departingPlayer.id,
      room: this.toPublicRoomState(room),
      roomDeleted: false,
    };
  }

  private toPublicRoomState(room: InternalRoom): PublicRoomState {
    const players: PublicPlayer[] = room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      isHost: player.isHost,
      isReady: player.isReady,
      isConnected: player.isConnected,
      reconnectDeadline: player.reconnectDeadline,
      score: player.score,
    }));
    const allPlayersReady = players.length > 0 && players.every((player) => player.isReady);

    return {
      code: room.code,
      players,
      playerCount: players.length,
      maxPlayers: MAX_PLAYERS,
      minimumPlayersToStart: MINIMUM_PLAYERS_TO_START,
      allPlayersReady,
      canStart:
        room.game === null &&
        players.length >= MINIMUM_PLAYERS_TO_START &&
        allPlayersReady &&
        players.every((player) => player.isConnected),
      game: room.game === null ? null : toPublicGameState(room.game, room.players),
    };
  }
}
