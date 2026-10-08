import type { ClientConnectionStatus } from "../hooks/useRoomSession";
import { Mascot } from "./Mascot";

interface ConnectionRecoveryOverlayProps {
  status: ClientConnectionStatus;
  announcement: string | null;
  hasStoredSession: boolean;
  isRetryingSessionRestore: boolean;
  onRetry: () => void;
}

export function ConnectionRecoveryOverlay({
  status,
  announcement,
  hasStoredSession,
  isRetryingSessionRestore,
  onRetry,
}: ConnectionRecoveryOverlayProps) {
  const isDisconnected = status === "disconnected";
  const isRestoring = status === "restoring";
  const restoreFailed = status === "restore-failed";
  const isVisible = hasStoredSession && (isDisconnected || isRestoring || restoreFailed);
  const showRetryButton = restoreFailed || isRetryingSessionRestore;
  const recoveryMascot = restoreFailed
    ? ({
        character: "poop",
        expression: "sad",
        state: "failed",
      } as const)
    : isDisconnected
      ? ({
          character: "poop",
          expression: "confused",
          state: "disconnected",
        } as const)
      : ({
          character: "pig",
          expression: "fly",
          state: "restoring",
        } as const);
  const handleRetry = () => {
    if (!isRetryingSessionRestore) {
      onRetry();
    }
  };

  return (
    <>
      <p className="visually-hidden" role="status" aria-live="assertive" aria-atomic="true">
        {isVisible ? "" : (announcement ?? "")}
      </p>

      {isVisible && (
        <div className="connection-recovery-overlay">
          <section
            className="connection-recovery-card"
            role={restoreFailed ? "alert" : "status"}
            aria-live="assertive"
            aria-atomic="true"
            aria-labelledby="connection-recovery-title"
          >
            <div
              className={`connection-recovery__mascot-tile connection-recovery__mascot-tile--${recoveryMascot.state}`}
              aria-hidden="true"
            >
              <Mascot
                character={recoveryMascot.character}
                expression={recoveryMascot.expression}
                size="sm"
                decorative
                className={`connection-recovery-mascot connection-recovery-mascot--${recoveryMascot.state}`}
              />
            </div>
            <div>
              <p className="card-label">Connexion au salon</p>
              <h2 id="connection-recovery-title">
                {restoreFailed
                  ? "Restauration interrompue"
                  : isDisconnected
                    ? "Connexion interrompue"
                    : "Restauration de votre session…"}
              </h2>
              <p>
                {restoreFailed
                  ? (announcement ?? "Impossible de restaurer la session pour le moment.")
                  : isDisconnected
                    ? "Tentative de reconnexion…"
                    : "Votre place et votre progression sont en cours de récupération."}
              </p>
              <p className="connection-recovery-hint">
                Votre place est conservée pendant le délai de grâce accordé par le serveur.
              </p>
              {showRetryButton && (
                <button
                  className="button button--primary connection-recovery-retry"
                  type="button"
                  disabled={isRetryingSessionRestore}
                  aria-busy={isRetryingSessionRestore}
                  onClick={handleRetry}
                >
                  {isRetryingSessionRestore
                    ? "Restauration en cours…"
                    : "Réessayer la restauration"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
