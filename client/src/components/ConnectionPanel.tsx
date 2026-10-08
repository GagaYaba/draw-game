import { useEffect, useState } from "react";

import { SOCKET_EVENTS, type ServerPongPayload } from "@drawing-game/shared";

import { socket } from "../socket/socket";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

const statusLabels: Record<ConnectionStatus, string> = {
  connecting: "Connexion en cours…",
  connected: "Connecté",
  disconnected: "Déconnecté",
};

export function ConnectionPanel() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastPing, setLastPing] = useState("Aucun test de connexion effectué.");

  useEffect(() => {
    const handleConnect = () => {
      setConnectionStatus("connected");
    };
    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
    };
    const handleConnectError = () => {
      setConnectionStatus("disconnected");
    };
    const handlePong = (payload: ServerPongPayload) => {
      const roundTrip = Math.max(0, Date.now() - payload.sentAt);
      setLastPing(`Serveur connecté — réponse reçue en ${roundTrip} ms`);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on(SOCKET_EVENTS.SERVER_PONG, handlePong);

    if (socket.connected) {
      handleConnect();
    } else {
      setConnectionStatus("connecting");
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off(SOCKET_EVENTS.SERVER_PONG, handlePong);
    };
  }, []);

  const testConnection = () => {
    const sentAt = Date.now();
    setLastPing("Ping envoyé, en attente de la réponse…");
    socket.emit(SOCKET_EVENTS.CLIENT_PING, { sentAt });
  };

  return (
    <section className="panel" aria-labelledby="connection-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Temps réel</p>
          <h2 id="connection-title">Connexion Socket.IO</h2>
        </div>
        <span className={`status status--${connectionStatus}`} role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          {statusLabels[connectionStatus]}
        </span>
      </div>

      <p className="result" aria-live="polite">
        {lastPing}
      </p>

      <button
        className="button button--primary"
        type="button"
        onClick={testConnection}
        disabled={connectionStatus !== "connected"}
      >
        Tester la connexion
      </button>
    </section>
  );
}
