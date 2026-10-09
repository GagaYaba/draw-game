import type {
  CreateRoomPayload,
  JoinRoomPayload,
  RoomErrorCode,
  SetPlayerReadyPayload,
} from "@drawing-game/shared";

import { isValidClientInstanceId } from "../sessions/client-instance-validation.js";

type PayloadValidationResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: RoomErrorCode;
        message: string;
      };
    };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasExactOwnKeys(
  payload: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  try {
    const keys = Reflect.ownKeys(payload);

    return (
      keys.length === expectedKeys.length &&
      expectedKeys.every((key) => Object.hasOwn(payload, key))
    );
  } catch {
    return false;
  }
}

function readOwnValue(payload: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(payload, key);
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function invalidClientInstance<T>(): PayloadValidationResult<T> {
  return {
    success: false,
    error: {
      code: "INVALID_SESSION",
      message: "L’instance cliente est invalide.",
    },
  };
}

export function validateCreateRoomPayload(
  payload: unknown,
): PayloadValidationResult<CreateRoomPayload> {
  if (!isPlainRecord(payload) || !hasExactOwnKeys(payload, ["nickname", "clientInstanceId"])) {
    return {
      success: false,
      error: {
        code: "INVALID_NICKNAME",
        message: "Le pseudonyme est obligatoire.",
      },
    };
  }

  const nickname = readOwnValue(payload, "nickname");
  const clientInstanceId = readOwnValue(payload, "clientInstanceId");

  if (typeof nickname !== "string") {
    return {
      success: false,
      error: {
        code: "INVALID_NICKNAME",
        message: "Le pseudonyme est obligatoire.",
      },
    };
  }

  if (!isValidClientInstanceId(clientInstanceId)) {
    return invalidClientInstance();
  }

  return { success: true, data: { nickname, clientInstanceId } };
}

export function validateJoinRoomPayload(
  payload: unknown,
): PayloadValidationResult<JoinRoomPayload> {
  if (
    !isPlainRecord(payload) ||
    !hasExactOwnKeys(payload, ["nickname", "roomCode", "clientInstanceId"])
  ) {
    return {
      success: false,
      error: {
        code: "INVALID_NICKNAME",
        message: "Le pseudonyme est obligatoire.",
      },
    };
  }

  const nickname = readOwnValue(payload, "nickname");
  const roomCode = readOwnValue(payload, "roomCode");
  const clientInstanceId = readOwnValue(payload, "clientInstanceId");

  if (typeof nickname !== "string") {
    return {
      success: false,
      error: {
        code: "INVALID_NICKNAME",
        message: "Le pseudonyme est obligatoire.",
      },
    };
  }

  if (typeof roomCode !== "string") {
    return {
      success: false,
      error: {
        code: "INVALID_ROOM_CODE",
        message: "Le code du salon est invalide.",
      },
    };
  }

  if (!isValidClientInstanceId(clientInstanceId)) {
    return invalidClientInstance();
  }

  return {
    success: true,
    data: { nickname, roomCode, clientInstanceId },
  };
}

export function validateSetPlayerReadyPayload(
  payload: unknown,
): PayloadValidationResult<SetPlayerReadyPayload> {
  if (!isPlainRecord(payload) || typeof payload.isReady !== "boolean") {
    return {
      success: false,
      error: {
        code: "INVALID_READY_STATUS",
        message: "Le statut prêt doit être un booléen.",
      },
    };
  }

  return { success: true, data: { isReady: payload.isReady } };
}

export function validateStartGamePayload(payload: unknown): PayloadValidationResult<null> {
  if (payload !== undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_GAME_START_REQUEST",
        message: "La demande de lancement ne doit contenir aucune donnée.",
      },
    };
  }

  return { success: true, data: null };
}
