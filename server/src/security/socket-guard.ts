import { TokenBucketLimiter, WindowQuota, type RateDecision } from "./rate-limiter.js";
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

/** Applique les quotas d'admission et de débit aux connexions Socket.IO. */
export class SocketGuard {
  private readonly connectionsByIp = new Map<string, number>();
  private readonly eventLimiter = new TokenBucketLimiter({
    capacity: SOCKET_EVENT_BURST,
    refillIntervalMs: SOCKET_EVENT_REFILL_INTERVAL_MS,
  });
  private readonly roomCreations = new WindowQuota({
    limit: ROOMS_CREATED_PER_IP_PER_DAY,
    windowMs: ROOM_CREATION_WINDOW_MS,
  });
  private readonly failuresBySocket = new WindowQuota({
    limit: FAILED_JOINS_PER_SOCKET,
    windowMs: FAILED_JOIN_WINDOW_MS,
  });
  private readonly failuresByIp = new WindowQuota({
    limit: FAILED_JOINS_PER_IP,
    windowMs: FAILED_JOIN_WINDOW_MS,
  });

  canAcceptConnection(ip: string): boolean {
    return (this.connectionsByIp.get(ip) ?? 0) < CONNECTIONS_PER_IP;
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
