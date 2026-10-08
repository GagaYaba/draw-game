import type { PublicDrawerResult, PublicGameState, PublicPlayer } from "@drawing-game/shared";

import type { PendingRoomAction } from "../hooks/useRoomSession";
import { DrawingPreview } from "./drawing/DrawingPreview";
import { GameLeaderboard } from "./game/GameLeaderboard";
import { GameLeaveAction } from "./game/GameLeaveAction";
import { GamePhaseLayout } from "./game/GamePhaseLayout";
import { GamePromptHeader, GamePromptValue } from "./game/GamePromptHeader";
import { GameStatusPanel } from "./game/GameStatusPanel";
import { Mascot, type MascotCharacter, type MascotExpression } from "./Mascot";
import { DisconnectedPlayersNotice } from "./PlayerConnectionStatus";
import { ScaleGauge } from "./scale/ScaleGauge";

interface RevealScreenProps {
  game: PublicGameState;
  currentPlayerId: string | null;
  isHost: boolean;
  pendingAction: PendingRoomAction;
  errorMessage: string | null;
  players?: readonly PublicPlayer[];
  isConnectionBlocked?: boolean;
  onContinueGame: () => boolean;
  onLeaveRoom: () => void;
}

export interface RevealMascotReaction {
  character: MascotCharacter;
  expression: MascotExpression;
  modifier: string;
}

export function getGuessResultMascotReaction(distance: number): RevealMascotReaction {
  if (distance === 0) {
    return {
      character: "pig",
      expression: "dance",
      modifier: "exact",
    };
  }

  if (distance === 1) {
    return {
      character: "pig",
      expression: "happy",
      modifier: "close",
    };
  }

  if (distance <= 3) {
    return {
      character: "pig",
      expression: "surprised",
      modifier: "near",
    };
  }

  if (distance === 4) {
    return {
      character: "poop",
      expression: "confused",
      modifier: "far",
    };
  }

  return {
    character: "poop",
    expression: "sad",
    modifier: "very-far",
  };
}

export function getDrawerResultMascotReaction(
  closeGuessCount: number,
  totalGuessCount: number,
): RevealMascotReaction {
  if (closeGuessCount === 0) {
    return {
      character: "poop",
      expression: "sad",
      modifier: "none-close",
    };
  }

  if (closeGuessCount >= Math.ceil(totalGuessCount / 2)) {
    return {
      character: "pig",
      expression: "dance",
      modifier: "many-close",
    };
  }

  return {
    character: "pig",
    expression: "surprised",
    modifier: "some-close",
  };
}

function formatPoints(points: number) {
  return `${points} point${points === 1 ? "" : "s"}`;
}

function formatFoundPlayers(count: number) {
  if (count === 0) {
    return "Aucun joueur n’a trouvé";
  }

  if (count === 1) {
    return "1 joueur a trouvé";
  }

  return `${count} joueurs ont trouvé`;
}

function getDrawerResultMessage(drawerResult: PublicDrawerResult, currentPlayerId: string | null) {
  const foundPlayers = formatFoundPlayers(drawerResult.closeGuessCount);
  const earnedPoints = formatPoints(drawerResult.pointsEarned);

  if (drawerResult.player.id === currentPlayerId) {
    return `${foundPlayers} votre niveau à ±1. Vous gagnez ${earnedPoints}.`;
  }

  return `${foundPlayers} le niveau de ${drawerResult.player.nickname} à ±1. ${drawerResult.player.nickname} gagne ${earnedPoints}.`;
}

