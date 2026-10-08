import type { PlayerSessionCredentials } from "@drawing-game/shared";

export const STORED_SESSION_KEY = "drawing-scale-game-session";

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/;
const MAX_PLAYER_ID_LENGTH = 128;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_SERIALIZED_SESSION_LENGTH = 2_048;

export interface StoredPlayerSession {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): BrowserStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value: Record<string, unknown>, expectedKeys: readonly string[]) {
  const actualKeys = Reflect.ownKeys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isBoundedIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PLAYER_ID_LENGTH &&
    value.trim() === value &&
    !/\s/u.test(value)
  );
}

export function parseStoredSession(value: unknown): StoredPlayerSession | null {
  if (
    !isPlainRecord(value) ||
    !hasExactOwnKeys(value, ["roomCode", "playerId", "token"]) ||
    typeof value.roomCode !== "string" ||
    !ROOM_CODE_PATTERN.test(value.roomCode) ||
    !isBoundedIdentifier(value.playerId) ||
    typeof value.token !== "string" ||
    !SESSION_TOKEN_PATTERN.test(value.token)
  ) {
    return null;
  }

  return {
    roomCode: value.roomCode,
    playerId: value.playerId,
    token: value.token,
  };
}

export function readStoredSession(
  storage: BrowserStorage | null = getBrowserStorage(),
): StoredPlayerSession | null {
  if (storage === null) {
    return null;
  }

  try {
    const serialized = storage.getItem(STORED_SESSION_KEY);
    if (serialized === null) {
      return null;
    }

    if (serialized.length > MAX_SERIALIZED_SESSION_LENGTH) {
      storage.removeItem(STORED_SESSION_KEY);
      return null;
    }

    const session = parseStoredSession(JSON.parse(serialized) as unknown);
    if (session !== null) {
      return session;
    }

    storage.removeItem(STORED_SESSION_KEY);
  } catch {
    try {
      storage.removeItem(STORED_SESSION_KEY);
    } catch {
      // Le stockage peut être indisponible ou interdit par le navigateur.
    }
  }

  return null;
}

export function writeStoredSession(
  credentials: PlayerSessionCredentials,
  storage: BrowserStorage | null = getBrowserStorage(),
) {
  const session = parseStoredSession(credentials);
  if (storage === null || session === null) {
    return false;
  }

  try {
    storage.setItem(STORED_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredSession(storage: BrowserStorage | null = getBrowserStorage()) {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(STORED_SESSION_KEY);
  } catch {
    // Le nettoyage ne doit jamais faire planter l'application.
  }
}
