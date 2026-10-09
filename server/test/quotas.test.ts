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

async function newServer(options: Parameters<typeof startServer>[0] = {}) {
  const server = await startServer(options);
  servers.push(server);
  return server;
}

async function newClient(server: TestServer, name: string, headers: Record<string, string> = {}) {
  const client = await connect(server, name, headers);
  clients.push(client);
  return client;
}

afterEach(async () => {
  closeAll(clients.splice(0));
  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe("exposition HTTP et origine WebSocket", () => {
  it("expose la santé avec les en-têtes de sécurité et refuse les routes inconnues", async () => {
    const server = await newServer();
    const health = await fetch(`${server.url}/api/health`);

    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok", service: "drawing-game-server" });
    assert.equal(health.headers.get("x-powered-by"), null);
    assert.equal(health.headers.get("x-frame-options"), "DENY");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.match(health.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);

    assert.equal((await fetch(`${server.url}/api/inconnue`)).status, 404);
  });

  const origins: [string, string | null, boolean][] = [
    ["origine étrangère", "https://evil.example", false],
    ["origine non HTTP", "ftp://evil.example", false],
    ["origine du même hôte", "http://127.0.0.1", false],
    ["aucune origine (client non navigateur)", null, true],
  ];

  for (const [label, origin, accepted] of origins) {
    it(`handshake WebSocket : ${label}`, async () => {
      const server = await newServer();
      const headers: Record<string, string> = origin === null ? {} : { Origin: origin };
      // L'origine du même hôte inclut le port du serveur de test.
      if (origin === "http://127.0.0.1") {
        headers.Origin = server.url;
        assert.equal(await tryConnect(server, headers), true);
        return;
      }

      assert.equal(await tryConnect(server, headers), accepted);
    });
  }

  it("accepte une origine explicitement autorisée", async () => {
    const server = await newServer({ allowedSocketOrigins: ["https://jeu.example"] });

    assert.equal(await tryConnect(server, { Origin: "https://jeu.example" }), true);
    assert.equal(await tryConnect(server, { Origin: "https://autre.example" }), false);
  });
});

describe("quotas d'abus", () => {
  it("répond 429 avec Retry-After au-delà de la limite HTTP", async () => {
    const server = await newServer({ apiRequestsPerMinute: 3 });
    const statuses: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await fetch(`${server.url}/api/health`);
      statuses.push(response.status);
      if (response.status === 429) {
        assert.ok(Number(response.headers.get("retry-after")) >= 1);
      }
    }

    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });

  it("refuse les événements au-delà du débit par connexion", async () => {
    const server = await newServer({
      socketGuardOptions: { eventBurst: 3, eventRefillIntervalMs: 60_000 },
    });
    const client = await newClient(server, "Rafale");

    const codes: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const result = await request(client, "room:leave");
      codes.push((result as { error: { code: string } }).error.code);
    }

    assert.deepEqual(codes, [
      "NOT_IN_ROOM",
      "NOT_IN_ROOM",
      "NOT_IN_ROOM",
      "RATE_LIMITED",
      "RATE_LIMITED",
      "RATE_LIMITED",
    ]);
  });

  it("bloque une connexion après cinq échecs de jonction", async () => {
    const server = await newServer({ socketGuardOptions: { eventBurst: 1000 } });
    const client = await newClient(server, "Devin");
    const attempt = () =>
      request(client, "room:join", {
        nickname: "Devin",
        roomCode: "ZZZZZ",
        clientInstanceId: client.clientInstanceId,
      });

    for (let index = 0; index < 5; index += 1) {
      expectError(await attempt(), "ROOM_NOT_FOUND");
    }
    expectError(await attempt(), "RATE_LIMITED");
    expectError(
      await request(client, "session:restore", {
        roomCode: "ABCDE",
        playerId: "p",
        token: "A".repeat(43),
        clientInstanceId: randomUUID(),
      }),
      "RATE_LIMITED",
    );
  });

  it("limite les salons créés par adresse IP, sans mélanger deux adresses", async () => {
    const server = await newServer({
      socketGuardOptions: { eventBurst: 1000, roomsPerIpPerDay: 2 },
    });
    const create = async (headers: Record<string, string>) => {
      const client = await newClient(server, "Hôte", headers);
      return request(client, "room:create", {
        nickname: "Hôte",
        clientInstanceId: client.clientInstanceId,
      });
    };

    expectData(await create({ "X-Forwarded-For": "203.0.113.1" }));
    expectData(await create({ "X-Forwarded-For": "203.0.113.1" }));
    expectError(await create({ "X-Forwarded-For": "203.0.113.1" }), "RATE_LIMITED");
    expectData(await create({ "X-Forwarded-For": "203.0.113.2" }));
  });

  it("refuse les connexions au-delà du maximum par adresse IP", async () => {
    const server = await newServer({ socketGuardOptions: { connectionsPerIp: 2 } });
    await newClient(server, "Un");
    await newClient(server, "Deux");

    assert.equal(await tryConnect(server), false);
  });
});
