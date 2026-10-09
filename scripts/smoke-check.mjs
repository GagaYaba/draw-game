// Contrôle après déploiement : santé HTTP, version servie, connexion Socket.IO.
//
// Usage : node scripts/smoke-check.mjs <url> [commit attendu]
//   ex.  node scripts/smoke-check.mjs https://drawing-scale-game.onrender.com 1a2b3c4
//
// Ne crée aucun salon : le contrôle ne consomme pas les quotas par adresse. La première requête
// peut attendre la sortie de veille d'une instance gratuite (environ 25 s).
import { io } from "socket.io-client";

const url = (process.argv[2] ?? "").replace(/\/$/u, "");
const expectedCommit = process.argv[3];
if (!url) {
  console.error("Usage : node scripts/smoke-check.mjs <url> [commit attendu]");
  process.exit(2);
}

const results = [];
const record = (ok, label) => {
  results.push(ok);
  console.log(`${ok ? "ok " : "KO "} ${label}`);
};

const startedAt = performance.now();
const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(90_000) });
const health = response.ok ? await response.json() : null;
record(
  health?.status === "ok" && health?.service === "drawing-game-server",
  `/api/health répond ${response.status} en ${Math.round(performance.now() - startedAt)} ms`,
);

if (expectedCommit) {
  const served = health?.commit;
  record(
    typeof served === "string" && expectedCommit.startsWith(served),
    `commit servi ${served ?? "inconnu"}, attendu ${expectedCommit.slice(0, 7)}`,
  );
} else {
  console.log(`-- commit servi : ${health?.commit ?? "non communiqué"}`);
}

const index = await fetch(`${url}/`, { signal: AbortSignal.timeout(30_000) });
record(
  index.ok && (await index.text()).includes("<div id="),
  "la page d'accueil du client est servie",
);

const pongDelay = await new Promise((resolve) => {
  const socket = io(url, { transports: ["websocket"], reconnection: false, timeout: 15_000 });
  const timer = setTimeout(() => {
    socket.close();
    resolve(null);
  }, 20_000);
  socket.on("connect", () => socket.emit("client:ping", { sentAt: Date.now() }));
  socket.on("server:pong", (payload) => {
    clearTimeout(timer);
    socket.close();
    resolve(Date.now() - payload.sentAt);
  });
  socket.on("connect_error", () => {
    clearTimeout(timer);
    socket.close();
    resolve(null);
  });
});
record(
  pongDelay !== null,
  `Socket.IO : ping/pong ${pongDelay === null ? "impossible" : `en ${pongDelay} ms`}`,
);

// process.exitCode plutôt que process.exit : laisse les sockets se fermer proprement (Windows).
if (results.includes(false)) {
  console.error("Contrôle après déploiement : ÉCHEC.");
  process.exitCode = 1;
} else {
  console.log("Contrôle après déploiement : réussi.");
}
