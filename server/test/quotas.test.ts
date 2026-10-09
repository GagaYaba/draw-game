import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, describe, it } from "node:test";

import {
  closeAll,
  connect,
  expectData,
  expectError,
  request,
  startServer,
  type TestClient,
  type TestServer,
  tryConnect,
} from "./helpers.js";

const servers: TestServer[] = [];
const clients: TestClient[] = [];
const securityEvents: string[] = [];

async function newServer(options: Parameters<typeof startServer>[0] = {}) {
  const server = await startServer({
    securityReporter: (type) => void securityEvents.push(type),
    ...options,
  });
  servers.push(server);
  return server;
}

async function newClient(server: TestServer, name: string, headers: Record<string, string> = {}) {
  const client = await connect(server, name, headers);
  clients.push(client);
  return client;
}

afterEach(async () => {
  securityEvents.splice(0);
  closeAll(clients.splice(0));
  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe("exposition HTTP et WebSocket", () => {
  // Risque : un site tiers ou un navigateur mal protégé exploite le serveur (en-têtes, origine).
  it("expose la santé avec les en-têtes de sécurité et refuse les origines WebSocket étrangères", async () => {
    const server = await newServer({ allowedSocketOrigins: ["https://jeu.example"] });
    const health = await fetch(`${server.url}/api/health`);

    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok", service: "drawing-game-server" });
    assert.equal(health.headers.get("x-powered-by"), null);
    assert.equal(health.headers.get("strict-transport-security"), null, "pas de HSTS en HTTP");
    const secure = await fetch(`${server.url}/api/health`, {
      headers: { "x-forwarded-proto": "https" },
    });
    assert.match(secure.headers.get("strict-transport-security") ?? "", /max-age=[0-9]+/);
    assert.equal(health.headers.get("x-frame-options"), "DENY");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.match(health.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal((await fetch(`${server.url}/api/inconnue`)).status, 404);

    assert.equal(await tryConnect(server), true, "client non navigateur");
    assert.equal(await tryConnect(server, { Origin: server.url }), true, "même hôte");
    assert.equal(
      await tryConnect(server, { Origin: "https://jeu.example" }),
      true,
      "origine autorisée",
    );
    assert.equal(
      await tryConnect(server, { Origin: "https://evil.example" }),
      false,
      "origine étrangère",
    );
    assert.ok(securityEvents.includes("origin_refused"), "l'origine refusée est journalisée");
  });
});

describe("quotas d'abus", () => {
  // Risque : un flood HTTP ou Socket.IO épuise le CPU de l'instance unique.
  it("répond 429 au-delà de la limite HTTP et refuse les événements au-delà du débit", async () => {
    const http = await newServer({ apiRequestsPerMinute: 3 });
    const statuses: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await fetch(`${http.url}/api/health`);
      statuses.push(response.status);
      if (response.status === 429) {
        assert.ok(Number(response.headers.get("retry-after")) >= 1);
      }
    }
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);

    const sockets = await newServer({
      socketGuardOptions: { eventBurst: 3, eventRefillIntervalMs: 60_000 },
    });
    const client = await newClient(sockets, "Rafale");
    const codes: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const result = await request(client, "room:leave");
      codes.push((result as { error: { code: string } }).error.code);
    }
    assert.deepEqual(codes, [
      "NOT_IN_ROOM",
      "NOT_IN_ROOM",
      "NOT_IN_ROOM",
      "RATE_LIMITED",
      "RATE_LIMITED",
    ]);
    assert.ok(securityEvents.includes("http_rate_limited"), "le flood HTTP est journalisé");
    assert.ok(
      securityEvents.includes("event_rate_limited"),
      "le flood d'événements est journalisé",
    );
  });

  // Risque : énumération de codes de salon, création massive de salons, saturation des connexions.
  it("bloque les échecs de jonction répétés et limite salons et connexions par adresse IP", async () => {
    const guard = await newServer({
      socketGuardOptions: { eventBurst: 1000, roomsPerIpPerDay: 2, connectionsPerIp: 4 },
    });
    const guesser = await newClient(guard, "Devin");
    const attempt = () =>
      request(guesser, "room:join", {
        nickname: "Devin",
        roomCode: "ZZZZZ",
        clientInstanceId: guesser.clientInstanceId,
      });
    for (let index = 0; index < 5; index += 1) {
      expectError(await attempt(), "ROOM_NOT_FOUND");
    }
    expectError(await attempt(), "RATE_LIMITED");
    expectError(
      await request(guesser, "session:restore", {
        roomCode: "ABCDE",
        playerId: "p",
        token: "A".repeat(43),
        clientInstanceId: randomUUID(),
      }),
      "RATE_LIMITED",
    );

    const create = async (ip: string) => {
      const host = await newClient(guard, "Hôte", { "X-Forwarded-For": ip });
      return request(host, "room:create", {
        nickname: "Hôte",
        clientInstanceId: host.clientInstanceId,
      });
    };
    expectData(await create("203.0.113.1"));
    expectData(await create("203.0.113.1"));
    expectError(await create("203.0.113.1"), "RATE_LIMITED");
    expectData(await create("203.0.113.2"));

    const full = await newServer({ socketGuardOptions: { connectionsPerIp: 2 } });
    await newClient(full, "Un");
    await newClient(full, "Deux");
    assert.equal(await tryConnect(full), false, "la troisième connexion est refusée");

    for (const event of [
      "access_failed",
      "access_blocked",
      "room_creation_limited",
      "connection_limit",
    ]) {
      assert.ok(securityEvents.includes(event), `${event} est journalisé`);
    }
  });
});
