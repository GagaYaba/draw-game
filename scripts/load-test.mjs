// Test de charge Socket.IO : N salons de 6 joueurs jouent le début d'une manche (création,
// jonction, état prêt, lancement, dessin, estimations) contre un serveur déjà démarré.
//
// Usage : node scripts/load-test.mjs [url] [salons]
//   ex.  MAX_ROOMS_PER_IP_PER_DAY=1000 PORT=3499 npm start
//        node scripts/load-test.mjs http://localhost:3499 20
//
// Chaque salon utilise une adresse X-Forwarded-For distincte : les quotas par adresse (30
// connexions) bloqueraient sinon 120 sockets issues de la même machine. Ce n'est pas un test de
// ces quotas, couverts par server/test/quotas.test.ts.
import { randomUUID } from "node:crypto";

import { io } from "socket.io-client";

const url = process.argv[2] ?? "http://localhost:3499";
const roomCount = Number(process.argv[3] ?? 20);
const PLAYERS_PER_ROOM = 6;

// Seuils du budget (voir docs/performance.md).
const BUDGET = { p95AckMs: 500, p95BroadcastMs: 500, failures: 0 };

const ackLatencies = [];
const broadcastLatencies = [];
let failures = 0;

const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
};

// Dessin réaliste : 15 traits de 100 points, soit une charge utile de plusieurs dizaines de Ko.
const drawing = {
  version: 2,
  aspectRatio: "4:3",
  backgroundColor: "#FFFFFF",
  strokes: Array.from({ length: 15 }, (_, strokeIndex) => ({
    tool: "pen",
    color: "#111111",
    width: 4,
    points: Array.from({ length: 100 }, (_, index) => ({
      x: Math.round((0.1 + (index / 100) * 0.8) * 10_000) / 10_000,
      y: Math.round((0.1 + ((strokeIndex * 5 + index) % 80) / 100) * 10_000) / 10_000,
    })),
  })),
};

function connect(name, ip) {
  const socket = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    extraHeaders: { "X-Forwarded-For": ip },
  });
  const player = { name, socket, clientInstanceId: randomUUID(), state: null, waiters: [] };
  socket.on("room:state", (room) => {
    player.state = room;
    player.waiters = player.waiters.filter((waiter) => !waiter(room));
  });
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(player));
    socket.once("connect_error", reject);
  });
}

async function ack(player, event, payload) {
  const start = performance.now();
  const result = await player.socket
    .timeout(10_000)
    .emitWithAck(event, ...(payload === undefined ? [] : [payload]));
  ackLatencies.push(performance.now() - start);
  if (!result.success) throw new Error(`${event} : ${result.error?.code}`);
  return result.data;
}

function waitFor(player, predicate, timeoutMs = 15_000) {
  if (player.state && predicate(player.state)) return Promise.resolve(player.state);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("délai dépassé")), timeoutMs);
    player.waiters.push((room) => {
      if (!predicate(room)) return false;
      clearTimeout(timer);
      resolve(room);
      return true;
    });
  });
}

async function playRoom(index) {
  const ip = `10.${Math.floor(index / 250)}.${index % 250}.1`;
  const players = await Promise.all(
    Array.from({ length: PLAYERS_PER_ROOM }, (_, n) => connect(`J${index}-${n}`, ip)),
  );
  try {
    const [host, ...others] = players;
    const created = await ack(host, "room:create", {
      nickname: host.name,
      clientInstanceId: host.clientInstanceId,
    });
    for (const player of others) {
      await ack(player, "room:join", {
        nickname: player.name,
        roomCode: created.room.code,
        clientInstanceId: player.clientInstanceId,
      });
    }
    for (const player of players) await ack(player, "player:set-ready", { isReady: true });

    // Diffusion : délai entre l'accusé du lancement et la réception de l'état par le dernier joueur.
    const startedAt = performance.now();
    await ack(host, "game:start", undefined);
    await Promise.all(
      players.map(async (player) => {
        await waitFor(player, (room) => room.game?.phase === "ROUND_INTRO");
        broadcastLatencies.push(performance.now() - startedAt);
      }),
    );

    await Promise.all(players.map((p) => waitFor(p, (room) => room.game?.phase === "DRAWING")));
    await Promise.all(players.map((p) => ack(p, "drawing:submit", { drawing })));

    const voting = await waitFor(host, (room) => room.game?.phase === "VOTING");
    const drawerId = voting.game.currentDrawer?.id;
    for (const player of players) {
      if (player.state.players.find((p) => p.nickname === player.name)?.id === drawerId) continue;
      await ack(player, "guess:submit", { turnId: voting.game.turnId, value: 5 });
    }
    await waitFor(host, (room) => room.game?.phase === "REVEAL");
  } finally {
    for (const player of players) player.socket.close();
  }
}

console.log(`Charge : ${roomCount} salons x ${PLAYERS_PER_ROOM} joueurs sur ${url}`);
const startedAt = performance.now();
const outcomes = await Promise.allSettled(
  Array.from({ length: roomCount }, (_, index) => playRoom(index)),
);
const durationS = (performance.now() - startedAt) / 1000;
for (const outcome of outcomes) {
  if (outcome.status === "rejected") {
    failures += 1;
    console.error(`  échec : ${outcome.reason?.message ?? outcome.reason}`);
  }
}

const report = {
  salons: roomCount,
  sockets: roomCount * PLAYERS_PER_ROOM,
  dureeS: Number(durationS.toFixed(1)),
  echecs: failures,
  accuses: ackLatencies.length,
  ackP50Ms: Math.round(percentile(ackLatencies, 0.5)),
  ackP95Ms: Math.round(percentile(ackLatencies, 0.95)),
  diffusionP95Ms: Math.round(percentile(broadcastLatencies, 0.95)),
};
console.log(JSON.stringify(report, null, 2));

const exceeded = [];
if (failures > BUDGET.failures) exceeded.push("échecs");
if (report.ackP95Ms > BUDGET.p95AckMs) exceeded.push("latence des accusés");
if (report.diffusionP95Ms > BUDGET.p95BroadcastMs) exceeded.push("latence de diffusion");
if (exceeded.length > 0) {
  console.error(`Budget dépassé : ${exceeded.join(", ")}`);
  process.exit(1);
}
console.log("Budget respecté.");
