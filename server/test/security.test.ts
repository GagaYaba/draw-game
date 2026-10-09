import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getClientIp } from "../src/security/client-ip.js";
import { FAILED_JOIN_WINDOW_MS, FAILED_JOINS_PER_SOCKET } from "../src/security/limits.js";
import { TokenBucketLimiter, WindowQuota } from "../src/security/rate-limiter.js";
import { SocketGuard } from "../src/security/socket-guard.js";

function manualClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("quotas d'abus", () => {
  // Risque : un limiteur faux bloque des joueurs légitimes ou laisse passer un flood.
  it("limite le débit, les fenêtres de quota et lit l'adresse ajoutée par le proxy", () => {
    const clock = manualClock();
    const bucket = new TokenBucketLimiter({ capacity: 3, refillIntervalMs: 200, clock: clock.now });
    for (let index = 0; index < 3; index += 1) {
      assert.equal(bucket.consume("a").allowed, true);
    }
    const refused = bucket.consume("a");
    assert.equal(refused.allowed, false);
    assert.equal(refused.retryAfterMs, 200);
    assert.equal(bucket.consume("b").allowed, true, "les clés sont indépendantes");
    clock.advance(200);
    assert.equal(bucket.consume("a").allowed, true, "un jeton est restitué par intervalle");

    const quota = new WindowQuota({ limit: 2, windowMs: 1000, clock: clock.now });
    quota.record("ip");
    quota.record("ip");
    assert.equal(quota.isExhausted("ip"), true);
    clock.advance(1000);
    assert.equal(quota.isExhausted("ip"), false, "la fenêtre se réinitialise");

    // Seule la dernière adresse de X-Forwarded-For est fiable : c'est celle du proxy.
    assert.equal(getClientIp("198.51.100.9, 203.0.113.7", "10.0.0.1"), "203.0.113.7");
    assert.equal(getClientIp(["198.51.100.9", "203.0.113.7"], undefined), "203.0.113.7");
    assert.equal(getClientIp(undefined, "10.0.0.1"), "10.0.0.1");
    assert.equal(getClientIp(undefined, undefined), "unknown");
  });

  it("bloque une connexion après cinq échecs d'accès et plafonne les connexions par adresse", () => {
    const guard = new SocketGuard({ connectionsPerIp: 2 });
    const ip = "203.0.113.7";

    guard.recordAccessFailure("socket", ip, "AUTRE_ERREUR");
    assert.equal(guard.isAccessBlocked("socket", ip), false, "seuls les échecs d'accès comptent");
    for (let index = 0; index < FAILED_JOINS_PER_SOCKET; index += 1) {
      guard.recordAccessFailure("socket", ip, "ROOM_NOT_FOUND");
    }
    assert.equal(guard.isAccessBlocked("socket", ip), true);
    assert.ok(guard.retryAccessAfterMs("socket", ip) <= FAILED_JOIN_WINDOW_MS);

    guard.registerConnection(ip);
    guard.registerConnection(ip);
    assert.equal(guard.canAcceptConnection(ip), false);
    guard.releaseConnection(ip);
    assert.equal(guard.canAcceptConnection(ip), true);
  });
});
