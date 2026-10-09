import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, describe, it } from "node:test";

import type { RestoreSessionSuccessData } from "@drawing-game/shared";

import {
  closeAll,
  connect,
  createReadyRoom,
  DRAWING,
  expectData,
  expectError,
  joinRoomAs,
  latest,
  phaseOf,
  request,
  startServer,
  type TestClient,
  type TestServer,
  until,
} from "./helpers.js";

const servers: TestServer[] = [];
const allClients: TestClient[] = [];

// Les scénarios enchaînent des requêtes plus vite qu'un joueur : le débit par connexion est relevé.
const RELAXED_QUOTAS = { socketGuardOptions: { eventBurst: 1000 } };

async function newServer(options: Parameters<typeof startServer>[0] = {}) {
  const server = await startServer({ ...RELAXED_QUOTAS, ...options });
  servers.push(server);
  return server;
}

async function newReadyRoom(server: TestServer, names: string[]) {
  const room = await createReadyRoom(server, names);
  allClients.push(...room.clients);
  return room;
}

afterEach(async () => {
  closeAll(allClients.splice(0));
  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe("partie complète sur un serveur réel", () => {
  it("joue deux manches, avec refus d'actions interdites, puis revanche et départ", async () => {
    const server = await newServer();
    const { clients, host, roomCode } = await newReadyRoom(server, ["Alice", "Bob", "Chloe"]);
    const [alice, bob, chloe] = clients as [TestClient, TestClient, TestClient];

    expectError(await request(bob, "game:start"), "NOT_HOST");
    expectData(await request(alice, "game:start"));
    await until(() => clients.every((client) => client.secrets.length === 1));
    assert.equal(new Set(clients.map((client) => client.secrets[0]?.prompt.id)).size, 3);
    await until(() => clients.every((client) => phaseOf(client) === "DRAWING"));

    for (let round = 1; round <= 2; round += 1) {
      await until(() => clients.every((client) => client.secrets.length === round));
      await until(() => phaseOf(host) === "DRAWING");
      const roundId = latest(host).game?.turnId;
      assert.ok(clients.every((client) => client.secrets.at(-1)?.turnId === roundId));

      expectData(await request(alice, "drawing:submit", { drawing: DRAWING }));
      expectError(
        await request(alice, "drawing:submit", { drawing: DRAWING }),
        "DRAWING_ALREADY_SUBMITTED",
      );
      expectError(
        await request(bob, "drawing:submit", { drawing: { strokes: [] } }),
        "INVALID_DRAWING",
      );
      expectData(await request(bob, "drawing:submit", { drawing: DRAWING }));
      assert.equal(phaseOf(host), "DRAWING");
      expectData(await request(chloe, "drawing:submit", { drawing: DRAWING }));
      await until(() => phaseOf(host) === "VOTING");

      for (let drawing = 1; drawing <= 3; drawing += 1) {
        const game = latest(host).game;
        assert.ok(game?.currentDrawer);
        const author = clients.find(
          (client) => client.session?.playerId === game.currentDrawer?.id,
        );
        assert.ok(author);
        const [first, second] = clients.filter((client) => client !== author) as [
          TestClient,
          TestClient,
        ];

        expectError(
          await request(author, "guess:submit", { turnId: game.turnId, value: 5 }),
          "DRAWER_CANNOT_GUESS",
        );
        expectError(
          await request(first, "guess:submit", { turnId: randomUUID(), value: 5 }),
          "STALE_TURN",
        );
        expectError(
          await request(first, "guess:submit", { turnId: game.turnId, value: 11 }),
          "INVALID_GUESS",
        );
        expectError(await request(host, "game:continue"), "NOT_REVEAL_PHASE");
        expectData(await request(first, "guess:submit", { turnId: game.turnId, value: 4 }));
        expectError(
          await request(first, "guess:submit", { turnId: game.turnId, value: 4 }),
          "GUESS_ALREADY_SUBMITTED",
        );
        expectData(await request(second, "guess:submit", { turnId: game.turnId, value: 7 }));
        await until(() => phaseOf(host) === "REVEAL");
        expectError(
          await request(first, "guess:submit", { turnId: game.turnId, value: 4 }),
          "NOT_VOTING_PHASE",
        );
        expectError(await request(bob, "game:continue"), "NOT_HOST");

        expectData(await request(host, "game:continue"));
        if (drawing < 3) {
          await until(() => phaseOf(host) === "VOTING");
        }
      }

      if (round === 1) {
        await until(() => phaseOf(host) === "ROUND_INTRO" || phaseOf(host) === "DRAWING");
        await until(() => phaseOf(host) === "DRAWING");
      }
    }

    await until(() => phaseOf(host) === "FINISHED");
    expectError(await request(host, "game:continue"), "GAME_ALREADY_FINISHED");
    expectError(await request(bob, "game:request-rematch"), "NOT_HOST");
    expectError(
      await request(host, "game:request-rematch", { extra: true }),
      "INVALID_GAME_REMATCH_REQUEST",
    );
    expectData(await request(host, "game:request-rematch"));
    await until(() => latest(bob).game === null);

    expectData(await request(chloe, "room:leave"));
    await until(() => latest(host).playerCount === 2);
    assert.equal(latest(host).code, roomCode);
  });
});

describe("restauration, déconnexion et expiration", () => {
  it("restaure une session, refuse les mauvais identifiants et annule la partie à l'expiration", async () => {
    const server = await newServer({ reconnectGraceMs: 400 });
    const { clients, host } = await newReadyRoom(server, ["Alice", "Bob", "Chloe"]);
    const [alice, bob, chloe] = clients as [TestClient, TestClient, TestClient];
    expectData(await request(alice, "game:start"));
    await until(() => phaseOf(host) === "DRAWING");

    const credentials = bob.session;
    assert.ok(credentials);
    bob.socket.disconnect();
    await until(() => latest(alice).players.some((player) => !player.isConnected));

    const restoring = await connectAs(server, "Bob-bis");
    const wrongToken = {
      ...credentials,
      token: "A".repeat(43),
      clientInstanceId: bob.clientInstanceId,
    };
    expectError(await request(restoring, "session:restore", wrongToken), "INVALID_SESSION");
    expectError(
      await request(restoring, "session:restore", { ...credentials, token: "short" }),
      "INVALID_SESSION",
    );
    const restored = expectData(
      await request<RestoreSessionSuccessData>(restoring, "session:restore", {
        ...credentials,
        clientInstanceId: bob.clientInstanceId,
      }),
    );
    assert.equal(restored.session.playerId, credentials.playerId);
    assert.ok(restored.privateState.secretLevel !== null);
    assert.ok(restored.privateState.prompt !== null);
    await until(() => latest(alice).players.every((player) => player.isConnected));

    const intruder = await connectAs(server, "Intrus");
    expectError(
      await request(intruder, "session:restore", {
        ...credentials,
        clientInstanceId: randomUUID(),
      }),
      "SESSION_ALREADY_ACTIVE",
    );

    // Chloe disparaît plus longtemps que le délai de reconnexion.
    const chloeCredentials = chloe.session;
    assert.ok(chloeCredentials);
    chloe.socket.disconnect();
    await until(() => alice.cancellations.length > 0, 3000);
    assert.equal(alice.cancellations[0]?.reason, "RECONNECT_TIMEOUT");
    await until(() => latest(alice).playerCount === 2);
    expectError(
      await request(intruder, "session:restore", {
        ...chloeCredentials,
        clientInstanceId: chloe.clientInstanceId,
      }),
      "PLAYER_NOT_FOUND",
    );
  });

  it("annule la partie quand un joueur la quitte et transfère l'hôte", async () => {
    const server = await newServer();
    const { clients, host } = await newReadyRoom(server, ["Alice", "Bob", "Chloe"]);
    const [alice, bob] = clients as [TestClient, TestClient, TestClient];
    expectData(await request(alice, "game:start"));
    await until(() => phaseOf(host) === "DRAWING");

    expectData(await request(alice, "room:leave"));
    await until(() => bob.cancellations.length > 0);
    assert.equal(bob.cancellations[0]?.reason, "PLAYER_LEFT");
    await until(() =>
      latest(bob).players.some((player) => player.isHost && player.id !== host.session?.playerId),
    );
    assert.equal(latest(bob).game, null);
  });
});

describe("refus de saisies et de commandes", () => {
  const invalidNicknames = ["", "A", "x".repeat(21), "bad<name>", "tab\tname", 12];

  for (const nickname of invalidNicknames) {
    it(`refuse le pseudonyme ${JSON.stringify(nickname)}`, async () => {
      const server = await newServer();
      const client = await connectAs(server, "Testeur");
      expectError(
        await request(client, "room:create", {
          nickname,
          clientInstanceId: client.clientInstanceId,
        }),
        "INVALID_NICKNAME",
      );
    });
  }

  it("refuse les charges utiles mal formées et les commandes hors contexte", async () => {
    const server = await newServer();
    const client = await connectAs(server, "Testeur");

    expectError(await request(client, "room:create", undefined), "INVALID_NICKNAME");
    expectError(await request(client, "room:create", { nickname: "Alice" }), "INVALID_NICKNAME");
    expectError(
      await request(client, "room:create", { nickname: "Alice", clientInstanceId: "pas-un-uuid" }),
      "INVALID_SESSION",
    );
    expectError(await request(client, "room:join", { nickname: "Alice" }), "INVALID_NICKNAME");
    expectError(
      await request(client, "room:join", {
        nickname: "Alice",
        roomCode: "12",
        clientInstanceId: client.clientInstanceId,
      }),
      "INVALID_ROOM_CODE",
    );
    expectError(
      await request(client, "room:join", {
        nickname: "Alice",
        roomCode: "ZZZZZ",
        clientInstanceId: client.clientInstanceId,
      }),
      "ROOM_NOT_FOUND",
    );
    expectError(
      await request(client, "player:set-ready", { isReady: "oui" }),
      "INVALID_READY_STATUS",
    );
    expectError(await request(client, "player:set-ready", { isReady: true }), "NOT_IN_ROOM");
    expectError(await request(client, "game:start", { extra: 1 }), "INVALID_GAME_START_REQUEST");
    expectError(await request(client, "game:start"), "NOT_IN_ROOM");
    expectError(
      await request(client, "game:continue", { extra: 1 }),
      "INVALID_GAME_CONTINUE_REQUEST",
    );
    expectError(await request(client, "game:continue"), "NOT_IN_ROOM");
    expectError(
      await request(client, "game:request-rematch", { extra: 1 }),
      "INVALID_GAME_REMATCH_REQUEST",
    );
    expectError(await request(client, "drawing:submit", { drawing: DRAWING }), "NOT_IN_ROOM");
    expectError(await request(client, "guess:submit", { turnId: "x", value: 5 }), "NOT_IN_ROOM");
    expectError(await request(client, "room:leave"), "NOT_IN_ROOM");
    expectError(await request(client, "session:restore", { roomCode: "ABCDE" }), "INVALID_SESSION");
  });

  it("refuse un pseudonyme déjà pris, un salon plein et une partie déjà commencée", async () => {
    const server = await newServer();
    const names = ["Alice", "Bob", "Chloe", "Dan", "Eve", "Fay"];
    const { clients, host, roomCode } = await newReadyRoom(server, names);

    const extra = await connectAs(server, "Gus");
    expectError(
      await request(extra, "room:join", {
        nickname: "gus",
        roomCode,
        clientInstanceId: extra.clientInstanceId,
      }),
      "ROOM_FULL",
    );

    expectData(await request(host, "game:start"));
    await until(() => phaseOf(host) === "DRAWING");
    expectError(
      await request(extra, "room:join", {
        nickname: "Gus",
        roomCode,
        clientInstanceId: extra.clientInstanceId,
      }),
      "GAME_ALREADY_STARTED",
    );
    expectError(await request(clients[1] as TestClient, "game:start"), "NOT_HOST");
    expectError(
      await request(clients[1] as TestClient, "player:set-ready", { isReady: false }),
      "GAME_ALREADY_STARTED",
    );
  });

  it("refuse un doublon de pseudonyme sans tenir compte de la casse", async () => {
    const server = await newServer();
    const { host, roomCode } = await newReadyRoom(server, ["Alice", "Bob"]);
    assert.ok(host);

    const other = await connectAs(server, "Autre");
    expectError(
      await request(other, "room:join", {
        nickname: "bob",
        roomCode,
        clientInstanceId: other.clientInstanceId,
      }),
      "NICKNAME_ALREADY_USED",
    );
    const joined = await joinRoomAs(other, roomCode, "Carole");
    assert.equal(joined.session.roomCode, roomCode);
  });
});

async function connectAs(server: TestServer, name: string) {
  const client = await connect(server, name);
  allClients.push(client);
  return client;
}
