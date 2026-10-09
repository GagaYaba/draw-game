import type { BrowserStorage } from "./stored-session";

export const CLIENT_INSTANCE_STORAGE_KEY = "drawing-scale-game-client-instance";

const CLIENT_INSTANCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ClientInstanceIdFactory = () => string;

function getBrowserSessionStorage(): BrowserStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function createRandomClientInstanceId() {
  return globalThis.crypto.randomUUID();
}

export function isClientInstanceId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_INSTANCE_ID_PATTERN.test(value);
}

export function readClientInstanceId(
  storage: BrowserStorage | null = getBrowserSessionStorage(),
): string | null {
  if (storage === null) {
    return null;
  }

  try {
    const clientInstanceId = storage.getItem(CLIENT_INSTANCE_STORAGE_KEY);
    if (clientInstanceId === null) {
      return null;
    }

    if (isClientInstanceId(clientInstanceId)) {
      return clientInstanceId;
    }

    storage.removeItem(CLIENT_INSTANCE_STORAGE_KEY);
  } catch {
    try {
      storage.removeItem(CLIENT_INSTANCE_STORAGE_KEY);
    } catch {
      // Le stockage de session peut être indisponible ou interdit.
    }
  }

  return null;
}

export function getOrCreateClientInstanceId(
  storage: BrowserStorage | null = getBrowserSessionStorage(),
  createId: ClientInstanceIdFactory = createRandomClientInstanceId,
) {
  const storedClientInstanceId = readClientInstanceId(storage);
  if (storedClientInstanceId !== null) {
    return storedClientInstanceId;
  }

  const clientInstanceId = createId();
  if (!isClientInstanceId(clientInstanceId)) {
    throw new Error("The client instance id factory returned an invalid UUID.");
  }

  if (storage !== null) {
    try {
      storage.setItem(CLIENT_INSTANCE_STORAGE_KEY, clientInstanceId);
    } catch {
      // L'identifiant reste utilisable en mémoire pour la page courante.
    }
  }

  return clientInstanceId;
}
