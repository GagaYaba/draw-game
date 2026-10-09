import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import type {
  ActionResult,
  DrawingDocument,
  GameCancelledPayload,
  PlayerSessionCredentials,
  PublicRoomState,
  RoomSessionData,
  TurnSecretPayload,
} from "@drawing-game/shared";
import { io, type Socket } from "socket.io-client";

import {
  type CreateDrawingGameServerOptions,
  createDrawingGameServer,
} from "../src/create-server.js";

export const DRAWING: DrawingDocument = {
  version: 2,
  aspectRatio: "4:3",
  backgroundColor: "#FFFFFF",
  strokes: [
    {
      tool: "pen",
      color: "#111111",
      width: 4,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
      ],
    },
  ],
};

export async function startServer(options: CreateDrawingGameServerOptions = {}) {
  const server = createDrawingGameServer({
    serveClient: false,
    reconnectGraceMs: 300,
    gameManagerOptions: { introDurationMs: 10 },
    ...options,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = server.httpServer.address() as AddressInfo;

  return {
    ...server,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => void server.io.close(() => resolve())),
  };
}

export type TestServer = Awaited<ReturnType<typeof startServer>>;

export interface TestClient {
  name: string;
  socket: Socket;
  clientInstanceId: string;
  states: PublicRoomState[];
  secrets: TurnSecretPayload[];
  cancellations: GameCancelledPayload[];
  session: PlayerSessionCredentials | null;
}

export async function connect(
  server: TestServer,
  name: string,
  headers: Record<string, string> = {},
): Promise<TestClient> {
  const socket = io(server.url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    extraHeaders: headers,
  });
  const client: TestClient = {
    name,
    socket,
    clientInstanceId: randomUUID(),
    states: [],
    secrets: [],
    cancellations: [],
    session: null,
  };
  socket.on("room:state", (room: PublicRoomState) => client.states.push(room));
  socket.on("turn:secret", (secret: TurnSecretPayload) => client.secrets.push(secret));
  socket.on("game:cancelled", (payload: GameCancelledPayload) =>
    client.cancellations.push(payload),
  );

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  return client;
}

export async function tryConnect(
  server: TestServer,
  headers: Record<string, string> = {},
): Promise<boolean> {
  const socket = io(server.url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    extraHeaders: headers,
  });

  return new Promise<boolean>((resolve) => {
    socket.once("connect", () => resolve(true));
    socket.once("connect_error", () => {
      socket.close();
      resolve(false);
    });
  });
}

export function request<T = unknown>(
  client: TestClient,
  event: string,
  ...args: unknown[]
): Promise<ActionResult<T>> {
  return client.socket.timeout(3000).emitWithAck(event, ...args) as Promise<ActionResult<T>>;
}

export function expectData<T>(result: ActionResult<T>): T {
  assert.equal(result.success, true, JSON.stringify(result));
  return (result as { success: true; data: T }).data;
}

export function expectError(result: ActionResult<unknown>, code: string) {
  assert.equal(result.success, false, "une erreur était attendue");
  assert.equal((result as { error: { code: string } }).error.code, code);
}

export async function until(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("condition non atteinte dans le délai imparti");
}

export function latest(client: TestClient): PublicRoomState {
  const room = client.states.at(-1);
  assert.ok(room, `${client.name} n'a reçu aucun état de salon`);
  return room;
}

export function phaseOf(client: TestClient): string | null {
  return client.states.at(-1)?.game?.phase ?? null;
}

export async function createRoomAs(client: TestClient, nickname = client.name) {
  const data = expectData(
    await request<RoomSessionData>(client, "room:create", {
      nickname,
      clientInstanceId: client.clientInstanceId,
    }),
  );
  client.session = data.session;
  return data;
}

export async function joinRoomAs(client: TestClient, roomCode: string, nickname = client.name) {
  const data = expectData(
    await request<RoomSessionData>(client, "room:join", {
      nickname,
      roomCode,
      clientInstanceId: client.clientInstanceId,
    }),
  );
  client.session = data.session;
  return data;
}

/** Salon avec `count` joueurs prêts ; le premier est l'hôte. */
export async function createReadyRoom(server: TestServer, names: string[]) {
  const clients: TestClient[] = [];
  for (const name of names) {
    clients.push(await connect(server, name));
  }

  const [host, ...others] = clients;
  assert.ok(host);
  const { room } = await createRoomAs(host);
  for (const client of others) {
    await joinRoomAs(client, room.code);
  }
  for (const client of clients) {
    expectData(await request(client, "player:set-ready", { isReady: true }));
  }

  return { clients, host, roomCode: room.code };
}

export function closeAll(clients: TestClient[]) {
  for (const client of clients) {
    client.socket.close();
  }
}
