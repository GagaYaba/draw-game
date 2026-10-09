import {
  SOCKET_EVENTS,
  type ActionAcknowledgement,
  type ActionResult,
  type ClientPingPayload,
  type ClientToServerEvents,
  type ContinueGameSuccessData,
  type PublicRoomState,
  type RequestRematchSuccessData,
  type RestoreSessionSuccessData,
  type RoomSessionData,
  type ServerToClientEvents,
  type StartGameSuccessData,
  type SubmitDrawingSuccessData,
  type SubmitGuessSuccessData,
} from "@drawing-game/shared";
import type { Server } from "socket.io";

import type { GameManager } from "../game/game-manager.js";
import { type RoomManager, RoomManagerError } from "../rooms/room-manager.js";
import { getClientIp } from "../security/client-ip.js";
import { ACCESS_FAILURE_CODES } from "../security/limits.js";
import { maskIp, type SecurityEventReporter } from "../security/security-log.js";
import type { SocketGuard } from "../security/socket-guard.js";
import type { ReconnectManager } from "../sessions/reconnect-manager.js";
import type { SessionRestorationManager } from "../sessions/session-restoration.js";
import { validateRestoreSessionPayload } from "../sessions/session-validation.js";
import {
  validateCreateRoomPayload,
  validateJoinRoomPayload,
  validateSetPlayerReadyPayload,
  validateStartGamePayload,
} from "./validate-room-payloads.js";

type DrawingGameIo = Server<ClientToServerEvents, ServerToClientEvents>;

/** Délai indicatif renvoyé lorsque la création de salons est refusée pour la journée. */
const ROOM_CREATION_RETRY_HINT_MS = 60 * 60 * 1000;

interface ActionRequest<T> {
  payload: unknown;
  acknowledge: ActionAcknowledgement<T>;
}

function isActionAcknowledgement<T>(value: unknown): value is ActionAcknowledgement<T> {
  return typeof value === "function";
}

function getActionRequest<T>(argumentsReceived: unknown[]): ActionRequest<T> | null {
  const possibleAcknowledgement = argumentsReceived.at(-1);

  if (!isActionAcknowledgement<T>(possibleAcknowledgement)) {
    return null;
  }

  const payloadArguments = argumentsReceived.slice(0, -1);
  return {
    payload:
      payloadArguments.length === 0
        ? undefined
        : payloadArguments.length === 1
          ? payloadArguments[0]
          : payloadArguments,
    acknowledge: possibleAcknowledgement,
  };
}

function isClientPingPayload(payload: unknown): payload is ClientPingPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "sentAt" in payload &&
    typeof payload.sentAt === "number" &&
    Number.isFinite(payload.sentAt)
  );
}

function rateLimited<T>(retryAfterMs: number): ActionResult<T> {
  return {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: `Trop de requêtes. Réessayez dans ${Math.ceil(retryAfterMs / 1000)} s.`,
    },
  };
}

function getFailureCode(error: unknown): string | null {
  return error instanceof RoomManagerError ? error.code : null;
}

function actionFailure<T>(error: unknown): ActionResult<T> {
  if (error instanceof RoomManagerError) {
    return {
      success: false,
      error: { code: error.code, message: error.message },
    };
  }

  console.error("[rooms] Unexpected room action error", error);
  return {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Une erreur interne est survenue.",
    },
  };
}

