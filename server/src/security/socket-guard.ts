import {
  ACCESS_FAILURE_CODES,
  CONNECTIONS_PER_IP,
  FAILED_JOIN_WINDOW_MS,
  FAILED_JOINS_PER_IP,
  FAILED_JOINS_PER_SOCKET,
  ROOM_CREATION_WINDOW_MS,
  ROOMS_CREATED_PER_IP_PER_DAY,
  SOCKET_EVENT_BURST,
  SOCKET_EVENT_REFILL_INTERVAL_MS,
} from "./limits.js";
import { type Clock, type RateDecision, TokenBucketLimiter, WindowQuota } from "./rate-limiter.js";

/** Valeurs de quotas ; les valeurs de production sont définies dans `limits.ts`. */
export interface SocketGuardOptions {
  eventBurst?: number;
  eventRefillIntervalMs?: number;
  connectionsPerIp?: number;
  roomsPerIpPerDay?: number;
  failedJoinsPerSocket?: number;
  failedJoinsPerIp?: number;
  clock?: Clock;
}

/** Applique les quotas d'admission et de débit aux connexions Socket.IO. */
export class SocketGuard {
  private readonly connectionsByIp = new Map<string, number>();
  private readonly connectionsPerIp: number;
  private readonly eventLimiter: TokenBucketLimiter;
  private readonly roomCreations: WindowQuota;
  private readonly failuresBySocket: WindowQuota;
  private readonly failuresByIp: WindowQuota;

  constructor(options: SocketGuardOptions = {}) {
    this.connectionsPerIp = options.connectionsPerIp ?? CONNECTIONS_PER_IP;
    this.eventLimiter = new TokenBucketLimiter({
      capacity: options.eventBurst ?? SOCKET_EVENT_BURST,
      refillIntervalMs: options.eventRefillIntervalMs ?? SOCKET_EVENT_REFILL_INTERVAL_MS,
      clock: options.clock,
    });
    this.roomCreations = new WindowQuota({
      limit: options.roomsPerIpPerDay ?? ROOMS_CREATED_PER_IP_PER_DAY,
      windowMs: ROOM_CREATION_WINDOW_MS,
      clock: options.clock,
    });
    this.failuresBySocket = new WindowQuota({
      limit: options.failedJoinsPerSocket ?? FAILED_JOINS_PER_SOCKET,
      windowMs: FAILED_JOIN_WINDOW_MS,
      clock: options.clock,
    });
    this.failuresByIp = new WindowQuota({
      limit: options.failedJoinsPerIp ?? FAILED_JOINS_PER_IP,
      windowMs: FAILED_JOIN_WINDOW_MS,
      clock: options.clock,
    });
  }

  canAcceptConnection(ip: string): boolean {
    return (this.connectionsByIp.get(ip) ?? 0) < this.connectionsPerIp;
  }

  registerConnection(ip: string): void {
    this.connectionsByIp.set(ip, (this.connectionsByIp.get(ip) ?? 0) + 1);
  }

  releaseConnection(ip: string): void {
    const remaining = (this.connectionsByIp.get(ip) ?? 0) - 1;
    if (remaining > 0) {
      this.connectionsByIp.set(ip, remaining);
    } else {
      this.connectionsByIp.delete(ip);
    }
  }

  consumeEvent(socketId: string): RateDecision {
    return this.eventLimiter.consume(socketId);
  }

  canCreateRoom(ip: string): boolean {
    return !this.roomCreations.isExhausted(ip);
  }

  recordRoomCreated(ip: string): void {
    this.roomCreations.record(ip);
  }

  isAccessBlocked(socketId: string, ip: string): boolean {
    return this.failuresBySocket.isExhausted(socketId) || this.failuresByIp.isExhausted(ip);
  }

  retryAccessAfterMs(socketId: string, ip: string): number {
    return Math.max(
      this.failuresBySocket.isExhausted(socketId)
        ? this.failuresBySocket.retryAfterMs(socketId)
        : 0,
      this.failuresByIp.isExhausted(ip) ? this.failuresByIp.retryAfterMs(ip) : 0,
    );
  }

  /** Enregistre un échec seulement si le code signale une tentative d'accès refusée. */
  recordAccessFailure(socketId: string, ip: string, code: string | null): void {
    if (code === null || !ACCESS_FAILURE_CODES.has(code)) {
      return;
    }
    this.failuresBySocket.record(socketId);
    this.failuresByIp.record(ip);
  }

  forgetSocket(socketId: string): void {
    this.eventLimiter.forget(socketId);
    this.failuresBySocket.forget(socketId);
  }

  sweep(): void {
    this.eventLimiter.sweep();
    this.failuresBySocket.sweep();
    this.failuresByIp.sweep();
    this.roomCreations.sweep();
  }
}
