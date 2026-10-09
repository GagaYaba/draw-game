export type SecurityEventType =
  | "origin_refused"
  | "connection_limit"
  | "http_rate_limited"
  | "event_rate_limited"
  | "room_creation_limited"
  | "access_failed"
  | "access_blocked";

export type SecurityEventDetails = Record<string, string | number>;
export type SecurityEventReporter = (
  type: SecurityEventType,
  details?: SecurityEventDetails,
) => void;

/**
 * Masque la fin d'une adresse IP avant de la journaliser : l'adresse complète est une donnée
 * personnelle et le journal sert à repérer un comportement, pas à identifier un joueur.
 */
export function maskIp(ip: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/u.test(ip)) {
    return `${ip.split(".").slice(0, 3).join(".")}.x`;
  }

  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 3).join(":")}::x`;
  }

  return "inconnue";
}

/** Écrit une ligne JSON par événement de sécurité, lisible dans les journaux de Render. */
export function createConsoleSecurityReporter(
  write: (line: string) => void = (line) => console.warn(line),
  clock: () => number = Date.now,
): SecurityEventReporter {
  return (type, details = {}) => {
    write(
      JSON.stringify({
        level: "security",
        event: type,
        at: new Date(clock()).toISOString(),
        ...details,
      }),
    );
  };
}
