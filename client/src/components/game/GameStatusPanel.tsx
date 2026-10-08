import type { PublicGameState } from "@drawing-game/shared";

interface GameStatusPanelProps {
  game: PublicGameState;
}

export function GameStatusPanel({ game }: GameStatusPanelProps) {
  return (
    <dl className="game-status-panel" aria-label="Progression de la partie">
      <div>
        <dt>Manche</dt>
        <dd>
          {game.currentRound} / {game.totalRounds}
        </dd>
      </div>
      <div>
        <dt>Tour</dt>
        <dd>
          {game.currentTurnNumber} / {game.totalTurns}
        </dd>
      </div>
      <div>
        <dt>Dessinateur</dt>
        <dd className="game-status-panel__drawer" title={game.currentDrawer.nickname}>
          {game.currentDrawer.nickname}
        </dd>
      </div>
    </dl>
  );
}
