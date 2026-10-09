import { useEffect, useState } from "react";

import type { PublicPlayer } from "@drawing-game/shared";

import { Mascot } from "./Mascot";

interface PlayerConnectionStatusProps {
  player: PublicPlayer;
  showConnected?: boolean;
}

function getSecondsRemaining(deadline: number | null) {
  if (deadline === null) {
    return null;
  }

  return Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
}

export function PlayerConnectionStatus({
  player,
  showConnected = false,
}: PlayerConnectionStatusProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getSecondsRemaining(player.reconnectDeadline),
  );

  useEffect(() => {
    if (player.isConnected || player.reconnectDeadline === null) {
      setSecondsRemaining(null);
      return undefined;
    }

    const updateCountdown = () => {
      setSecondsRemaining(getSecondsRemaining(player.reconnectDeadline));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [player.isConnected, player.reconnectDeadline]);

  if (player.isConnected) {
    return showConnected ? (
      <span className="player-connection-status player-connection-status--connected">Connecté</span>
    ) : null;
  }

  return (
    <span className="player-connection-status player-connection-status--reconnecting">
      <Mascot
        character="poop"
        expression="confused"
        size="xs"
        decorative
        className="player-connection-mascot player-connection-mascot--reconnecting"
      />
      Reconnexion…
      {secondsRemaining !== null && secondsRemaining > 0 ? ` ${secondsRemaining} s` : ""}
    </span>
  );
}

interface DisconnectedPlayersNoticeProps {
  players?: readonly PublicPlayer[];
}

export function DisconnectedPlayersNotice({ players = [] }: DisconnectedPlayersNoticeProps) {
  const disconnectedPlayers = players.filter((player) => !player.isConnected);

  if (disconnectedPlayers.length === 0) {
    return null;
  }

  return (
    <section className="disconnected-players-notice" aria-label="Joueurs en cours de reconnexion">
      <p className="visually-hidden" role="status" aria-live="polite">
        {disconnectedPlayers.map((player) => player.nickname).join(", ")}
        {disconnectedPlayers.length === 1
          ? " est en cours de reconnexion."
          : " sont en cours de reconnexion."}
      </p>
      <p className="card-label">Reconnexion en cours</p>
      <ul>
        {disconnectedPlayers.map((player) => (
          <li key={player.id}>
            <strong>{player.nickname}</strong>
            <PlayerConnectionStatus player={player} />
          </li>
        ))}
      </ul>
    </section>
  );
}
