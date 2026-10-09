import { RoomManagerError } from "./room-types.js";

export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 20;

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/u;
const NICKNAME_PATTERN = /^[\p{L}\p{M}\p{N} _-]+$/u;
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

export function normalizeNickname(value: unknown): string {
  if (typeof value !== "string" || CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new RoomManagerError(
      "INVALID_NICKNAME",
      "Le pseudonyme contient des caractères non autorisés.",
    );
  }

  const nickname = value.normalize("NFC").trim().replace(/ +/gu, " ");
  const length = Array.from(nickname).length;

  if (
    length < MIN_NICKNAME_LENGTH ||
    length > MAX_NICKNAME_LENGTH ||
    !NICKNAME_PATTERN.test(nickname)
  ) {
    throw new RoomManagerError(
      "INVALID_NICKNAME",
      `Le pseudonyme doit contenir entre ${MIN_NICKNAME_LENGTH} et ${MAX_NICKNAME_LENGTH} caractères (lettres, chiffres, espaces, tirets ou underscores).`,
    );
  }

  return nickname;
}

export function getNicknameComparisonKey(nickname: string): string {
  return nickname.normalize("NFC").toLocaleUpperCase("fr-FR");
}

export function normalizeRoomCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new RoomManagerError(
      "INVALID_ROOM_CODE",
      "Le code du salon doit être une chaîne de caractères.",
    );
  }

  const roomCode = value.trim().toUpperCase();

  if (!ROOM_CODE_PATTERN.test(roomCode)) {
    throw new RoomManagerError(
      "INVALID_ROOM_CODE",
      `Le code du salon doit contenir ${ROOM_CODE_LENGTH} caractères valides.`,
    );
  }

  return roomCode;
}

export function validateReadyStatus(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new RoomManagerError("INVALID_READY_STATUS", "Le statut prêt doit être un booléen.");
  }

  return value;
}
