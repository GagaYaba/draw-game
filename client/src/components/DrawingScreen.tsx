import type {
  DrawingDocument,
  PublicGamePrompt,
  PublicGameState,
  PublicPlayer,
} from "@drawing-game/shared";

import type { PendingRoomAction } from "../hooks/useRoomSession";
import { DrawingEditor } from "./drawing/DrawingEditor";
import { GameLeaveAction } from "./game/GameLeaveAction";
import { GamePhaseLayout } from "./game/GamePhaseLayout";
import { GamePromptHeader, GamePromptValue } from "./game/GamePromptHeader";
import { GameStatusPanel } from "./game/GameStatusPanel";
import { Mascot } from "./Mascot";
import { DisconnectedPlayersNotice } from "./PlayerConnectionStatus";
import { ScaleGauge } from "./scale/ScaleGauge";

import "./DrawingScreen.css";

interface DrawingScreenProps {
  roomCode?: string;
  game: PublicGameState;
  currentPlayerId: string | null;
  secretLevel: number | null;
  prompt: PublicGamePrompt | null;
  pendingAction: PendingRoomAction;
  errorMessage: string | null;
  players?: readonly PublicPlayer[];
  isConnectionBlocked?: boolean;
  onSubmitDrawing: (drawing: DrawingDocument) => boolean;
  onLeaveRoom: () => void;
}

export function DrawingScreen({
  roomCode = "",
  game,
  currentPlayerId,
  secretLevel,
  prompt,
  pendingAction,
  errorMessage,
  players,
  isConnectionBlocked = false,
  onSubmitDrawing,
  onLeaveRoom,
}: DrawingScreenProps) {
  const submittedPlayerIds = game.drawing?.submittedPlayerIds ?? [];
  const hasSubmitted = currentPlayerId !== null && submittedPlayerIds.includes(currentPlayerId);
  const waitingNicknames = (players ?? [])
    .filter((player) => !submittedPlayerIds.includes(player.id))
    .map((player) => player.nickname);
  const isPending = pendingAction !== null || isConnectionBlocked;
  const isSubmitting = pendingAction === "submitDrawing";
  const drawingMascotCharacter = game.currentRound % 2 === 0 ? "pig" : "poop";
  const promptHeader =
    prompt === null ? (
      <p className="private-level-loading" role="status" aria-live="polite">
        Réception de votre consigne et de votre niveau secret…
      </p>
    ) : (
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
    );
  const leaveAction = (
    <GameLeaveAction
      id="drawing-leave-warning"
      message="Quitter annule la partie pour le groupe."
      pendingAction={pendingAction}
      disabled={isPending}
      onLeaveRoom={onLeaveRoom}
    />
  );

  return (
    <GamePhaseLayout
      ariaLabel="Phase de dessin"
      className="drawing-screen"
      prompt={promptHeader}
      isBusy={isPending}
    >
      {!hasSubmitted ? (
        <DrawingEditor
          key={`${game.gameId}:${game.turnId}:${currentPlayerId ?? ""}`}
          disabled={isPending || secretLevel === null || prompt === null}
          isSubmitting={isSubmitting}
          draftContext={{
            roomCode,
            gameId: game.gameId,
            turnId: game.turnId,
            playerId: currentPlayerId ?? "",
          }}
          onSubmit={onSubmitDrawing}
          sidebarHeader={
            <>
              <GameStatusPanel game={game} />
              <DisconnectedPlayersNotice players={players} />
              <Mascot
                character={drawingMascotCharacter}
                expression="neutral"
                size="xs"
                decorative
                className="drawing-sidebar-mascot drawing-sidebar-mascot--neutral"
              />
              {errorMessage !== null && (
                <p className="form-message form-message--error game-sidebar-message" role="alert">
                  {errorMessage}
                </p>
              )}
              {(secretLevel === null || prompt === null) && (
                <p
                  className="private-level-loading game-sidebar-message"
                  role="status"
                  aria-live="polite"
                >
                  Réception de votre niveau secret…
                </p>
              )}
            </>
          }
          sidebarFooter={leaveAction}
        />
      ) : (
        <>
          <div className="game-phase-layout__main game-media-viewport drawing-observer-viewport">
            <div
              className="drawing-observer-stage"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="drawing-observer-stage__content">
                <Mascot
                  character={drawingMascotCharacter}
                  expression="fly"
                  size="lg"
                  decorative
                  className="drawing-observer-stage__mascot"
                />
                <p className="drawing-observer-stage__message">
                  Les dessins seront présentés un par un quand tout le monde aura validé le sien.
                </p>
              </div>
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

            <section
              className="game-sidebar-card game-sidebar-card--waiting"
              aria-labelledby="drawing-wait-title"
            >
              <Mascot
                character={drawingMascotCharacter}
                expression="neutral"
                size="sm"
                decorative
                className="drawing-wait-mascot drawing-wait-mascot--neutral"
              />
              <p className="card-label">Dessin validé</p>
              <h2 id="drawing-wait-title">En attente des autres joueurs.</h2>
              <p>
                {waitingNicknames.length > 0
                  ? `Encore en train de dessiner : ${waitingNicknames.join(", ")}.`
                  : "Tout le monde a validé. Les votes vont commencer."}
              </p>
            </section>

            {leaveAction}

            {pendingAction !== null && (
              <p className="visually-hidden" role="status" aria-live="polite">
                {pendingAction === "leave" ? "Départ de la partie en cours." : "Action en cours."}
              </p>
            )}
          </aside>
        </>
      )}
    </GamePhaseLayout>
  );
}
