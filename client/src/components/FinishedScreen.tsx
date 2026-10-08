import type {
  PublicFinishedState,
  PublicLeaderboardEntry,
  PublicPlayer,
} from "@drawing-game/shared";

import type { PendingRoomAction } from "../hooks/useRoomSession";
import "./FinishedScreen.css";
import { GameLeaderboard } from "./game/GameLeaderboard";
import { GameLeaveAction } from "./game/GameLeaveAction";
import { GamePhaseLayout } from "./game/GamePhaseLayout";
import { Mascot, type MascotCharacter, type MascotExpression } from "./Mascot";
import { DisconnectedPlayersNotice } from "./PlayerConnectionStatus";

interface FinishedScreenProps {
  finished: PublicFinishedState | null;
  currentPlayerId: string | null;
  isHost: boolean;
  pendingAction: PendingRoomAction;
  errorMessage: string | null;
  players?: readonly PublicPlayer[];
  isConnectionBlocked?: boolean;
  onRequestRematch: () => boolean;
  onLeaveRoom: () => void;
}

interface PodiumMascot {
  character: MascotCharacter;
  expression: MascotExpression;
  legacyModifier: string | null;
}

const PODIUM_SIZE = 3;

function formatPoints(score: number) {
  return `${score} point${score === 1 ? "" : "s"}`;
}

function formatWinnerHeading(finished: PublicFinishedState) {
  if (finished.winners.length === 0) {
    return "Partie terminée";
  }

  if (finished.winners.length === 1) {
    return `Victoire de ${finished.winners[0]?.nickname ?? "la partie"}`;
  }

  return "Victoire partagée";
}

function formatResultAnnouncement(finished: PublicFinishedState) {
  const winningScore = finished.winners[0]?.score ?? 0;

  if (finished.winners.length === 0) {
    return "La partie est terminée sans gagnant annoncé.";
  }

  if (finished.winners.length === 1) {
    return `${finished.winners[0]?.nickname ?? "Le gagnant"} remporte la partie avec ${formatPoints(winningScore)}.`;
  }

  if (finished.winners.length === 2) {
    return `${finished.winners[0]?.nickname ?? "Le premier gagnant"} et ${finished.winners[1]?.nickname ?? "le second gagnant"} remportent la partie avec ${formatPoints(winningScore)}.`;
  }

  return `${finished.winners.length} joueurs terminent à égalité avec ${formatPoints(winningScore)}.`;
}

function formatPlace(rank: number) {
  return rank === 1 ? "1re place" : `${rank}e place`;
}

function getPodiumMascot(
  entry: PublicLeaderboardEntry,
  slot: number,
  finished: PublicFinishedState,
): PodiumMascot {
  const isWinner = finished.winners.some((winner) => winner.id === entry.player.id);

  if (isWinner && finished.winners.length === 1) {
    return {
      character: "pig",
      expression: "formal",
      legacyModifier: "finished-winner-mascot--unique",
    };
  }

  if (isWinner) {
    return {
      character: slot % 2 === 1 ? "pig" : "poop",
      expression: "happy",
      legacyModifier: "finished-winner-mascot--tie",
    };
  }

  if (entry.rank === 2) {
    return {
      character: "poop",
      expression: "happy",
      legacyModifier: null,
    };
  }

  return {
    character: slot % 2 === 1 ? "pig" : "poop",
    expression: "surprised",
    legacyModifier: null,
  };
}

function getPodiumEntryLabel(
  entry: PublicLeaderboardEntry,
  isTied: boolean,
  isCurrentPlayer: boolean,
) {
  return `${formatPlace(entry.rank)}${isTied ? " ex æquo" : ""} : ${entry.player.nickname}, ${formatPoints(entry.score)}${isCurrentPlayer ? ", vous" : ""}`;
}

