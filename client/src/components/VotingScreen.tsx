import { useEffect, useState } from "react";

import type { GuessValue, PublicGameState, PublicPlayer } from "@drawing-game/shared";

import type { ClientGuessState, PendingRoomAction } from "../hooks/useRoomSession";
import { DrawingPreview } from "./drawing/DrawingPreview";
import { GameLeaveAction } from "./game/GameLeaveAction";
import { GamePhaseLayout } from "./game/GamePhaseLayout";
import { GamePromptHeader, GamePromptValue } from "./game/GamePromptHeader";
import { GameStatusPanel } from "./game/GameStatusPanel";
import { Mascot } from "./Mascot";
import { DisconnectedPlayersNotice } from "./PlayerConnectionStatus";
import { GuessScale } from "./scale/GuessScale.js";
import { ScaleGauge } from "./scale/ScaleGauge";
import { GameDialog } from "./ui/GameDialog";

interface VotingScreenProps {
  game: PublicGameState;
  currentPlayerId: string | null;
  secretLevel: GuessValue | null;
  guessState: ClientGuessState;
  pendingAction: PendingRoomAction;
  errorMessage: string | null;
  players?: readonly PublicPlayer[];
  isConnectionBlocked?: boolean;
  onSelectGuess: (value: GuessValue) => void;
  onSubmitGuess: () => boolean;
  onLeaveRoom: () => void;
}

function formatVoteProgress(submittedCount: number, eligibleCount: number) {
  const submittedLabel = submittedCount === 1 ? "estimation reçue" : "estimations reçues";

  return `${submittedCount} ${submittedLabel} sur ${eligibleCount}`;
}

