import type { GuessValue } from "@drawing-game/shared";

import type { BrowserStorage } from "./stored-session";

export const STORED_GUESS_DRAFT_KEY = "drawing-scale-game-guess-draft";

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_SERIALIZED_GUESS_DRAFT_LENGTH = 2_048;

export interface GuessDraftContext {
  roomCode: string;
  gameId: string;
  turnId: string;
  playerId: string;
}

export interface StoredGuessDraft extends GuessDraftContext {
  value: GuessValue;
  savedAt: number;
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

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/\s/u.test(value)
  );
}

function isGuessValue(value: unknown): value is GuessValue {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
}

export function parseStoredGuessDraft(value: unknown): StoredGuessDraft | null {
  if (
    !isPlainRecord(value) ||
    !hasExactOwnKeys(value, ["roomCode", "gameId", "turnId", "playerId", "value", "savedAt"]) ||
    typeof value.roomCode !== "string" ||
    !ROOM_CODE_PATTERN.test(value.roomCode) ||
    !isIdentifier(value.gameId) ||
    !isIdentifier(value.turnId) ||
    !isIdentifier(value.playerId) ||
    !isGuessValue(value.value) ||
    typeof value.savedAt !== "number" ||
    !Number.isSafeInteger(value.savedAt) ||
    value.savedAt < 0
  ) {
    return null;
  }

  return {
    roomCode: value.roomCode,
    gameId: value.gameId,
    turnId: value.turnId,
    playerId: value.playerId,
    value: value.value,
    savedAt: value.savedAt,
  };
}

export function matchesGuessDraftContext(draft: StoredGuessDraft, context: GuessDraftContext) {
  return (
    draft.roomCode === context.roomCode &&
    draft.gameId === context.gameId &&
    draft.turnId === context.turnId &&
    draft.playerId === context.playerId
  );
}

export function readStoredGuessDraft(
  storage: BrowserStorage | null = getBrowserStorage(),
): StoredGuessDraft | null {
  if (storage === null) {
    return null;
  }

  try {
    const serialized = storage.getItem(STORED_GUESS_DRAFT_KEY);
    if (serialized === null) {
      return null;
    }

    if (serialized.length > MAX_SERIALIZED_GUESS_DRAFT_LENGTH) {
      storage.removeItem(STORED_GUESS_DRAFT_KEY);
      return null;
    }

    const draft = parseStoredGuessDraft(JSON.parse(serialized) as unknown);
    if (draft !== null) {
      return draft;
    }

    storage.removeItem(STORED_GUESS_DRAFT_KEY);
  } catch {
    try {
      storage.removeItem(STORED_GUESS_DRAFT_KEY);
    } catch {
      // Le stockage peut être indisponible ou interdit par le navigateur.
    }
  }

  return null;
}

export function writeStoredGuessDraft(
  draft: StoredGuessDraft,
  storage: BrowserStorage | null = getBrowserStorage(),
) {
  const parsedDraft = parseStoredGuessDraft(draft);
  if (storage === null || parsedDraft === null) {
    return false;
  }

  try {
    storage.setItem(STORED_GUESS_DRAFT_KEY, JSON.stringify(parsedDraft));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredGuessDraft(storage: BrowserStorage | null = getBrowserStorage()) {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(STORED_GUESS_DRAFT_KEY);
  } catch {
    // Le nettoyage ne doit jamais faire planter l'application.
  }
}
