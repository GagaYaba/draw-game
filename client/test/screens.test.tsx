import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  PublicFinishedState,
  PublicGameState,
  PublicPlayer,
  PublicRevealState,
  PublicRoomState,
  RevealNextStep,
} from "@drawing-game/shared";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "../src/App";
import { ConnectionRecoveryOverlay } from "../src/components/ConnectionRecoveryOverlay";
import { DrawingScreen } from "../src/components/DrawingScreen";
import { FinishedScreen } from "../src/components/FinishedScreen";
import { HomeScreen } from "../src/components/HomeScreen";
import { LobbyScreen } from "../src/components/LobbyScreen";
import { RevealScreen } from "../src/components/RevealScreen";
import { RoundIntroScreen } from "../src/components/RoundIntroScreen";
import { VotingScreen } from "../src/components/VotingScreen";
import type { ClientGuessState } from "../src/hooks/useRoomSession";

const html = (element: ReactElement) => renderToStaticMarkup(element);
const noop = () => undefined;
const noopTrue = () => true;

const PLAYERS: PublicPlayer[] = [
  {
    id: "p1",
    nickname: "Alice",
    isHost: true,
    isReady: true,
    isConnected: true,
    reconnectDeadline: null,
    score: 4,
  },
  {
    id: "p2",
    nickname: "Bob",
    isHost: false,
    isReady: false,
    isConnected: true,
    reconnectDeadline: null,
    score: 2,
  },
  {
    id: "p3",
    nickname: "Chloe",
    isHost: false,
    isReady: true,
    isConnected: false,
    reconnectDeadline: Date.now() + 30_000,
    score: 0,
  },
];
const PROMPT = {
  id: "x",
  statement: "Dessinez une pieuvre élégante",
  lowLabel: "Torchon",
  highLabel: "Robe royale",
};
const DRAWING = {
  version: 2 as const,
  aspectRatio: "4:3" as const,
  backgroundColor: "#FFFFFF" as const,
  strokes: [
    {
      tool: "pen" as const,
      color: "#111111",
      width: 4 as const,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
      ],
    },
  ],
};
const LEADERBOARD = PLAYERS.map((player, index) => ({
  rank: index + 1,
  player: { id: player.id, nickname: player.nickname },
  score: player.score,
}));

function game(overrides: Partial<PublicGameState>): PublicGameState {
  return {
    gameId: "g1",
    phase: "DRAWING",
    turnId: "t1",
    totalRounds: 2,
    currentRound: 1,
    currentTurnNumber: 1,
    totalTurns: 6,
    currentDrawer: null,
    prompt: null,
    phaseEndsAt: null,
    drawing: { submittedPlayerIds: [] },
    submittedDrawing: null,
    voting: null,
    reveal: null,
    finished: null,
    ...overrides,
  };
}

function room(overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    code: "ABCDE",
    players: PLAYERS,
    playerCount: 3,
    maxPlayers: 6,
    minimumPlayersToStart: 2,
    allPlayersReady: false,
    canStart: false,
    game: null,
    ...overrides,
  };
}

const COMMON = { pendingAction: null, errorMessage: null, players: PLAYERS, onLeaveRoom: noop };