interface GuessConfirmationDialogProps {
  value: GuessValue | null;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GuessConfirmationDialog({
  value,
  isBusy = false,
  onConfirm,
  onCancel,
}: GuessConfirmationDialogProps) {
  return (
    <GameDialog
      open={value !== null}
      title="Valider votre estimation ?"
      description="Votre estimation sera envoyée définitivement pour ce tour et vous ne pourrez plus la changer."
      confirmLabel="Valider mon estimation"
      cancelLabel="Modifier mon choix"
      value={
        value === null ? undefined : (
          <span aria-label={`Estimation choisie : ${value} sur 10`}>{value} / 10</span>
        )
      }
      mascot={{
        character: "poop",
        expression: "confused",
      }}
      isBusy={isBusy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function VotingScreen({
  game,
  currentPlayerId,
  secretLevel,
  guessState,
  pendingAction,
  errorMessage,
  players,
  isConnectionBlocked = false,
  onSelectGuess,
  onSubmitGuess,
  onLeaveRoom,
}: VotingScreenProps) {
  const [guessToConfirm, setGuessToConfirm] = useState<GuessValue | null>(null);
  const isDrawer = currentPlayerId === game.currentDrawer.id;
  const isPending = pendingAction !== null || guessState.isSubmitting || isConnectionBlocked;
  const voting = game.voting;
  const voteProgress =
    voting === null
      ? "Progression des estimations indisponible"
      : formatVoteProgress(voting.submittedGuessCount, voting.eligibleVoterCount);
  const submittedGuess = guessState.submitted?.value ?? null;
  const displayedGuess = submittedGuess ?? guessState.selected;

  useEffect(() => {
    if (isDrawer || isPending || submittedGuess !== null) {
      setGuessToConfirm(null);
    }
  }, [isDrawer, isPending, submittedGuess]);

  const handleGuessChange = (value: number) => {
    if (Number.isInteger(value) && value >= 1 && value <= 10) {
      onSelectGuess(value as GuessValue);
    }
  };

  const handleGuessSubmission = () => {
    if (guessState.selected === null || isPending) {
      return;
    }

    setGuessToConfirm(guessState.selected);
  };

  const handleConfirmedGuessSubmission = () => {
    if (guessToConfirm === null || guessState.selected !== guessToConfirm || isPending) {
      setGuessToConfirm(null);
      return;
    }

    setGuessToConfirm(null);
    onSubmitGuess();
  };

  return (
    <>
      <GamePhaseLayout
        ariaLabel="Phase d’estimation"
        className="voting-screen"
        prompt={
          <GamePromptHeader
            statement={game.prompt.statement}
            gaugePrompt={
              isDrawer ? undefined : (
                <p id="guess-question-title">Quel niveau le dessinateur devait-il représenter ?</p>
              )
            }
            gauge={
              isDrawer ? (
                <ScaleGauge
                  lowLabel={game.prompt.lowLabel}
                  highLabel={game.prompt.highLabel}
                  value={secretLevel}
                  valueTextLabel="Votre niveau secret"
                  size="full"
                />
              ) : (
                <GuessScale
                  lowLabel={game.prompt.lowLabel}
                  highLabel={game.prompt.highLabel}
                  value={displayedGuess}
                  onChange={handleGuessChange}
                  disabled={isPending || submittedGuess !== null}
                  ariaLabel="Choisissez votre estimation définitive entre 1 et 10"
                  size="full"
                  showValueText={false}
                />
              )
            }
            valueText={
              isDrawer && secretLevel !== null ? (
                <GamePromptValue label="Votre niveau secret" value={secretLevel} />
              ) : displayedGuess !== null ? (
                <GamePromptValue label="Votre estimation" value={displayedGuess} />
              ) : undefined
            }
          />
        }
        isBusy={isPending}
      >
        <div className="game-phase-layout__main game-media-viewport">
          {game.submittedDrawing === null ? (
            <p className="form-message form-message--error" role="alert">
              Le dessin soumis est indisponible. Attendez le prochain état du serveur.
            </p>
          ) : (
            <DrawingPreview
              drawing={game.submittedDrawing.document}
              description={`Dessin soumis par ${game.currentDrawer.nickname} pour la consigne « ${game.prompt.statement} ».`}
            />
          )}
        </div>

        <aside className="game-phase-layout__sidebar voting-sidebar">
          <GameStatusPanel game={game} />
          <DisconnectedPlayersNotice players={players} />

          {errorMessage !== null && (
            <p className="form-message form-message--error game-sidebar-message" role="alert">
              {errorMessage}
            </p>
          )}

          {voting === null && (
            <p className="form-message form-message--error game-sidebar-message" role="alert">
              La progression du vote est indisponible. Attendez le prochain état du serveur.
            </p>
          )}

          <div className="vote-progress" role="status" aria-live="polite" aria-atomic="true">
            <span>Progression</span>
            <strong>{voteProgress}</strong>
          </div>

          {isDrawer ? (
            <section
              className="game-sidebar-section voting-wait-state"
              aria-labelledby="drawer-vote-title"
            >
              <Mascot
                character="pig"
                expression="surprised"
                size="sm"
                decorative
                className="voting-state-mascot voting-state-mascot--drawer-waiting"
              />
              <p className="card-label">Vote en cours</p>
              <h2 id="drawer-vote-title">Les autres joueurs essaient de deviner votre niveau.</h2>
              <p>Votre niveau reste masqué jusqu’à la révélation.</p>
            </section>
          ) : guessState.submitted !== null ? (
            <section
              className="game-sidebar-section submitted-guess-card voting-wait-state"
              aria-labelledby="submitted-guess-title"
            >
              <Mascot
                character="pig"
                expression="happy"
                size="sm"
                decorative
                className="voting-state-mascot voting-state-mascot--submitted"
              />
              <p className="card-label">Estimation validée</p>
              <h2 id="submitted-guess-title">Votre réponse est enregistrée.</h2>
              <p>En attente des autres joueurs…</p>
            </section>
          ) : (
            <section
              className="game-sidebar-section guess-submit-panel"
              aria-label="Validation de l’estimation"
            >
              <Mascot
                character="poop"
                expression="confused"
                size="sm"
                decorative
                className="voting-state-mascot voting-state-mascot--choosing"
              />
              {guessState.error !== null && (
                <p className="form-message form-message--error guess-error" role="alert">
                  {guessState.error}
                </p>
              )}

              <button
                className="button button--primary guess-submit-button"
                type="button"
                onClick={handleGuessSubmission}
                disabled={guessState.selected === null || isPending}
              >
                {guessState.isSubmitting ? "Validation…" : "Valider mon estimation"}
              </button>
            </section>
          )}

          <GameLeaveAction
            id="voting-leave-warning"
            message="Quitter annule la partie pour le groupe."
            pendingAction={pendingAction}
            disabled={isPending}
            onLeaveRoom={onLeaveRoom}
          />

          {guessState.isSubmitting && (
            <p className="visually-hidden" role="status" aria-live="polite">
              Validation de votre estimation en cours.
            </p>
          )}
        </aside>
      </GamePhaseLayout>

      <GuessConfirmationDialog
        value={guessToConfirm}
        isBusy={isPending}
        onConfirm={handleConfirmedGuessSubmission}
        onCancel={() => setGuessToConfirm(null)}
      />
    </>
  );
}
