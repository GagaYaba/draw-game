export type Clock = () => number;

export interface RateDecision {
  allowed: boolean;
  retryAfterMs: number;
}

export interface TokenBucketOptions {
  /** Nombre maximal de requêtes consécutives acceptées. */
  capacity: number;
  /** Délai minimal entre deux jetons restitués. */
  refillIntervalMs: number;
  clock?: Clock;
}

interface BucketState {
  tokens: number;
  updatedAt: number;
}

/** Limite de débit : rafale jusqu'à `capacity`, puis un jeton par `refillIntervalMs`. */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly clock: Clock;

  constructor(private readonly options: TokenBucketOptions) {
    if (!Number.isSafeInteger(options.capacity) || options.capacity < 1) {
      throw new RangeError("capacity doit être un entier positif.");
    }
    if (!(options.refillIntervalMs > 0)) {
      throw new RangeError("refillIntervalMs doit être strictement positif.");
    }
    this.clock = options.clock ?? Date.now;
  }

  consume(key: string): RateDecision {
    const now = this.clock();
    const { capacity, refillIntervalMs } = this.options;
    const bucket = this.buckets.get(key) ?? { tokens: capacity, updatedAt: now };

    const refilled = Math.floor((now - bucket.updatedAt) / refillIntervalMs);
    if (refilled > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + refilled);
      bucket.updatedAt =
        bucket.tokens === capacity ? now : bucket.updatedAt + refilled * refillIntervalMs;
    }
    this.buckets.set(key, bucket);

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    }

    return { allowed: false, retryAfterMs: bucket.updatedAt + refillIntervalMs - now };
  }

  forget(key: string): void {
    this.buckets.delete(key);
  }

  /** Retire les compartiments entièrement reconstitués pour borner la mémoire. */
  sweep(): void {
    const now = this.clock();
    const fullDuration = this.options.capacity * this.options.refillIntervalMs;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt >= fullDuration) {
        this.buckets.delete(key);
      }
    }
  }
}

export interface WindowQuotaOptions {
  /** Nombre d'événements autorisés dans une fenêtre. */
  limit: number;
  windowMs: number;
  clock?: Clock;
}

interface WindowState {
  count: number;
  windowStart: number;
}

/** Quota à fenêtre fixe : `limit` événements par `windowMs`, par clé. */
export class WindowQuota {
  private readonly windows = new Map<string, WindowState>();
  private readonly clock: Clock;

  constructor(private readonly options: WindowQuotaOptions) {
    if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
      throw new RangeError("limit doit être un entier positif.");
    }
    if (!(options.windowMs > 0)) {
      throw new RangeError("windowMs doit être strictement positif.");
    }
    this.clock = options.clock ?? Date.now;
  }

  isExhausted(key: string): boolean {
    return this.current(key).count >= this.options.limit;
  }

  record(key: string): void {
    this.current(key).count += 1;
  }

  retryAfterMs(key: string): number {
    const window = this.current(key);
    return Math.max(0, window.windowStart + this.options.windowMs - this.clock());
  }

  forget(key: string): void {
    this.windows.delete(key);
  }

  sweep(): void {
    const now = this.clock();
    for (const [key, window] of this.windows) {
      if (now - window.windowStart >= this.options.windowMs) {
        this.windows.delete(key);
      }
    }
  }

  private current(key: string): WindowState {
    const now = this.clock();
    const existing = this.windows.get(key);
    if (existing !== undefined && now - existing.windowStart < this.options.windowMs) {
      return existing;
    }

    const window = { count: 0, windowStart: now };
    this.windows.set(key, window);
    return window;
  }
}
