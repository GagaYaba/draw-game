import { useEffect, useState } from "react";

import type { PublicGamePrompt, PublicGameState, PublicPlayer } from "@drawing-game/shared";

import type { PendingRoomAction } from "../hooks/useRoomSession";
import { GameLeaveAction } from "./game/GameLeaveAction";
import { GamePhaseLayout } from "./game/GamePhaseLayout";
import { GamePromptHeader, GamePromptValue } from "./game/GamePromptHeader";
import { GameStatusPanel } from "./game/GameStatusPanel";
import { Mascot } from "./Mascot";
import { DisconnectedPlayersNotice } from "./PlayerConnectionStatus";
import { ScaleGauge } from "./scale/ScaleGauge";

interface RoundIntroScreenProps {
  game: PublicGameState;
  secretLevel: number | null;
  prompt: PublicGamePrompt | null;
  pendingAction: PendingRoomAction;
  errorMessage: string | null;
  players?: readonly PublicPlayer[];
  isConnectionBlocked?: boolean;
  onLeaveRoom: () => void;
}

function getSecondsRemaining(phaseEndsAt: number | null) {
  if (phaseEndsAt === null) {
    return null;
  }

  return Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1_000));
}

export function RoundIntroScreen({
  game,
  secretLevel,
  prompt,
  pendingAction,
  errorMessage,
  players,
  isConnectionBlocked = false,
  onLeaveRoom,
}: RoundIntroScreenProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getSecondsRemaining(game.phaseEndsAt),
  );
  const isPending = pendingAction !== null || isConnectionBlocked;
  const introMascotCharacter = game.currentTurnNumber % 2 === 0 ? "pig" : "poop";

  useEffect(() => {
    const updateCountdown = () => {
      setSecondsRemaining(getSecondsRemaining(game.phaseEndsAt));
    };

    updateCountdown();

    if (game.phaseEndsAt === null) {
      return undefined;
    }

    const countdownTimer = window.setInterval(updateCountdown, 250);

    return () => {
      window.clearInterval(countdownTimer);
    };
  }, [game.phaseEndsAt]);

  const countdownMessage =
    secondsRemaining === null
      ? "Le dessin commencera dès que le serveur sera prêt."
      : secondsRemaining > 0
        ? `Le dessin commence dans ${secondsRemaining} seconde${secondsRemaining > 1 ? "s" : ""}…`
        : "Le serveur prépare la zone de dessin…";

  return (
    <GamePhaseLayout
      ariaLabel="Présentation du tour"
      className="round-intro"
      isBusy={isPending}
      prompt={
        prompt !== null ? (
          <GamePromptHeader
            statement={prompt.statement}
            gauge={
              <ScaleGauge
                lowLabel={prompt.lowLabel}
                highLabel={prompt.highLabel}
                value={secretLevel}
                valueTextLabel="Niveau à représenter"
                size="full"
              />
            }
            valueText={
              secretLevel !== null ? (
                <GamePromptValue label="Niveau à représenter" value={secretLevel} />
              ) : undefined
            }
          />
        ) : (
          <p className="private-level-loading" role="status" aria-live="polite">
            Réception de votre consigne et de votre niveau secret…
          </p>
        )
      }
    >
      <div className="game-phase-layout__main round-intro-stage">
        <div className="round-intro-stage__content">
          <Mascot
            character={introMascotCharacter}
            expression="surprised"
            size="md"
            decorative
            className="round-intro-mascot round-intro-mascot--surprised"
          />
          <p className="card-label">Manche {game.currentRound}</p>
          <h2>Tout le monde dessine en même temps</h2>
          <p>Chacun a sa propre consigne et son propre niveau secret.</p>
        </div>
      </div>

      <aside className="game-phase-layout__sidebar">
        <GameStatusPanel game={game} />
        <DisconnectedPlayersNotice players={players} />

        {errorMessage !== null && (
          <p className="form-message form-message--error game-sidebar-message" role="alert">
            {errorMessage}
          </p>
        )}

        <p
          className="countdown game-sidebar-countdown"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {countdownMessage}
        </p>

        <GameLeaveAction
          id="round-leave-warning"
          message="Quitter annule la partie pour le groupe."
          pendingAction={pendingAction}
          disabled={isPending}
          onLeaveRoom={onLeaveRoom}
        />

        {pendingAction !== null && (
          <p className="visually-hidden" role="status" aria-live="polite">
            {pendingAction === "leave"
              ? "Départ de la partie en cours."
              : "Lancement de la partie en cours."}
          </p>
        )}
      </aside>
    </GamePhaseLayout>
  );
}
