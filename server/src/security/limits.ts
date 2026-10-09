const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Requêtes HTTP sur `/api`, par adresse IP. */
export const API_REQUESTS_PER_MINUTE = 60;

/** Événements Socket.IO par connexion : rafale de 5, puis 5 par seconde au maximum. */
export const SOCKET_EVENT_BURST = 5;
export const SOCKET_EVENT_REFILL_INTERVAL_MS = 200;

/** Connexions simultanées par adresse IP (dimensionné pour une salle de classe). */
export const CONNECTIONS_PER_IP = 30;

/** Salons créés par adresse IP sur 24 heures. */
export const ROOMS_CREATED_PER_IP_PER_DAY = 5;
export const ROOM_CREATION_WINDOW_MS = DAY_MS;

/** Échecs de jonction ou de restauration : par connexion, puis par adresse IP. */
export const FAILED_JOINS_PER_SOCKET = 5;
export const FAILED_JOINS_PER_IP = 20;
export const FAILED_JOIN_WINDOW_MS = 15 * MINUTE_MS;

/** Un salon sans aucune action pendant 24 heures est fermé. */
export const IDLE_ROOM_TTL_MS = DAY_MS;
export const IDLE_ROOM_SWEEP_INTERVAL_MS = 10 * MINUTE_MS;

/** Codes d'erreur qui comptent comme tentative d'accès échouée. */
export const ACCESS_FAILURE_CODES: ReadonlySet<string> = new Set([
  "INVALID_ROOM_CODE",
  "ROOM_NOT_FOUND",
  "PLAYER_NOT_FOUND",
  "INVALID_SESSION",
  "SESSION_EXPIRED",
]);
