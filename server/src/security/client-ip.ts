/**
 * Adresse du client. Render ajoute l'adresse réelle en dernière position de
 * `X-Forwarded-For` : seule cette position est retenue, les valeurs
 * envoyées par le client avant elle sont ignorées.
 */
export function getClientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
): string {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor;
  const hops = (header ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);

  return hops.at(-1) ?? remoteAddress ?? "unknown";
}
