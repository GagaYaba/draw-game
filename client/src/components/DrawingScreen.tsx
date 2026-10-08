import type { DrawingDocument, PublicGameState, PublicPlayer } from "@drawing-game/shared";

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
  pendingAction,
  errorMessage,
  players,
  isConnectionBlocked = false,
  onSubmitDrawing,
  onLeaveRoom,
}: DrawingScreenProps) {
  const isDrawer = currentPlayerId === game.currentDrawer.id;
  const isPending = pendingAction !== null || isConnectionBlocked;
  const isSubmitting = pendingAction === "submitDrawing";
  const drawingMascotCharacter = game.currentTurnNumber % 2 === 0 ? "pig" : "poop";
  const promptHeader = (
    <GamePromptHeader
      statement={game.prompt.statement}
      gauge={
        <ScaleGauge
          lowLabel={game.prompt.lowLabel}
          highLabel={game.prompt.highLabel}
          value={isDrawer ? secretLevel : null}
          valueTextLabel="Niveau à représenter"
          size="full"
          reserveMarkerSpace={!isDrawer}
        />
      }
      valueText={
        isDrawer && secretLevel !== null ? (
          <GamePromptValue label="Niveau à représenter" value={secretLevel} />
        ) : !isDrawer ? (
          <p className="scale-gauge__value-text game-prompt-value">
            <span className="visually-hidden">Niveau à représenter : secret</span>
            <span aria-hidden="true">Niveau à représenter :</span>
            <strong aria-hidden="true">?</strong>
            <span aria-hidden="true">/ 10</span>
          </p>
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
      {isDrawer ? (
        <DrawingEditor
          key={`${game.gameId}:${game.turnId}:${currentPlayerId ?? ""}`}
          disabled={isPending || secretLevel === null}
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
              {secretLevel === null && (
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
                  Le dessin apparaîtra ici après sa validation.
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
              <p className="card-label">Dessin en cours</p>
              <h2 id="drawing-wait-title">{game.currentDrawer.nickname} dessine actuellement.</h2>
              <p>Son niveau reste secret. Le dessin apparaîtra seulement après sa validation.</p>
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
