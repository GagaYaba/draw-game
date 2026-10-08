import { useEffect, useRef, useState } from "react";

import type { PublicRoomState } from "@drawing-game/shared";

import type { PendingRoomAction } from "../hooks/useRoomSession";
import { Mascot } from "./Mascot";
import { PlayerConnectionStatus } from "./PlayerConnectionStatus";

interface LobbyScreenProps {
  room: PublicRoomState;
  currentPlayerId: string | null;
  pendingAction: PendingRoomAction;
  errorMessage: string | null;
  noticeMessage: string | null;
  isConnectionBlocked?: boolean;
  onSetReady: (isReady: boolean) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

function getInvitationLink(roomCode: string) {
  const invitationUrl = new URL(window.location.origin);
  invitationUrl.searchParams.set("room", roomCode);
  return invitationUrl.toString();
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText !== undefined) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard copy failed");
    }
  } finally {
    textArea.remove();
  }
}

function getConnectedPlayerMascot(player: PublicRoomState["players"][number]) {
  if (player.isHost) {
    return {
      character: "pig",
      expression: "formal",
      state: "host",
    } as const;
  }

  if (player.isReady) {
    return {
      character: "pig",
      expression: "jump",
      state: "ready",
    } as const;
  }

  return {
    character: "poop",
    expression: "hide",
    state: "not-ready",
  } as const;
}