export function FinishedScreen({
  finished,
  currentPlayerId,
  isHost,
  pendingAction,
  errorMessage,
  players,
  isConnectionBlocked = false,
  onRequestRematch,
  onLeaveRoom,
}: FinishedScreenProps) {
  const isPending = pendingAction !== null || isConnectionBlocked;
  const isRequestingRematch = pendingAction === "rematch";
  const hasSharedFirstPlace = (finished?.winners.length ?? 0) > 1;
  const winnerIds = new Set(finished?.winners.map((winner) => winner.id) ?? []);
  const defaultPodiumEntries = finished?.leaderboard.slice(0, PODIUM_SIZE) ?? [];
  const podiumBoundaryRank = defaultPodiumEntries.at(-1)?.rank;
  const podiumEntries =
    finished === null
      ? []
      : hasSharedFirstPlace
        ? finished.leaderboard.filter((entry) => winnerIds.has(entry.player.id))
        : podiumBoundaryRank === undefined
          ? []
          : finished.leaderboard.filter((entry) => entry.rank <= podiumBoundaryRank);
  const podiumIds = new Set(podiumEntries.map((entry) => entry.player.id));
  const remainingEntries =
    finished === null
      ? []
      : finished.leaderboard.filter((entry) => !podiumIds.has(entry.player.id));
  const hasExtendedPodium = !hasSharedFirstPlace && podiumEntries.length > PODIUM_SIZE;
  const rankCounts = new Map<number, number>();

  for (const entry of finished?.leaderboard ?? []) {
    rankCounts.set(entry.rank, (rankCounts.get(entry.rank) ?? 0) + 1);
  }

  return (
    <GamePhaseLayout
      ariaLabel="Partie terminée"
      className="finished-screen"
      isBusy={isPending}
      prompt={
        <header className="finished-header">
          <p className="card-label">Partie terminée</p>
          <h1>{finished === null ? "Résultats en attente" : formatWinnerHeading(finished)}</h1>
          {finished !== null && (
            <>
              <p
                className="finished-announcement"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {formatResultAnnouncement(finished)}
              </p>
              <p className="finished-completion">
                {finished.completedRounds} manche
                {finished.completedRounds === 1 ? "" : "s"} · {finished.completedTurns} tour
                {finished.completedTurns === 1 ? "" : "s"} joué
                {finished.completedTurns === 1 ? "" : "s"}
              </p>
            </>
          )}
        </header>
      }
    >
      <div className="game-phase-layout__main finished-stage">
        <div className="finished-scene">
          {finished === null ? (
            <p className="form-message form-message--error" role="alert">
              Les résultats finaux sont indisponibles. Attendez le prochain état du serveur.
            </p>
          ) : (
            <section className="finished-podium-section" aria-labelledby="finished-podium-title">
              <div className="finished-podium-heading">
                <p className="card-label">
                  Gagnant{finished.winners.length > 1 ? "s" : ""} · Classement final
                </p>
                <h2 id="finished-podium-title">
                  {finished.winners.length === 1
                    ? "La meilleure interprétation"
                    : "Une première place partagée"}
                </h2>
              </div>

              {podiumEntries.length === 0 ? (
                <p className="form-message form-message--error" role="alert">
                  Aucun classement final n’est disponible.
                </p>
              ) : (
                <ol
                  className={[
                    "finished-podium",
                    `finished-podium--count-${podiumEntries.length}`,
                    hasSharedFirstPlace ? "finished-podium--shared-first" : null,
                    hasExtendedPodium ? "finished-podium--extended" : null,
                  ]
                    .filter((className) => className !== null)
                    .join(" ")}
                  aria-label="Podium final"
                >
                  {podiumEntries.map((entry, index) => {
                    const slot = index + 1;
                    const isCurrentPlayer = entry.player.id === currentPlayerId;
                    const isTied = (rankCounts.get(entry.rank) ?? 0) > 1;
                    const mascot = getPodiumMascot(entry, slot, finished);
                    const mascotClassName = [
                      "finished-podium__mascot",
                      mascot.legacyModifier === null ? null : "finished-winner-mascot",
                      mascot.legacyModifier,
                    ]
                      .filter((className) => className !== null)
                      .join(" ");

                    return (
                      <li
                        key={entry.player.id}
                        className={[
                          "finished-podium__entry",
                          `finished-podium__entry--slot-${slot}`,
                          `finished-podium__entry--rank-${entry.rank}`,
                          isCurrentPlayer ? "finished-podium__entry--current" : null,
                        ]
                          .filter((className) => className !== null)
                          .join(" ")}
                        aria-label={getPodiumEntryLabel(entry, isTied, isCurrentPlayer)}
                      >
                        <div className="finished-podium__portrait">
                          <Mascot
                            character={mascot.character}
                            expression={mascot.expression}
                            size={entry.rank === 1 ? "lg" : "md"}
                            decorative
                            className={mascotClassName}
                          />
                        </div>
                        <div className="finished-podium__identity">
                          <span className="finished-podium__place visually-hidden">
                            {entry.rank}
                          </span>
                          <strong className="finished-podium__nickname">
                            {entry.player.nickname}
                          </strong>
                          {isCurrentPlayer && <small className="finished-podium__you">Vous</small>}
                          <strong className="finished-podium__score">
                            {formatPoints(entry.score)}
                          </strong>
                        </div>
                        <div
                          className="finished-podium__step"
                          data-rank={entry.rank}
                          aria-hidden="true"
                        />
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          )}

          <DisconnectedPlayersNotice players={players} />

          {errorMessage !== null && (
            <p className="form-message form-message--error finished-scene__error" role="alert">
              {errorMessage}
            </p>
          )}

          <div
            className={`finished-scene__footer${remainingEntries.length === 0 ? " finished-scene__footer--actions-only" : ""}`}
          >
            {remainingEntries.length > 0 && (
              <div className="finished-ranking">
                <GameLeaderboard
                  entries={remainingEntries}
                  currentPlayerId={currentPlayerId}
                  title="Suite du classement"
                  ariaLabel="Suite du classement final de la partie"
                />
              </div>
            )}

            <section className="finished-actions" aria-labelledby="finished-rematch-title">
              <div className={`finished-rematch${isHost ? "" : " finished-rematch--guest"}`}>
                <p className="card-label">Rejouer</p>
                <h2 id="finished-rematch-title">Une nouvelle partie ?</h2>
                {isHost ? (
                  <>
                    <Mascot
                      character="pig"
                      expression="jump"
                      size="sm"
                      decorative
                      className="finished-rematch-mascot finished-rematch-mascot--jump"
                    />
                    <p id="finished-rematch-description">
                      Retrouvez le même groupe dans le lobby et préparez une nouvelle partie.
                    </p>
                    <button
                      className="button button--primary finished-rematch-button"
                      type="button"
                      onClick={onRequestRematch}
                      disabled={isPending}
                      aria-describedby="finished-rematch-description"
                    >
                      {isRequestingRematch ? "Préparation…" : "Proposer une revanche"}
                    </button>
                    {isRequestingRematch && (
                      <p className="visually-hidden" role="status" aria-live="polite">
                        Préparation de la revanche en cours.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="form-message form-message--info" role="status" aria-live="polite">
                    L’hôte peut proposer une revanche.
                  </p>
                )}
              </div>

              <GameLeaveAction
                id="finished-leave-note"
                message="La partie est terminée. Vous pouvez quitter le salon."
                pendingAction={pendingAction}
                disabled={isPending}
                onLeaveRoom={onLeaveRoom}
              />
            </section>
          </div>
        </div>
      </div>
    </GamePhaseLayout>
  );
}
