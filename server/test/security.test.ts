import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getClientIp } from "../src/security/client-ip.js";
import { TokenBucketLimiter, WindowQuota } from "../src/security/rate-limiter.js";
import { SocketGuard } from "../src/security/socket-guard.js";
import { FAILED_JOINS_PER_SOCKET, FAILED_JOIN_WINDOW_MS } from "../src/security/limits.js";

function manualClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("TokenBucketLimiter", () => {
  it("accepte une rafale puis refuse et restitue un jeton par intervalle", () => {
    const clock = manualClock();
    const limiter = new TokenBucketLimiter({
      capacity: 5,
      refillIntervalMs: 200,
      clock: clock.now,
    });

    for (let index = 0; index < 5; index += 1) {
      assert.equal(limiter.consume("socket").allowed, true);
    }

    const refused = limiter.consume("socket");
    assert.equal(refused.allowed, false);
    assert.equal(refused.retryAfterMs, 200);

    clock.advance(200);
    assert.equal(limiter.consume("socket").allowed, true);
    assert.equal(limiter.consume("socket").allowed, false);
  });

  it("isole les clés entre elles", () => {
    const clock = manualClock();
    const limiter = new TokenBucketLimiter({
      capacity: 1,
      refillIntervalMs: 1000,
      clock: clock.now,
    });

    assert.equal(limiter.consume("a").allowed, true);
    assert.equal(limiter.consume("a").allowed, false);
    assert.equal(limiter.consume("b").allowed, true);
  });
});

describe("WindowQuota", () => {
  it("bloque à la limite puis se réinitialise à la fin de la fenêtre", () => {
    const clock = manualClock();
    const quota = new WindowQuota({ limit: 2, windowMs: 1000, clock: clock.now });

    quota.record("ip");
    quota.record("ip");
    assert.equal(quota.isExhausted("ip"), true);

    clock.advance(1000);
    assert.equal(quota.isExhausted("ip"), false);
  });
});

describe("getClientIp", () => {
  const cases: [string | string[] | undefined, string | undefined, string][] = [
    ["203.0.113.7", "10.0.0.1", "203.0.113.7"],
    ["198.51.100.9, 203.0.113.7", "10.0.0.1", "203.0.113.7"],
    [["198.51.100.9", "203.0.113.7"], undefined, "203.0.113.7"],
    [undefined, "10.0.0.1", "10.0.0.1"],
    [undefined, undefined, "unknown"],
  ];

  for (const [forwardedFor, remoteAddress, expected] of cases) {
    it(`retient la dernière adresse ajoutée par le proxy (${String(forwardedFor)})`, () => {
      assert.equal(getClientIp(forwardedFor, remoteAddress), expected);
    });
  }
});

describe("SocketGuard", () => {
  it("bloque une connexion après trop d'échecs d'accès, sans compter les autres erreurs", () => {
    const guard = new SocketGuard();
    const ip = "203.0.113.7";

    guard.recordAccessFailure("socket", ip, "VALIDATION_OTHER");
    assert.equal(guard.isAccessBlocked("socket", ip), false);

    for (let index = 0; index < FAILED_JOINS_PER_SOCKET; index += 1) {
      guard.recordAccessFailure("socket", ip, "ROOM_NOT_FOUND");
    }
    assert.equal(guard.isAccessBlocked("socket", ip), true);
    assert.equal(guard.isAccessBlocked("other-socket", "198.51.100.9"), false);
    assert.ok(guard.retryAccessAfterMs("socket", ip) <= FAILED_JOIN_WINDOW_MS);
  });

  it("limite les connexions simultanées par adresse IP", () => {
    const guard = new SocketGuard();
    const ip = "203.0.113.7";

    for (let index = 0; index < 30; index += 1) {
      assert.equal(guard.canAcceptConnection(ip), true);
      guard.registerConnection(ip);
    }
    assert.equal(guard.canAcceptConnection(ip), false);

    guard.releaseConnection(ip);
    assert.equal(guard.canAcceptConnection(ip), true);
  });
});
