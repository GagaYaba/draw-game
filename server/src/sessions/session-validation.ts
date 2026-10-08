import type { RestoreSessionPayload } from "@drawing-game/shared";

import { normalizeRoomCode } from "../rooms/room-validation.js";
import { isValidClientInstanceId } from "./client-instance-validation.js";
import { isValidSessionToken } from "./session-token.js";

export const MAX_SESSION_PLAYER_ID_LENGTH = 128;

export type RestoreSessionValidationResult =
  | {
      success: true;
      data: RestoreSessionPayload;
    }
  | {
      success: false;
      error: {
        code: "INVALID_SESSION";
        message: string;
      };
    };

const INVALID_SESSION_RESULT = {
  success: false,
  error: {
    code: "INVALID_SESSION",
    message: "La session enregistrée n’est pas valide.",
  },
} as const satisfies RestoreSessionValidationResult;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readOwnString(payload: Record<string, unknown>, key: string): string | null {
  const descriptor = Object.getOwnPropertyDescriptor(payload, key);

  return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string"
    ? descriptor.value
    : null;
}

export function validateRestoreSessionPayload(payload: unknown): RestoreSessionValidationResult {
  try {
    if (!isPlainRecord(payload)) {
      return INVALID_SESSION_RESULT;
    }

    const keys = Reflect.ownKeys(payload);
    const expectedKeys = ["roomCode", "playerId", "token", "clientInstanceId"] as const;

    if (
      keys.length !== expectedKeys.length ||
      !expectedKeys.every((key) => Object.hasOwn(payload, key))
    ) {
      return INVALID_SESSION_RESULT;
    }

    const receivedRoomCode = readOwnString(payload, "roomCode");
    const playerId = readOwnString(payload, "playerId");
    const token = readOwnString(payload, "token");
    const clientInstanceId = readOwnString(payload, "clientInstanceId");

    if (
      receivedRoomCode === null ||
      playerId === null ||
      playerId.length === 0 ||
      playerId.length > MAX_SESSION_PLAYER_ID_LENGTH ||
      playerId.trim() !== playerId ||
      token === null ||
      !isValidSessionToken(token) ||
      !isValidClientInstanceId(clientInstanceId)
    ) {
      return INVALID_SESSION_RESULT;
    }

    return {
      success: true,
      data: {
        roomCode: normalizeRoomCode(receivedRoomCode),
        playerId,
        token,
        clientInstanceId,
      },
    };
  } catch {
    return INVALID_SESSION_RESULT;
  }
}
