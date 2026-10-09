import type { PublicLeaderboardEntry } from "@drawing-game/shared";

interface GameLeaderboardProps {
  entries: readonly PublicLeaderboardEntry[];
  currentPlayerId: string | null;
  title?: string;
  ariaLabel?: string;
}

function formatScore(score: number) {
  return `${score} point${score === 1 ? "" : "s"}`;
}

export function GameLeaderboard({
  entries,
  currentPlayerId,
  title = "Classement",
  ariaLabel = "Classement de la partie",
}: GameLeaderboardProps) {
  return (
    <section className="game-leaderboard" aria-labelledby="game-leaderboard-title">
      <div className="game-leaderboard__heading">
        <p className="card-label">Scores cumulés</p>
        <h2 id="game-leaderboard-title">{title}</h2>
      </div>
      <ol className="game-leaderboard__list" aria-label={ariaLabel}>
        {entries.map((entry) => {
          const isCurrentPlayer = entry.player.id === currentPlayerId;

          return (
            <li
              key={entry.player.id}
              value={entry.rank}
              className={
                isCurrentPlayer
                  ? "game-leaderboard__entry game-leaderboard__entry--current"
                  : "game-leaderboard__entry"
              }
            >
              <span className="game-leaderboard__rank">
                <span className="visually-hidden">Rang </span>
                <span aria-hidden="true">{entry.rank}</span>
              </span>
              <span className="game-leaderboard__player">
                {entry.player.nickname}
                {isCurrentPlayer && <span className="game-leaderboard__you">Vous</span>}
              </span>
              <strong className="game-leaderboard__score">{formatScore(entry.score)}</strong>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