export function LobbyScreen({
  room,
  currentPlayerId,
  pendingAction,
  errorMessage,
  noticeMessage,
  isConnectionBlocked = false,
  onSetReady,
  onStartGame,
  onLeaveRoom,
}: LobbyScreenProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const currentPlayer = room.players.find((player) => player.id === currentPlayerId);
  const isHost = currentPlayer?.isHost === true;
  const isPending = pendingAction !== null || isConnectionBlocked;
  const connectedPlayerCount = room.players.filter((player) => player.isConnected).length;
  const reconnectingPlayerCount = room.players.length - connectedPlayerCount;

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
      }
    },
    [],
  );

  const showCopyFeedback = (message: string) => {
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
    }

    setCopyFeedback(message);
    feedbackTimer.current = window.setTimeout(() => {
      setCopyFeedback(null);
      feedbackTimer.current = null;
    }, 2500);
  };

  const handleCopy = async (kind: "code" | "link") => {
    const value = kind === "code" ? room.code : getInvitationLink(room.code);

    try {
      await copyToClipboard(value);
      showCopyFeedback(kind === "code" ? "Code copié" : "Lien copié");
    } catch {
      showCopyFeedback(
        kind === "code"
          ? `Copie impossible — code : ${value}`
          : `Copie impossible — lien : ${value}`,
      );
    }
  };

  const readinessMessage =
    reconnectingPlayerCount > 0
      ? "Attendez la reconnexion de tous les joueurs."
      : room.canStart
        ? "Tout le monde est prêt. L’hôte peut lancer la partie."
        : room.playerCount < room.minimumPlayersToStart
          ? `Il faut au moins ${room.minimumPlayersToStart} joueurs et tout le monde doit être prêt.`
          : "Le nombre de joueurs est suffisant. Tout le monde doit encore être prêt.";

  const readinessMascot =
    reconnectingPlayerCount > 0
      ? ({
          character: "poop",
          expression: "confused",
          state: "reconnecting",
        } as const)
      : room.canStart
        ? ({
            character: "pig",
            expression: "happy",
            state: "ready",
          } as const)
        : room.playerCount < room.minimumPlayersToStart
          ? ({
              character: "poop",
              expression: "surprised",
              state: "insufficient",
            } as const)
          : ({
              character: "poop",
              expression: "hide",
              state: "waiting",
            } as const);

  return (
    <section className="game-card lobby" aria-labelledby="lobby-title" aria-busy={isPending}>
      <div className="lobby-heading">
        <div>
          <p className="eyebrow">Salon en direct</p>
          <h2 id="lobby-title">Votre lobby</h2>
        </div>
        <p
          className="player-count"
          aria-label={`${room.playerCount} joueurs sur ${room.maxPlayers}`}
        >
          <strong>
            {room.playerCount} / {room.maxPlayers}
          </strong>
          <span>joueurs</span>
        </p>
      </div>

      <div className="room-code-block">
        <div>
          <span className="room-code-label">Code du salon</span>
          <strong
            className="room-code"
            aria-label={`Code du salon ${room.code.split("").join(" ")}`}
          >
            {room.code}
          </strong>
        </div>
        <div className="copy-actions">
          <button
            className="button button--compact button--secondary"
            type="button"
            onClick={() => void handleCopy("code")}
          >
            Copier le code
          </button>
          <button
            className="button button--compact button--ghost"
            type="button"
            onClick={() => void handleCopy("link")}
          >
            Copier le lien d’invitation
          </button>
        </div>
      </div>

      <p className="copy-feedback" role="status" aria-live="polite">
        {copyFeedback ?? "Partagez le code ou le lien pour inviter votre groupe."}
      </p>

      {noticeMessage !== null && (
        <p className="form-message form-message--info" role="status" aria-live="polite">
          {noticeMessage}
        </p>
      )}

      {errorMessage !== null && (
        <p className="form-message form-message--error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="lobby-content">
        <section aria-labelledby="players-title">
          <div className="list-heading">
            <h3 id="players-title">Joueurs</h3>
            <span>
              {connectedPlayerCount} connecté
              {connectedPlayerCount === 1 ? "" : "s"}
              {reconnectingPlayerCount > 0 ? ` · ${reconnectingPlayerCount} en reconnexion` : ""}
            </span>
          </div>
          <ul className="player-list">
            {room.players.map((player) => (
              <li
                className={
                  player.isConnected ? "player-row" : "player-row player-row--disconnected"
                }
                key={player.id}
              >
                <span className="player-avatar" aria-hidden="true">
                  {player.nickname.charAt(0).toLocaleUpperCase("fr")}
                </span>
                <span className="player-identity">
                  <strong>{player.nickname}</strong>
                  <span className="player-badges">
                    {player.isHost && <span className="badge badge--host">Hôte</span>}
                    {player.id === currentPlayerId && <span className="badge">Vous</span>}
                  </span>
                </span>
                {player.isConnected ? (
                  <span className={`ready-status ${player.isReady ? "ready-status--yes" : ""}`}>
                    <Mascot
                      character={getConnectedPlayerMascot(player).character}
                      expression={getConnectedPlayerMascot(player).expression}
                      size="xs"
                      decorative
                      className={`lobby-player-mascot lobby-player-mascot--${getConnectedPlayerMascot(player).state}`}
                    />
                    <span aria-hidden="true">{player.isReady ? "✓" : "○"}</span>
                    {player.isReady ? "Prêt" : "Pas prêt"}
                  </span>
                ) : (
                  <PlayerConnectionStatus player={player} />
                )}
              </li>
            ))}
          </ul>
        </section>

        <aside
          className={`readiness-card ${room.canStart ? "readiness-card--ready" : ""}`}
          aria-labelledby="readiness-title"
        >
          <span className="readiness-card__visual" aria-hidden="true">
            <Mascot
              character={readinessMascot.character}
              expression={readinessMascot.expression}
              size="sm"
              decorative
              className={`readiness-mascot readiness-mascot--${readinessMascot.state}`}
            />
            <span className="readiness-icon" aria-hidden="true">
              {room.canStart ? "✓" : "…"}
            </span>
          </span>
          <div>
            <h3 id="readiness-title">Préparation de la partie</h3>
            <p id="readiness-description">{readinessMessage}</p>
          </div>
        </aside>
      </div>

      <div className="lobby-actions">
        <div className="lobby-primary-actions">
          <button
            className={`button ${currentPlayer?.isReady ? "button--secondary" : "button--primary"}`}
            type="button"
            onClick={() => onSetReady(!(currentPlayer?.isReady ?? false))}
            disabled={isPending || currentPlayer === undefined}
          >
            {pendingAction === "ready"
              ? "Mise à jour…"
              : currentPlayer?.isReady
                ? "Je ne suis plus prêt"
                : "Je suis prêt"}
          </button>

          {isHost ? (
            <button
              className="button button--primary"
              type="button"
              onClick={onStartGame}
              disabled={isPending || !room.canStart}
              aria-describedby="readiness-description"
            >
              {pendingAction === "start" ? "Lancement…" : "Lancer la partie"}
            </button>
          ) : (
            <p className="host-start-message">
              L’hôte lancera la partie lorsque tout le monde sera prêt.
            </p>
          )}
        </div>
        <button
          className="button button--danger-ghost"
          type="button"
          onClick={onLeaveRoom}
          disabled={isPending}
        >
          {pendingAction === "leave" ? "Départ…" : "Quitter la partie"}
        </button>
      </div>

      {pendingAction !== null && (
        <p className="visually-hidden" role="status" aria-live="polite">
          {pendingAction === "ready"
            ? "Mise à jour de votre statut en cours."
            : pendingAction === "start"
              ? "Lancement de la partie en cours."
              : pendingAction === "leave"
                ? "Départ du salon en cours."
                : "Action en cours."}
        </p>
      )}
    </section>
  );
}
