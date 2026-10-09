import { createDrawingGameServer } from "./create-server.js";
import {
  DEFAULT_RECONNECT_GRACE_MS,
  isValidReconnectGraceMs,
} from "./sessions/reconnect-manager.js";
import {
  closeHttpServer,
  closeSocketServer,
  createGracefulShutdown,
  installShutdownSignalHandlers,
} from "./shutdown/graceful-shutdown.js";

const DEFAULT_PORT = 3000;
const parsedPort = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const port = Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;
const reconnectGraceValue = process.env.PLAYER_RECONNECT_GRACE_MS;
const parsedReconnectGraceMs =
  reconnectGraceValue !== undefined && /^\d+$/u.test(reconnectGraceValue)
    ? Number(reconnectGraceValue)
    : Number.NaN;
const reconnectGraceMs = isValidReconnectGraceMs(parsedReconnectGraceMs)
  ? parsedReconnectGraceMs
  : DEFAULT_RECONNECT_GRACE_MS;
const roomsPerIpValue = process.env.MAX_ROOMS_PER_IP_PER_DAY;
const roomsPerIpPerDay =
  roomsPerIpValue !== undefined && /^[1-9]\d*$/u.test(roomsPerIpValue)
    ? Number(roomsPerIpValue)
    : undefined;
const allowedSocketOrigins = (process.env.SOCKET_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

// Render fournit le commit déployé ; il est exposé par /api/health pour prouver la version servie.
const renderCommit = process.env.RENDER_GIT_COMMIT;
const commit =
  renderCommit !== undefined && /^[0-9a-f]{7,40}$/u.test(renderCommit)
    ? renderCommit.slice(0, 7)
    : undefined;

const { dispose, httpServer, io } = createDrawingGameServer({
  commit,
  reconnectGraceMs,
  socketGuardOptions: { roomsPerIpPerDay },
  allowedSocketOrigins,
  allowLoopbackSocketOrigins: process.env.NODE_ENV !== "production",
});
const gracefulShutdown = createGracefulShutdown({
  closeSocketServer: () => closeSocketServer(io),
  closeHttpServer: () => closeHttpServer(httpServer),
  dispose,
  exit: (code) => {
    process.exit(code);
  },
});
const uninstallShutdownSignalHandlers = installShutdownSignalHandlers(
  process,
  gracefulShutdown.shutdown,
);

const handleStartupError = (error: Error): void => {
  const errorCode = "code" in error && typeof error.code === "string" ? ` (${error.code})` : "";
  console.error(`[server] Startup failed${errorCode}: ${error.message}`);
  uninstallShutdownSignalHandlers();
  dispose();
  process.exit(1);
};

httpServer.once("error", handleStartupError);

try {
  httpServer.listen(port, "0.0.0.0", () => {
    httpServer.off("error", handleStartupError);
    const address = httpServer.address();
    const listeningPort = address !== null && typeof address !== "string" ? address.port : port;
    console.info(`Drawing game server listening on http://0.0.0.0:${listeningPort}`);
  });
} catch (error) {
  handleStartupError(error instanceof Error ? error : new Error("Unknown server startup error."));
}
