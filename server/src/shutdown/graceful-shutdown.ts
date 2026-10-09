export const DEFAULT_FORCE_SHUTDOWN_DELAY_MS = 25_000;

export type ShutdownSignal = "SIGINT" | "SIGTERM";

export interface ShutdownLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface ShutdownSignalSource {
  once(signal: ShutdownSignal, listener: () => void): unknown;
  off(signal: ShutdownSignal, listener: () => void): unknown;
}

export interface GracefulShutdownOptions {
  closeSocketServer: () => Promise<void>;
  closeHttpServer: () => Promise<void>;
  dispose: () => void;
  exit: (code: number) => void;
  logger?: ShutdownLogger;
  forceShutdownDelayMs?: number;
  scheduleTimeout?: (callback: () => void, delay: number) => unknown;
  clearScheduledTimeout?: (handle: unknown) => void;
}

export interface GracefulShutdownController {
  shutdown(signal: ShutdownSignal): Promise<void>;
  readonly isShuttingDown: boolean;
}

export interface SocketServerCloser {
  close(callback: (error?: Error) => void): unknown;
}

export interface HttpServerCloser {
  readonly listening: boolean;
  close(callback: (error?: Error) => void): unknown;
}

const defaultLogger: ShutdownLogger = {
  info: (message) => {
    console.info(message);
  },
  error: (message) => {
    console.error(message);
  },
};

function defaultScheduleTimeout(
  callback: () => void,
  delay: number,
): ReturnType<typeof setTimeout> {
  const timer = setTimeout(callback, delay);
  timer.unref();
  return timer;
}

function defaultClearScheduledTimeout(handle: unknown): void {
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function isServerNotRunningError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_SERVER_NOT_RUNNING";
}

export function closeSocketServer(socketServer: SocketServerCloser): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      socketServer.close((error) => {
        if (error !== undefined && !isServerNotRunningError(error)) {
          reject(error);
          return;
        }

        resolve();
      });
    } catch (error) {
      if (isServerNotRunningError(error)) {
        resolve();
        return;
      }

      reject(error);
    }
  });
}

export function closeHttpServer(httpServer: HttpServerCloser): Promise<void> {
  if (!httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      httpServer.close((error) => {
        if (error !== undefined && !isServerNotRunningError(error)) {
          reject(error);
          return;
        }

        resolve();
      });
    } catch (error) {
      if (isServerNotRunningError(error)) {
        resolve();
        return;
      }

      reject(error);
    }
  });
}

export function createGracefulShutdown(
  options: GracefulShutdownOptions,
): GracefulShutdownController {
  const logger = options.logger ?? defaultLogger;
  const forceShutdownDelayMs = options.forceShutdownDelayMs ?? DEFAULT_FORCE_SHUTDOWN_DELAY_MS;
  const scheduleTimeout = options.scheduleTimeout ?? defaultScheduleTimeout;
  const clearScheduledTimeout = options.clearScheduledTimeout ?? defaultClearScheduledTimeout;

  if (!Number.isSafeInteger(forceShutdownDelayMs) || forceShutdownDelayMs < 1) {
    throw new RangeError("forceShutdownDelayMs must be a positive safe integer.");
  }

  let shutdownPromise: Promise<void> | null = null;
  let exitRequested = false;
  let forceTimeout: unknown;

  const requestExit = (code: number): void => {
    if (exitRequested) {
      return;
    }

    exitRequested = true;
    options.exit(code);
  };

  const shutdown = (signal: ShutdownSignal): Promise<void> => {
    if (shutdownPromise !== null) {
      return shutdownPromise;
    }

    logger.info(`[shutdown] ${signal} received.`);
    forceTimeout = scheduleTimeout(() => {
      try {
        options.dispose();
      } catch {
        // The forced exit remains the last-resort path even if cleanup fails.
      }

      logger.error(`[shutdown] Forced after ${forceShutdownDelayMs} ms.`);
      requestExit(1);
    }, forceShutdownDelayMs);

    shutdownPromise = (async () => {
      let shutdownFailed = false;

      try {
        await options.closeSocketServer();
      } catch {
        shutdownFailed = true;
      }

      try {
        await options.closeHttpServer();
      } catch {
        shutdownFailed = true;
      }

      try {
        options.dispose();
      } catch {
        shutdownFailed = true;
      }

      clearScheduledTimeout(forceTimeout);

      if (shutdownFailed) {
        logger.error("[shutdown] Failed while closing resources.");
        requestExit(1);
        return;
      }

      if (!exitRequested) {
        logger.info("[shutdown] Complete.");
        requestExit(0);
      }
    })();

    return shutdownPromise;
  };

  return {
    shutdown,
    get isShuttingDown() {
      return shutdownPromise !== null;
    },
  };
}

export function installShutdownSignalHandlers(
  signalSource: ShutdownSignalSource,
  shutdown: (signal: ShutdownSignal) => Promise<void>,
): () => void {
  let installed = true;
  let signalHandled = false;

  const uninstall = (): void => {
    if (!installed) {
      return;
    }

    installed = false;
    signalSource.off("SIGTERM", handleSigterm);
    signalSource.off("SIGINT", handleSigint);
  };

  const handleSignal = (signal: ShutdownSignal): void => {
    if (signalHandled) {
      return;
    }

    signalHandled = true;
    uninstall();
    void shutdown(signal).catch(() => undefined);
  };

  const handleSigterm = (): void => {
    handleSignal("SIGTERM");
  };
  const handleSigint = (): void => {
    handleSignal("SIGINT");
  };

  signalSource.once("SIGTERM", handleSigterm);
  signalSource.once("SIGINT", handleSigint);

  return uninstall;
}
