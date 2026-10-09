import type { GuessValue, SubmitGuessPayload } from "@drawing-game/shared";

type GuessPayloadValidationResult =
  | {
      success: true;
      data: {
        turnId: string;
        value: GuessValue;
      };
    }
  | {
      success: false;
      error: {
        code: "INVALID_GUESS";
        message: string;
      };
    };

const INVALID_GUESS_MESSAGE =
  "La demande doit contenir un identifiant de tour valide et une estimation entière comprise entre 1 et 10.";

function invalidGuess(): GuessPayloadValidationResult {
  return {
    success: false,
    error: {
      code: "INVALID_GUESS",
      message: INVALID_GUESS_MESSAGE,
    },
  };
}

export function validateSubmitGuessPayload(payload: unknown): GuessPayloadValidationResult {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return invalidGuess();
  }

  try {
    const prototype = Object.getPrototypeOf(payload);
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidGuess();
    }

    const keys = Reflect.ownKeys(payload);
    if (keys.length !== 2 || !keys.includes("turnId") || !keys.includes("value")) {
      return invalidGuess();
    }

    const turnIdDescriptor = Object.getOwnPropertyDescriptor(payload, "turnId");
    const descriptor = Object.getOwnPropertyDescriptor(payload, "value");
    if (
      turnIdDescriptor === undefined ||
      !("value" in turnIdDescriptor) ||
      typeof turnIdDescriptor.value !== "string" ||
      turnIdDescriptor.value.length === 0 ||
      turnIdDescriptor.value.trim() !== turnIdDescriptor.value ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "number" ||
      !Number.isFinite(descriptor.value) ||
      !Number.isInteger(descriptor.value) ||
      descriptor.value < 1 ||
      descriptor.value > 10
    ) {
      return invalidGuess();
    }

    const validatedPayload: SubmitGuessPayload = {
      turnId: turnIdDescriptor.value,
      value: descriptor.value,
    };

    return {
      success: true,
      data: {
        turnId: validatedPayload.turnId,
        value: validatedPayload.value as GuessValue,
      },
    };
  } catch {
    return invalidGuess();
  }
}
