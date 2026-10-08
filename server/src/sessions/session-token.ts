import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_TOKEN_BYTE_LENGTH = 32;
export const SESSION_TOKEN_ENCODED_LENGTH = 43;
export const MAX_SESSION_TOKEN_LENGTH = 256;
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export type SessionTokenGenerator = () => string;

export function createSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTE_LENGTH).toString("base64url");
}

export function isValidSessionToken(token: unknown): token is string {
  return (
    typeof token === "string" &&
    token.length === SESSION_TOKEN_ENCODED_LENGTH &&
    SESSION_TOKEN_PATTERN.test(token)
  );
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function verifySessionToken(token: string, expectedHash: string): boolean {
  try {
    const receivedHash = Buffer.from(hashSessionToken(token), "base64url");
    const storedHash = Buffer.from(expectedHash, "base64url");

    return receivedHash.length === storedHash.length && timingSafeEqual(receivedHash, storedHash);
  } catch {
    return false;
  }
}