export function RevealScreen({
  game,
  currentPlayerId,
  isHost,
  pendingAction,
  errorMessage,
  players,
  isConnectionBlocked = false,
  onContinueGame,
  onLeaveRoom,
}: RevealScreenProps) {
  const reveal = game.reveal;
  const isPending = pendingAction !== null || isConnectionBlocked;
  const isContinuing = pendingAction === "continue";
  const continueLabel =
    reveal?.nextDrawer === null ? "Voir le classement final" : "Lancer le prochain tour";
  const drawerReaction =
    reveal === null
      ? null
      : getDrawerResultMascotReaction(reveal.drawerResult.closeGuessCount, reveal.guesses.length);

  return (
    <GamePhaseLayout
      ariaLabel="Révélation du tour"
      className="reveal-screen"
      prompt={
        <GamePromptHeader
          statement={game.prompt.statement}
          gauge={
            <ScaleGauge
              lowLabel={game.prompt.lowLabel}
              highLabel={game.prompt.highLabel}
              value={reveal?.secretLevel ?? null}
              valueTextLabel="Niveau secret révélé"
              size="full"
            />
          }
          valueText={
            reveal === null ? undefined : (
              <GamePromptValue
                label="Le niveau secret était"
                value={reveal.secretLevel}
                separator=""
              />
            )
          }
        />
      }
      isBusy={isPending}
    >
      <div className="game-phase-layout__main game-media-viewport">
        {game.submittedDrawing === null ? (
          <p className="form-message form-message--error" role="alert">
            Le dessin soumis est indisponible.
          </p>
        ) : (
          <DrawingPreview
            drawing={game.submittedDrawing.document}
            description={`Dessin révélé de ${game.currentDrawer.nickname} pour la consigne « ${game.prompt.statement} ».`}
          />
        )}
      </div>

      <aside className="game-phase-layout__sidebar reveal-sidebar">
        <GameStatusPanel game={game} />
        <DisconnectedPlayersNotice players={players} />

        {errorMessage !== null && (
          <p className="form-message form-message--error game-sidebar-message" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="reveal-sidebar__content">
          {reveal === null ? (
            <section className="game-sidebar-section">
              <p className="card-label">Révélation</p>
              <h2>Résultats indisponibles</h2>
              <p className="form-message form-message--error" role="alert">
                Attendez le prochain état du serveur.
              </p>
            </section>
          ) : (
            <>
              <section
                className="game-sidebar-card reveal-drawer-result"
                aria-labelledby="drawer-result-title"
              >
                {drawerReaction !== null && (
                  <Mascot
                    character={drawerReaction.character}
                    expression={drawerReaction.expression}
                    size="sm"
                    decorative
                    className={`reveal-reaction-mascot reveal-reaction-mascot--drawer reveal-reaction-mascot--${drawerReaction.modifier}`}
                  />
                )}
                <p className="card-label">Points du dessinateur</p>
                <h2 id="drawer-result-title">
                  {drawerResultTitle(reveal.drawerResult, currentPlayerId)}
                </h2>
                <p>{getDrawerResultMessage(reveal.drawerResult, currentPlayerId)}</p>
                <strong className="reveal-total-score">
                  Total : {formatPoints(reveal.drawerResult.totalScore)}
                </strong>
              </section>

              <section className="reveal-results" aria-labelledby="reveal-results-title">
                <div className="reveal-results__heading">
                  <p className="card-label">Estimations validées</p>
                  <h2 id="reveal-results-title">Points du tour</h2>
                </div>
                <ol
                  className="reveal-result-list"
                  aria-label="Estimations et points gagnés pendant le tour"
                  tabIndex={0}
                >
                  {reveal.guesses.map((guess) => {
                    const reaction =
                      guess.player.id === currentPlayerId
                        ? getGuessResultMascotReaction(guess.distance)
                        : null;

                    return (
                      <li
                        key={guess.player.id}
                        className={
                          reaction === null
                            ? undefined
                            : `reveal-result-list__item reveal-result-list__item--current reveal-result-list__item--${reaction.modifier}`
                        }
                      >
                        <span className="reveal-player-name">
                          {reaction !== null && (
                            <Mascot
                              character={reaction.character}
                              expression={reaction.expression}
                              size="xs"
                              decorative
                              className={`reveal-reaction-mascot reveal-reaction-mascot--guess reveal-reaction-mascot--${reaction.modifier}`}
                            />
                          )}
                          {guess.player.nickname}
                        </span>
                        <span className="reveal-guess-value">{guess.value} / 10</span>
                        <strong className="reveal-distance">
                          {guess.distance === 0 ? "Exact !" : `Écart : ${guess.distance}`}
                        </strong>
                        <strong className="reveal-points-earned">
                          +{formatPoints(guess.pointsEarned)}
                        </strong>
                        <span className="reveal-player-total">
                          Total : {formatPoints(guess.totalScore)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <GameLeaderboard entries={reveal.leaderboard} currentPlayerId={currentPlayerId} />
            </>
          )}
        </div>

        {reveal !== null && (
          <section
            className="game-sidebar-section reveal-continuation"
            aria-labelledby="reveal-continuation-title"
          >
            <p className="card-label">Suite de la partie</p>
            <h2 id="reveal-continuation-title">
              {reveal.nextDrawer === null
                ? "Tous les tours sont terminés."
                : `${reveal.nextDrawer.nickname} dessinera au prochain tour.`}
            </h2>
            {isHost ? (
              <button
                className="button button--primary reveal-continue-button"
                type="button"
                onClick={onContinueGame}
                disabled={isPending}
              >
                {isContinuing ? "Préparation…" : continueLabel}
              </button>
            ) : (
              <p className="form-message form-message--info" role="status" aria-live="polite">
                En attente de l’hôte pour continuer…
              </p>
            )}
          </section>
        )}

        <GameLeaveAction
          id="reveal-leave-warning"
          message="Quitter annule la partie pour le groupe."
          pendingAction={pendingAction}
          disabled={isPending}
          onLeaveRoom={onLeaveRoom}
        />
      </aside>
    </GamePhaseLayout>
  );
}

function drawerResultTitle(drawerResult: PublicDrawerResult, currentPlayerId: string | null) {
  return drawerResult.player.id === currentPlayerId
    ? "Votre dessin a rapporté des points"
    : `Points de ${drawerResult.player.nickname}`;
}