export function registerSocketHandlers(
  io: DrawingGameIo,
  roomManager: RoomManager,
  gameManager: GameManager,
  reconnectManager: ReconnectManager,
  sessionRestorationManager: SessionRestorationManager,
  guard: SocketGuard,
  report: SecurityEventReporter,
) {
  io.on("connection", (socket) => {
    const clientIp = getClientIp(
      socket.handshake.headers["x-forwarded-for"],
      socket.handshake.address,
    );
    guard.registerConnection(clientIp);
    console.info(`[socket] Client connected: ${socket.id}`);

    const recordAccessFailure = (code: string | null) => {
      guard.recordAccessFailure(socket.id, clientIp, code);
      if (code !== null && ACCESS_FAILURE_CODES.has(code)) {
        report("access_failed", { ip: maskIp(clientIp), code });
      }
    };

    // Chaque événement consomme un jeton ; au-delà du débit autorisé, il est refusé.
    socket.use((event, next) => {
      const decision = guard.consumeEvent(socket.id);
      if (decision.allowed) {
        roomManager.touchRoomBySocketId(socket.id);
        next();
        return;
      }

      report("event_rate_limited", { ip: maskIp(clientIp) });
      const acknowledgement = event.at(-1);
      if (isActionAcknowledgement(acknowledgement)) {
        acknowledgement(rateLimited(decision.retryAfterMs));
      }
    });

    socket.on(SOCKET_EVENTS.CLIENT_PING, (payload) => {
      if (!isClientPingPayload(payload)) {
        return;
      }

      socket.emit(SOCKET_EVENTS.SERVER_PONG, {
        sentAt: payload.sentAt,
        receivedAt: Date.now(),
      });
    });

    socket.on(SOCKET_EVENTS.ROOM_CREATE, async (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<RoomSessionData>(argumentsReceived);
      if (request === null) {
        return;
      }

      const validation = validateCreateRoomPayload(request.payload);
      if (!validation.success) {
        request.acknowledge(validation);
        return;
      }

      if (!guard.canCreateRoom(clientIp)) {
        report("room_creation_limited", { ip: maskIp(clientIp) });
        request.acknowledge(rateLimited(ROOM_CREATION_RETRY_HINT_MS));
        return;
      }

      let session: RoomSessionData;
      try {
        session = roomManager.createRoom(
          socket.id,
          validation.data.nickname,
          validation.data.clientInstanceId,
        );
        guard.recordRoomCreated(clientIp);
      } catch (error) {
        request.acknowledge(actionFailure(error));
        return;
      }

      try {
        await socket.join(session.session.roomCode);
      } catch (error) {
        sessionRestorationManager.rollbackRoomAdmission(
          session.session.roomCode,
          session.session.playerId,
        );
        request.acknowledge(actionFailure(error));
        return;
      }

      request.acknowledge({ success: true, data: session });
      io.to(session.session.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, session.room);
    });

    socket.on(SOCKET_EVENTS.ROOM_JOIN, async (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<RoomSessionData>(argumentsReceived);
      if (request === null) {
        return;
      }

      if (guard.isAccessBlocked(socket.id, clientIp)) {
        report("access_blocked", { ip: maskIp(clientIp) });
        request.acknowledge(rateLimited(guard.retryAccessAfterMs(socket.id, clientIp)));
        return;
      }

      const validation = validateJoinRoomPayload(request.payload);
      if (!validation.success) {
        recordAccessFailure(validation.error.code);
        request.acknowledge(validation);
        return;
      }

      let session: RoomSessionData;
      try {
        session = roomManager.joinRoom(
          socket.id,
          validation.data.nickname,
          validation.data.roomCode,
          validation.data.clientInstanceId,
        );
      } catch (error) {
        recordAccessFailure(getFailureCode(error));
        request.acknowledge(actionFailure(error));
        return;
      }

      try {
        await socket.join(session.session.roomCode);
      } catch (error) {
        sessionRestorationManager.rollbackRoomAdmission(
          session.session.roomCode,
          session.session.playerId,
        );
        request.acknowledge(actionFailure(error));
        return;
      }

      request.acknowledge({ success: true, data: session });
      io.to(session.session.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, session.room);
    });

    socket.on(SOCKET_EVENTS.SESSION_RESTORE, async (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<RestoreSessionSuccessData>(argumentsReceived);
      if (request === null) {
        return;
      }

      if (guard.isAccessBlocked(socket.id, clientIp)) {
        report("access_blocked", { ip: maskIp(clientIp) });
        request.acknowledge(rateLimited(guard.retryAccessAfterMs(socket.id, clientIp)));
        return;
      }

      const validation = validateRestoreSessionPayload(request.payload);
      if (!validation.success) {
        recordAccessFailure(validation.error.code);
        request.acknowledge(validation);
        return;
      }

      let roomCode: string;
      try {
        roomCode = sessionRestorationManager.prepareSessionRestore(
          socket.id,
          validation.data,
        ).roomCode;
      } catch (error) {
        recordAccessFailure(getFailureCode(error));
        request.acknowledge(actionFailure(error));
        return;
      }

      try {
        await socket.join(roomCode);
      } catch (error) {
        request.acknowledge(actionFailure(error));
        return;
      }

      if (!socket.connected) {
        await socket.leave(roomCode);
        return;
      }

      let restored: RestoreSessionSuccessData;
      let supersededSocketId: string | null;
      try {
        const restoration = sessionRestorationManager.restoreSession(socket.id, validation.data);
        restored = restoration.data;
        supersededSocketId = restoration.supersededSocketId;
      } catch (error) {
        await socket.leave(roomCode);
        request.acknowledge(actionFailure(error));
        return;
      }

      if (supersededSocketId !== null) {
        io.sockets.sockets.get(supersededSocketId)?.disconnect(true);
      }

      request.acknowledge({ success: true, data: restored });
      io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE, restored.room);
    });

    socket.on(SOCKET_EVENTS.ROOM_LEAVE, async (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<null>(argumentsReceived);
      if (request === null) {
        return;
      }

      try {
        const currentRoom = roomManager.getPlayerRoomBySocketId(socket.id);
        const gameWasCancelled =
          currentRoom === undefined ? false : gameManager.cancelGame(currentRoom.code);
        const departure = roomManager.leaveRoom(socket.id);
        reconnectManager.clearPlayerReconnectTimer(departure.roomCode, departure.playerId);
        await socket.leave(departure.roomCode);
        request.acknowledge({ success: true, data: null });

        if (departure.room !== null) {
          if (gameWasCancelled) {
            io.to(departure.roomCode).emit(SOCKET_EVENTS.GAME_CANCELLED, {
              reason: "PLAYER_LEFT",
              message: "La partie a été annulée car un joueur a quitté le salon.",
            });
          }
          io.to(departure.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, departure.room);
        }
      } catch (error) {
        request.acknowledge(actionFailure<null>(error));
      }
    });

    socket.on(SOCKET_EVENTS.PLAYER_SET_READY, (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<PublicRoomState>(argumentsReceived);
      if (request === null) {
        return;
      }

      const validation = validateSetPlayerReadyPayload(request.payload);
      if (!validation.success) {
        request.acknowledge(validation);
        return;
      }

      let room: PublicRoomState;
      try {
        room = roomManager.setPlayerReady(socket.id, validation.data.isReady);
      } catch (error) {
        request.acknowledge(actionFailure(error));
        return;
      }

      request.acknowledge({ success: true, data: room });
      io.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE, room);
    });

    socket.on(SOCKET_EVENTS.GAME_START, (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<StartGameSuccessData>(argumentsReceived);
      if (request === null) {
        return;
      }

      const validation = validateStartGamePayload(request.payload);
      if (!validation.success) {
        request.acknowledge(validation);
        return;
      }

      try {
        const startedGame = gameManager.startGame(socket.id);
        io.to(startedGame.room.code).emit(SOCKET_EVENTS.ROOM_STATE, startedGame.room);
        for (const assignment of startedGame.assignments) {
          if (assignment.socketId !== null) {
            io.to(assignment.socketId).emit(SOCKET_EVENTS.TURN_SECRET, assignment.secret);
          }
        }
        request.acknowledge({
          success: true,
          data: { room: startedGame.room },
        });
      } catch (error) {
        request.acknowledge(actionFailure(error));
      }
    });

    socket.on(SOCKET_EVENTS.GAME_CONTINUE, (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<ContinueGameSuccessData>(argumentsReceived);
      if (request === null) {
        return;
      }

      if (request.payload !== undefined) {
        request.acknowledge({
          success: false,
          error: {
            code: "INVALID_GAME_CONTINUE_REQUEST",
            message: "La demande de continuation ne doit contenir aucun argument.",
          },
        });
        return;
      }

      try {
        const continuation = gameManager.continueGame(socket.id);
        io.to(continuation.room.code).emit(SOCKET_EVENTS.ROOM_STATE, continuation.room);

        for (const assignment of continuation.assignments ?? []) {
          if (assignment.socketId !== null) {
            io.to(assignment.socketId).emit(SOCKET_EVENTS.TURN_SECRET, assignment.secret);
          }
        }

        request.acknowledge({
          success: true,
          data: { room: continuation.room },
        });
      } catch (error) {
        request.acknowledge(actionFailure(error));
      }
    });

    socket.on(SOCKET_EVENTS.GAME_REQUEST_REMATCH, (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<RequestRematchSuccessData>(argumentsReceived);
      if (request === null) {
        return;
      }

      if (request.payload !== undefined) {
        request.acknowledge({
          success: false,
          error: {
            code: "INVALID_GAME_REMATCH_REQUEST",
            message: "La demande de revanche ne doit contenir aucun argument.",
          },
        });
        return;
      }

      try {
        const rematch = gameManager.requestRematch(socket.id);
        io.to(rematch.room.code).emit(SOCKET_EVENTS.ROOM_STATE, rematch.room);
        request.acknowledge({
          success: true,
          data: { room: rematch.room },
        });
      } catch (error) {
        request.acknowledge(actionFailure(error));
      }
    });

    socket.on(SOCKET_EVENTS.DRAWING_SUBMIT, (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<SubmitDrawingSuccessData>(argumentsReceived);
      if (request === null) {
        return;
      }

      try {
        const submission = gameManager.submitDrawing(socket.id, request.payload);
        io.to(submission.room.code).emit(SOCKET_EVENTS.ROOM_STATE, submission.room);
        request.acknowledge({ success: true, data: submission });
      } catch (error) {
        request.acknowledge(actionFailure(error));
      }
    });

    socket.on(SOCKET_EVENTS.GUESS_SUBMIT, (...argumentsReceived: unknown[]) => {
      const request = getActionRequest<SubmitGuessSuccessData>(argumentsReceived);
      if (request === null) {
        return;
      }

      try {
        const submission = gameManager.submitGuess(socket.id, request.payload);
        io.to(submission.room.code).emit(SOCKET_EVENTS.ROOM_STATE, submission.room);
        request.acknowledge({
          success: true,
          data: submission.guess,
        });
      } catch (error) {
        request.acknowledge(actionFailure(error));
      }
    });

    socket.on("disconnect", (reason) => {
      guard.releaseConnection(clientIp);
      guard.forgetSocket(socket.id);
      const disconnection =
        reason === "server shutting down" || !roomManager.isActivePlayerSocket(socket.id)
          ? null
          : reconnectManager.markPlayerDisconnected(socket.id);

      if (disconnection !== null) {
        io.to(disconnection.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, disconnection.room);
      }

      console.info(`[socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });
}
