import { useState } from "react";

import type { HealthResponse } from "@drawing-game/shared";

type HealthState = "idle" | "loading" | "healthy" | "error";

function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "ok" &&
    "service" in value &&
    value.service === "drawing-game-server"
  );
}

export function HealthCheck() {
  const [healthState, setHealthState] = useState<HealthState>("idle");

  const checkHealth = async () => {
    setHealthState("loading");

    try {
      const response = await fetch("/api/health");
      const data: unknown = await response.json();

      setHealthState(response.ok && isHealthResponse(data) ? "healthy" : "error");
    } catch {
      setHealthState("error");
    }
  };

  const healthMessage: Record<HealthState, string> = {
    idle: "Vérifiez que l’API Express répond correctement.",
    loading: "Vérification de l’API…",
    healthy: "API disponible — statut ok",
    error: "L’API ne répond pas comme prévu.",
  };

  return (
    <section className="panel" aria-labelledby="health-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">HTTP</p>
          <h2 id="health-title">État du serveur</h2>
        </div>
        <span className={`health-indicator health-indicator--${healthState}`} aria-hidden="true" />
      </div>

      <p className="result" role="status" aria-live="polite">
        {healthMessage[healthState]}
      </p>

      <button
        className="button button--secondary"
        type="button"
        onClick={() => void checkHealth()}
        disabled={healthState === "loading"}
      >
        Vérifier /api/health
      </button>
    </section>
  );
}
