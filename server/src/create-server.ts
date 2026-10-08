import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ClientToServerEvents,
  HealthResponse,
  ServerToClientEvents,
} from "@drawing-game/shared";
import { SOCKET_EVENTS } from "@drawing-game/shared";
import express from "express";
import { Server } from "socket.io";

import { GameManager } from "./game/game-manager.js";
import type { GameManagerOptions } from "./game/game-types.js";
import { RoomManager } from "./rooms/room-manager.js";
import { ReconnectManager, type ReconnectManagerOptions } from "./sessions/reconnect-manager.js";
import { SessionRestorationManager } from "./sessions/session-restoration.js";
import { getClientIp } from "./security/client-ip.js";
import {
  API_REQUESTS_PER_MINUTE,
  IDLE_ROOM_SWEEP_INTERVAL_MS,
  IDLE_ROOM_TTL_MS,
} from "./security/limits.js";
import { TokenBucketLimiter } from "./security/rate-limiter.js";
import { SocketGuard } from "./security/socket-guard.js";
import { registerSocketHandlers } from "./socket/register-socket-handlers.js";
import { isSocketOriginAllowed } from "./socket/socket-origin-policy.js";

export interface CreateDrawingGameServerOptions {
  serveClient?: boolean;
  roomManager?: RoomManager;
  gameManagerOptions?: GameManagerOptions;
  reconnectGraceMs?: number;
  reconnectManagerOptions?: ReconnectManagerOptions;
  allowedSocketOrigins?: readonly string[];
  allowLoopbackSocketOrigins?: boolean;
}

// A canonical 30,000-point drawing can exceed Engine.IO's 1 MB default once
// serialized with full-precision coordinates. Keep this finite and comfortably
// above the largest document allowed by the shared complexity limits.
export const MAX_SOCKET_MESSAGE_BYTES = 2_500_000;
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self' ws: wss:",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

export function createDrawingGameServer(options: CreateDrawingGameServerOptions = {}) {
  const app = express();
  const httpServer = createServer(app);
  const guard = new SocketGuard();
  const apiLimiter = new TokenBucketLimiter({
    capacity: API_REQUESTS_PER_MINUTE,
    refillIntervalMs: 60_000 / API_REQUESTS_PER_MINUTE,
  });
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    allowRequest: (request, callback) => {
      const clientIp = getClientIp(
        request.headers["x-forwarded-for"],
        request.socket.remoteAddress,
      );
      const originAllowed = isSocketOriginAllowed(request, {
        allowedOrigins: options.allowedSocketOrigins,
        allowLoopbackPortMismatch: options.allowLoopbackSocketOrigins,
      });
      callback(null, originAllowed && guard.canAcceptConnection(clientIp));
    },
  });
  const roomManager = options.roomManager ?? new RoomManager();
  const externalRoomStateListener = options.gameManagerOptions?.onPublicRoomStateChanged;
  const gameManager = new GameManager(roomManager, {
    ...options.gameManagerOptions,
    onPublicRoomStateChanged: (roomCode, room) => {
      externalRoomStateListener?.(roomCode, room);
      io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE, room);
    },
  });
  const externalExpirationListener = options.reconnectManagerOptions?.onPlayerExpired;
  const reconnectManager = new ReconnectManager(roomManager, gameManager, {
    ...options.reconnectManagerOptions,
    graceMs: options.reconnectGraceMs ?? options.reconnectManagerOptions?.graceMs,
    onPlayerExpired: (result) => {
      if (result.departure.room !== null) {
        if (result.gameWasCancelled) {
          io.to(result.departure.roomCode).emit(SOCKET_EVENTS.GAME_CANCELLED, {
            reason: "RECONNECT_TIMEOUT",
            message: "La partie a été annulée car un joueur ne s’est pas reconnecté à temps.",
          });
        }

        io.to(result.departure.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.departure.room);
      }

      externalExpirationListener?.(result);
    },
  });
  const sessionRestorationManager = new SessionRestorationManager(roomManager, reconnectManager, {
    clock: options.reconnectManagerOptions?.clock,
  });
  let disposed = false;
  const dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    let disposalFailed = false;
    let firstDisposalError: unknown;

    try {
      reconnectManager.dispose();
    } catch (error) {
      disposalFailed = true;
      firstDisposalError = error;
    }

    try {
      gameManager.dispose();
    } catch (error) {
      if (!disposalFailed) {
        disposalFailed = true;
        firstDisposalError = error;
      }
    }

    if (disposalFailed) {
      throw firstDisposalError;
    }
  };

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.set({
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
      "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    next();
  });

  app.use("/api", (request, response, next) => {
    const decision = apiLimiter.consume(
      getClientIp(request.headers["x-forwarded-for"], request.socket.remoteAddress),
    );
    if (!decision.allowed) {
      response.set("Retry-After", String(Math.ceil(decision.retryAfterMs / 1000)));
      response.status(429).json({ error: "Trop de requêtes. Réessayez dans un instant." });
      return;
    }
    next();
  });

  app.get("/api/health", (_request, response) => {
    const health: HealthResponse = {
      status: "ok",
      service: "drawing-game-server",
    };

    response.json(health);
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "API route not found" });
  });

  registerSocketHandlers(
    io,
    roomManager,
    gameManager,
    reconnectManager,
    sessionRestorationManager,
    guard,
  );

  const maintenanceTimer = setInterval(() => {
    try {
      for (const closed of roomManager.closeIdleRooms(IDLE_ROOM_TTL_MS)) {
        gameManager.cancelGame(closed.roomCode);
        reconnectManager.clearRoomReconnectTimers(closed.roomCode);
        io.in(closed.roomCode).socketsLeave(closed.roomCode);
      }
      apiLimiter.sweep();
      guard.sweep();
    } catch (error) {
      console.error("[maintenance] Idle room sweep failed", error);
    }
  }, IDLE_ROOM_SWEEP_INTERVAL_MS);
  maintenanceTimer.unref();

  httpServer.once("close", () => {
    clearInterval(maintenanceTimer);
    dispose();
  });

  if (options.serveClient !== false) {
    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const clientDistPath = resolve(currentDirectory, "../../client/dist");
    const clientIndexPath = resolve(clientDistPath, "index.html");

    if (existsSync(clientIndexPath)) {
      app.use(express.static(clientDistPath));

      app.use((request, response, next) => {
        const isApiRoute = request.path === "/api" || request.path.startsWith("/api/");
        const isSocketRoute =
          request.path === "/socket.io" || request.path.startsWith("/socket.io/");
        const isFrontendRoute = request.method === "GET" && !isApiRoute && !isSocketRoute;

        if (!isFrontendRoute) {
          next();
          return;
        }

        response.sendFile(clientIndexPath);
      });
    }
  }

  return {
    app,
    httpServer,
    io,
    roomManager,
    gameManager,
    reconnectManager,
    sessionRestorationManager,
    dispose,
  };
}
