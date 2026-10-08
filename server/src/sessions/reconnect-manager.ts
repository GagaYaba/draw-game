import type { GameManager } from "../game/game-manager.js";
import type { PlayerDisconnectionResult, RoomDepartureResult } from "../rooms/room-types.js";
import type { RoomManager } from "../rooms/room-manager.js";

export const DEFAULT_RECONNECT_GRACE_MS = 60_000;
export const MAX_RECONNECT_TIMER_DELAY_MS = 2_147_483_647;

export function isValidReconnectGraceMs(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_RECONNECT_TIMER_DELAY_MS
  );
}

export type ReconnectClock = () => number;
export type ReconnectTimerScheduler = (callback: () => void, delayMilliseconds: number) => unknown;
export type ReconnectTimerClearer = (handle: unknown) => void;

export interface ReconnectExpirationResult {
  departure: RoomDepartureResult;
  gameWasCancelled: boolean;
}

export interface ReconnectManagerOptions {
  graceMs?: number;
  clock?: ReconnectClock;
  scheduleTimer?: ReconnectTimerScheduler;
  clearTimer?: ReconnectTimerClearer;
  onPlayerExpired?: (result: ReconnectExpirationResult) => void;
  onError?: (error: unknown) => void;
}

interface ScheduledReconnectExpiration {
  roomCode: string;
  playerId: string;
  reconnectDeadline: number;
  handle: unknown;
  hasHandle: boolean;
}

function defaultScheduleTimer(callback: () => void, delayMilliseconds: number): unknown {
  return setTimeout(callback, delayMilliseconds);
}

function defaultClearTimer(handle: unknown): void {
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function reconnectTimerKey(roomCode: string, playerId: string): string {
  return `${roomCode}\u0000${playerId}`;
}

export class ReconnectManager {
  readonly reconnectGraceMs: number;

  private readonly clock: ReconnectClock;
  private readonly scheduleTimer: ReconnectTimerScheduler;
  private readonly clearTimer: ReconnectTimerClearer;
  private readonly onPlayerExpired: (result: ReconnectExpirationResult) => void;
  private readonly onError: (error: unknown) => void;
  private readonly timers = new Map<string, ScheduledReconnectExpiration>();

  constructor(
    private readonly roomManager: RoomManager,
    private readonly gameManager: GameManager,
    options: ReconnectManagerOptions = {},
  ) {
    this.reconnectGraceMs = options.graceMs ?? DEFAULT_RECONNECT_GRACE_MS;
    this.clock = options.clock ?? Date.now;
    this.scheduleTimer = options.scheduleTimer ?? defaultScheduleTimer;
    this.clearTimer = options.clearTimer ?? defaultClearTimer;
    this.onPlayerExpired = options.onPlayerExpired ?? (() => undefined);
    this.onError =
      options.onError ??
      ((error) => {
        console.error("[sessions] Reconnect expiration failed", error);
      });

    if (!isValidReconnectGraceMs(this.reconnectGraceMs)) {
      throw new RangeError(
        `graceMs doit être un entier compris entre 0 et ${MAX_RECONNECT_TIMER_DELAY_MS}.`,
      );
    }
  }

  markPlayerDisconnected(socketId: string): PlayerDisconnectionResult | null {
    const disconnectedAt = this.clock();
    const reconnectDeadline = disconnectedAt + this.reconnectGraceMs;

    if (!Number.isFinite(disconnectedAt) || !Number.isFinite(reconnectDeadline)) {
      throw new RangeError("Impossible de dater la déconnexion du joueur.");
    }

    const disconnection = this.roomManager.markPlayerDisconnected(
      socketId,
      disconnectedAt,
      reconnectDeadline,
    );

    if (disconnection === null) {
      return null;
    }

    try {
      this.scheduleReconnectExpiration(
        disconnection.roomCode,
        disconnection.playerId,
        reconnectDeadline,
      );
      return disconnection;
    } catch (error) {
      this.onError(error);
      try {
        this.expireDisconnectedPlayer(
          disconnection.roomCode,
          disconnection.playerId,
          reconnectDeadline,
          true,
        );
      } catch (expirationError) {
        this.onError(expirationError);
      }
      return null;
    }
  }

  clearPlayerReconnectTimer(roomCode: string, playerId: string): void {
    const key = reconnectTimerKey(roomCode, playerId);
    const scheduled = this.timers.get(key);

    if (scheduled === undefined) {
      return;
    }

    if (scheduled.hasHandle) {
      this.clearTimer(scheduled.handle);
    }
    this.timers.delete(key);
  }

  clearRoomReconnectTimers(roomCode: string): void {
    for (const scheduled of [...this.timers.values()]) {
      if (scheduled.roomCode === roomCode) {
        this.clearPlayerReconnectTimer(scheduled.roomCode, scheduled.playerId);
      }
    }
  }

  getPendingTimerCount(): number {
    return this.timers.size;
  }

  dispose(): void {
    for (const scheduled of this.timers.values()) {
      if (scheduled.hasHandle) {
        this.clearTimer(scheduled.handle);
      }
    }
    this.timers.clear();
  }

  private scheduleReconnectExpiration(
    roomCode: string,
    playerId: string,
    reconnectDeadline: number,
  ): void {
    this.clearPlayerReconnectTimer(roomCode, playerId);
    const key = reconnectTimerKey(roomCode, playerId);
    const delayMilliseconds = Math.max(0, reconnectDeadline - this.clock());
    const scheduled: ScheduledReconnectExpiration = {
      roomCode,
      playerId,
      reconnectDeadline,
      handle: undefined,
      hasHandle: false,
    };
    this.timers.set(key, scheduled);

    try {
      const handle = this.scheduleTimer(() => {
        const current = this.timers.get(key);

        if (current !== scheduled) {
          return;
        }

        this.timers.delete(key);

        try {
          if (this.clock() < reconnectDeadline) {
            this.scheduleReconnectExpiration(roomCode, playerId, reconnectDeadline);
            return;
          }

          this.expireDisconnectedPlayer(roomCode, playerId, reconnectDeadline);
        } catch (error) {
          this.onError(error);
        }
      }, delayMilliseconds);

      if (this.timers.get(key) === scheduled) {
        scheduled.handle = handle;
        scheduled.hasHandle = true;
      } else {
        this.clearTimer(handle);
      }
    } catch (error) {
      if (this.timers.get(key) === scheduled) {
        this.timers.delete(key);
      }
      throw error;
    }
  }

  private expireDisconnectedPlayer(
    roomCode: string,
    playerId: string,
    reconnectDeadline: number,
    forceExpiration = false,
  ): void {
    if (!forceExpiration && this.clock() < reconnectDeadline) {
      this.scheduleReconnectExpiration(roomCode, playerId, reconnectDeadline);
      return;
    }

    if (!this.roomManager.isReconnectExpirationCurrent(roomCode, playerId, reconnectDeadline)) {
      return;
    }

    const gameWasCancelled = this.gameManager.cancelGame(roomCode);
    const departure = this.roomManager.removePlayerById(roomCode, playerId);

    if (departure === null) {
      return;
    }

    if (departure.roomDeleted) {
      this.clearRoomReconnectTimers(roomCode);
    }

    this.onPlayerExpired({ departure, gameWasCancelled });
  }
}
