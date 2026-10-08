import type { IncomingMessage } from "node:http";

export interface SocketOriginPolicyOptions {
  allowedOrigins?: readonly string[];
  allowLoopbackPortMismatch?: boolean;
}

function parseHttpOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== "null"
      ? url
      : null;
  } catch {
    return null;
  }
}

function getFirstHeaderValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value?.split(",", 1)[0];
  const normalized = candidate?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}

function getRequestHost(request: IncomingMessage): URL | null {
  const authority =
    getFirstHeaderValue(request.headers["x-forwarded-host"]) ??
    getFirstHeaderValue(request.headers.host);

  if (authority === null) {
    return null;
  }

  try {
    return new URL(`http://${authority}`);
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

/**
 * Reject browser handshakes initiated by an unrelated website. Requests without
 * an Origin header remain accepted for non-browser clients and health tooling.
 */
export function isSocketOriginAllowed(
  request: IncomingMessage,
  options: SocketOriginPolicyOptions = {},
): boolean {
  const originHeader = getFirstHeaderValue(request.headers.origin);
  if (originHeader === null) {
    return true;
  }

  const origin = parseHttpOrigin(originHeader);
  if (origin === null) {
    return false;
  }

  const explicitlyAllowed = (options.allowedOrigins ?? []).some(
    (candidate) => parseHttpOrigin(candidate)?.origin === origin.origin,
  );
  if (explicitlyAllowed) {
    return true;
  }

  const requestHost = getRequestHost(request);
  if (requestHost === null) {
    return false;
  }

  if (origin.host.toLowerCase() === requestHost.host.toLowerCase()) {
    return true;
  }

  return (
    options.allowLoopbackPortMismatch === true &&
    isLoopbackHostname(origin.hostname) &&
    isLoopbackHostname(requestHost.hostname)
  );
}