// Ces tests exécutent le code de rendu de chaque écran sans navigateur (rendu côté serveur).
// Risque : un écran qui plante au rendu bloque tout le groupe ; les interactions relèvent de l'E2E.
describe("écrans du jeu", () => {
  it("affiche l'accueil et le salon, pour l'hôte comme pour un joueur", () => {
    const home = {
      nickname: "Alice",
      roomCode: "ABCDE",
      pendingAction: null,
      errorMessage: null,
      onNicknameChange: noop,
      onRoomCodeChange: noop,
      onCreateRoom: noop,
      onJoinRoom: noop,
    };
    assert.match(html(<HomeScreen {...home} />), /De 2 à 6 joueurs/);
    assert.match(html(<HomeScreen {...home} errorMessage="Code inconnu" />), /Code inconnu/);
    assert.match(html(<HomeScreen {...home} pendingAction="create" />), /Création…/);

    const lobby = {
      room: room(),
      pendingAction: null,
      errorMessage: null,
      noticeMessage: null,
      onSetReady: noop,
      onStartGame: noop,
      onLeaveRoom: noop,
    } as const;
    const host = html(<LobbyScreen {...lobby} currentPlayerId="p1" />);
    assert.match(host, /Lancer la partie/);
    assert.match(host, /3 \/ 6/);
    assert.match(html(<LobbyScreen {...lobby} currentPlayerId="p2" />), /L’hôte lancera la partie/);
    const ready = room({
      canStart: true,
      allPlayersReady: true,
      players: PLAYERS.map((player) => ({
        ...player,
        isReady: true,
        isConnected: true,
        reconnectDeadline: null,
      })),
    });
    assert.match(
      html(<LobbyScreen {...lobby} currentPlayerId="p1" room={ready} />),
      /Tout le monde est prêt/,
    );
    assert.match(
      html(
        <LobbyScreen
          {...lobby}
          currentPlayerId="p1"
          room={room({ players: [PLAYERS[0] as PublicPlayer], playerCount: 1 })}
        />,
      ),
      /au moins 2 joueurs/,
    );
  });

  it("affiche l'introduction, l'éditeur de dessin et l'attente des autres joueurs", () => {
    const intro = game({ phase: "ROUND_INTRO", phaseEndsAt: Date.now() + 3_000 });
    assert.match(
      html(<RoundIntroScreen {...COMMON} game={intro} secretLevel={4} prompt={PROMPT} />),
      /Dessinez une pieuvre élégante/,
    );
    assert.match(
      html(<RoundIntroScreen {...COMMON} game={intro} secretLevel={null} prompt={null} />),
      /Réception de votre consigne/,
    );

    const props = {
      ...COMMON,
      roomCode: "ABCDE",
      secretLevel: 4,
      prompt: PROMPT,
      onSubmitDrawing: noopTrue,
    };
    assert.match(
      html(<DrawingScreen {...props} game={game({})} currentPlayerId="p1" />),
      /Valider le dessin/,
    );
    const waiting = html(
      <DrawingScreen
        {...props}
        game={game({ drawing: { submittedPlayerIds: ["p1"] } })}
        currentPlayerId="p1"
      />,
    );
    assert.match(waiting, /En attente des autres joueurs/);
    assert.match(waiting, /Encore en train de dessiner : Bob, Chloe/);
    const everyone = game({ drawing: { submittedPlayerIds: ["p1", "p2", "p3"] } });
    assert.match(
      html(<DrawingScreen {...props} game={everyone} currentPlayerId="p1" />),
      /Les votes vont commencer/,
    );
  });

  const voting = game({
    phase: "VOTING",
    turnId: "t2",
    currentDrawer: { id: "p1", nickname: "Alice" },
    prompt: PROMPT,
    drawing: null,
    submittedDrawing: { document: DRAWING, submittedAt: 1 },
    voting: { eligibleVoterCount: 2, submittedGuessCount: 1 },
  });
  const guess = (overrides: Partial<ClientGuessState> = {}): ClientGuessState => ({
    selected: null,
    submitted: null,
    isSubmitting: false,
    error: null,
    ...overrides,
  });

  it("affiche le vote : choix du votant, estimation validée, dessin de l'auteur", () => {
    const props = { ...COMMON, game: voting, onSelectGuess: noop, onSubmitGuess: noopTrue };
    const voter = html(
      <VotingScreen {...props} currentPlayerId="p2" guessState={guess({ selected: 6 })} />,
    );
    assert.match(voter, /Quel niveau Alice devait-il représenter/);
    assert.match(voter, /1 estimation reçue sur 2/);
    assert.match(
      html(
        <VotingScreen
          {...props}
          currentPlayerId="p2"
          guessState={guess({ selected: 6, submitted: { value: 6, submittedAt: 1 } })}
        />,
      ),
      /Votre réponse est enregistrée/,
    );
    assert.match(
      html(<VotingScreen {...props} currentPlayerId="p1" guessState={guess()} />),
      /Votre dessin est présenté/,
    );
    assert.equal(
      html(
        <VotingScreen
          {...props}
          game={game({ phase: "VOTING" })}
          currentPlayerId="p2"
          guessState={guess()}
        />,
      ),
      "",
    );
  });

  const reveal = (nextStep: RevealNextStep): PublicRevealState => ({
    secretLevel: 5,
    guesses: [
      {
        player: { id: "p2", nickname: "Bob" },
        value: 5,
        distance: 0,
        pointsEarned: 2,
        totalScore: 2,
      },
      {
        player: { id: "p3", nickname: "Chloe" },
        value: 9,
        distance: 4,
        pointsEarned: 0,
        totalScore: 0,
      },
    ],
    drawerResult: {
      player: { id: "p1", nickname: "Alice" },
      averageDistance: 2,
      pointsEarned: 1,
      totalScore: 4,
    },
    leaderboard: LEADERBOARD,
    nextStep,
  });
  const revealGame = (nextStep: RevealNextStep | null) =>
    game({
      phase: "REVEAL",
      turnId: "t2",
      currentDrawer: { id: "p1", nickname: "Alice" },
      prompt: PROMPT,
      drawing: null,
      submittedDrawing: { document: DRAWING, submittedAt: 1 },
      reveal: nextStep === null ? null : reveal(nextStep),
    });

  it("affiche la révélation et le bouton adapté à la suite de la partie", () => {
    const labels: [RevealNextStep, string][] = [
      ["NEXT_DRAWING", "Dessin suivant"],
      ["NEXT_ROUND", "Manche suivante"],
      ["FINAL", "Voir le classement final"],
    ];
    for (const [nextStep, label] of labels) {
      const props = { ...COMMON, game: revealGame(nextStep), onContinueGame: noopTrue };
      const host = html(<RevealScreen {...props} currentPlayerId="p1" isHost />);
      assert.match(host, new RegExp(label), label);
      assert.match(host, /Les estimations étaient en moyenne à 2 de votre niveau/);
      assert.match(host, /Exact !/);
      assert.match(
        html(<RevealScreen {...props} currentPlayerId="p2" isHost={false} />),
        /En attente de l’hôte/,
      );
    }

    const props = { ...COMMON, currentPlayerId: "p1", isHost: true, onContinueGame: noopTrue };
    assert.match(
      html(<RevealScreen {...props} game={revealGame(null)} />),
      /Résultats indisponibles/,
    );
    assert.equal(html(<RevealScreen {...props} game={game({ phase: "REVEAL" })} />), "");
  });

  it("affiche le classement final, la connexion interrompue et l'application", () => {
    const finished = (winnerCount: number): PublicFinishedState => ({
      leaderboard: LEADERBOARD,
      winners: LEADERBOARD.slice(0, winnerCount).map((entry) => ({
        ...entry.player,
        score: entry.score,
      })),
      completedRounds: 2,
      completedTurns: 6,
    });
    const props = { ...COMMON, currentPlayerId: "p1", onRequestRematch: noopTrue };
    assert.match(
      html(<FinishedScreen {...props} finished={finished(1)} isHost />),
      /Victoire de Alice/,
    );
    assert.match(
      html(<FinishedScreen {...props} finished={finished(2)} isHost />),
      /Proposer une revanche/,
    );
    const tie = html(<FinishedScreen {...props} finished={finished(2)} isHost={false} />);
    assert.match(tie, /Victoire partagée/);
    assert.match(tie, /L’hôte peut proposer une revanche/);

    const overlay = (
      status: Parameters<typeof ConnectionRecoveryOverlay>[0]["status"],
      hasStoredSession = true,
    ) =>
      html(
        <ConnectionRecoveryOverlay
          status={status}
          announcement="Annonce"
          hasStoredSession={hasStoredSession}
          isRetryingSessionRestore={false}
          onRetry={noop}
        />,
      );
    assert.match(overlay("disconnected"), /Connexion interrompue/);
    assert.match(overlay("restore-failed"), /Restauration interrompue/);
    assert.doesNotMatch(overlay("connected"), /connection-recovery-overlay/);
    assert.doesNotMatch(overlay("disconnected", false), /connection-recovery-overlay/);

    const globals = globalThis as unknown as { window?: unknown };
    const previous = globals.window;
    globals.window = {
      location: { search: "?room=ABCDE" },
      localStorage: undefined,
      sessionStorage: undefined,
    };
    try {
      assert.match(html(<App />), /Rejoignez la table de jeu/);
    } finally {
      globals.window = previous;
    }
  });
});
