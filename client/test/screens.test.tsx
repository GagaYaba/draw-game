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

import { App, AppLayout } from "../src/App";
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

describe("accueil et salon", () => {
  it("affiche l'accueil, ses erreurs et son état d'attente", () => {
    const props = {
      nickname: "Alice",
      roomCode: "ABCDE",
      pendingAction: null,
      errorMessage: null,
      onNicknameChange: noop,
      onRoomCodeChange: noop,
      onCreateRoom: noop,
      onJoinRoom: noop,
    };

    const idle = html(<HomeScreen {...props} />);
    assert.match(idle, /Rejoignez la table de jeu/);
    assert.match(idle, /De 2 à 6 joueurs/);
    assert.match(html(<HomeScreen {...props} errorMessage="Code inconnu" />), /Code inconnu/);
    assert.match(html(<HomeScreen {...props} pendingAction="create" />), /Création…/);
    assert.match(html(<HomeScreen {...props} pendingAction="join" />), /Connexion…/);
    assert.match(html(<HomeScreen {...props} isConnectionBlocked />), /disabled/);
  });

  const lobbyProps = {
    room: room(),
    pendingAction: null,
    errorMessage: null,
    noticeMessage: null,
    onSetReady: noop,
    onStartGame: noop,
    onLeaveRoom: noop,
  } as const;

  it("affiche le salon pour l'hôte et pour un joueur", () => {
    const host = html(<LobbyScreen {...lobbyProps} currentPlayerId="p1" />);
    assert.match(host, /Votre lobby/);
    assert.match(host, /Lancer la partie/);
    assert.match(host, /Je ne suis plus prêt/);
    assert.match(host, /3 \/ 6/);

    const guest = html(<LobbyScreen {...lobbyProps} currentPlayerId="p2" />);
    assert.match(guest, /Je suis prêt/);
    assert.match(guest, /L’hôte lancera la partie/);
    assert.match(
      html(
        <LobbyScreen
          {...lobbyProps}
          currentPlayerId="p2"
          errorMessage="Erreur"
          noticeMessage="Revanche"
          pendingAction="ready"
        />,
      ),
      /Mise à jour…/,
    );
    assert.match(
      html(
        <LobbyScreen
          {...lobbyProps}
          currentPlayerId="p1"
          room={room({
            canStart: true,
            allPlayersReady: true,
            players: PLAYERS.map((player) => ({
              ...player,
              isReady: true,
              isConnected: true,
              reconnectDeadline: null,
            })),
          })}
        />,
      ),
      /Tout le monde est prêt/,
    );
    assert.match(
      html(
        <LobbyScreen
          {...lobbyProps}
          currentPlayerId="p1"
          room={room({ players: [PLAYERS[0] as PublicPlayer], playerCount: 1 })}
        />,
      ),
      /au moins 2 joueurs/,
    );
  });
});

describe("écrans de partie", () => {
  it("affiche l'introduction avec la consigne privée du joueur, ou son chargement", () => {
    const intro = game({ phase: "ROUND_INTRO", phaseEndsAt: Date.now() + 3_000 });

    const ready = html(
      <RoundIntroScreen {...COMMON} game={intro} secretLevel={4} prompt={PROMPT} />,
    );
    assert.match(ready, /Tout le monde dessine en même temps/);
    assert.match(ready, /Dessinez une pieuvre élégante/);
    assert.match(
      html(<RoundIntroScreen {...COMMON} game={intro} secretLevel={null} prompt={null} />),
      /Réception de votre consigne/,
    );
    assert.match(
      html(
        <RoundIntroScreen
          {...COMMON}
          game={game({ phase: "ROUND_INTRO" })}
          secretLevel={4}
          prompt={PROMPT}
          errorMessage="Erreur"
          pendingAction="leave"
        />,
      ),
      /Départ de la partie en cours/,
    );
  });

  it("affiche l'éditeur avant validation puis l'attente des autres joueurs", () => {
    const props = {
      ...COMMON,
      roomCode: "ABCDE",
      secretLevel: 4,
      prompt: PROMPT,
      onSubmitDrawing: noopTrue,
    };

    const editing = html(<DrawingScreen {...props} game={game({})} currentPlayerId="p1" />);
    assert.match(editing, /Valider le dessin/);
    assert.match(editing, /Dessins validés/);

    const waiting = html(
      <DrawingScreen
        {...props}
        game={game({ drawing: { submittedPlayerIds: ["p1"] } })}
        currentPlayerId="p1"
      />,
    );
    assert.match(waiting, /En attente des autres joueurs/);
    assert.match(waiting, /Encore en train de dessiner : Bob, Chloe/);

    const everyone = html(
      <DrawingScreen
        {...props}
        game={game({ drawing: { submittedPlayerIds: ["p1", "p2", "p3"] } })}
        currentPlayerId="p1"
      />,
    );
    assert.match(everyone, /Les votes vont commencer/);
    assert.match(
      html(
        <DrawingScreen
          {...props}
          game={game({})}
          currentPlayerId="p1"
          secretLevel={null}
          prompt={null}
          errorMessage="Erreur"
        />,
      ),
      /Réception de votre/,
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
      <VotingScreen
        {...props}
        currentPlayerId="p2"
        guessState={guess({ selected: 6, error: "Choisissez" })}
      />,
    );
    assert.match(voter, /Quel niveau Alice devait-il représenter/);
    assert.match(voter, /Valider mon estimation/);
    assert.match(voter, /1 estimation reçue sur 2/);
    assert.match(voter, /Votre estimation/);

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
    assert.match(
      html(
        <VotingScreen {...props} currentPlayerId="p2" guessState={guess({ isSubmitting: true })} />,
      ),
      /Validation de votre estimation en cours/,
    );
    assert.match(
      html(
        <VotingScreen
          {...props}
          game={{ ...voting, voting: null, submittedDrawing: null }}
          currentPlayerId="p2"
          guessState={guess()}
        />,
      ),
      /indisponible/,
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

  const steps: [RevealNextStep, string][] = [
    ["NEXT_DRAWING", "Dessin suivant"],
    ["NEXT_ROUND", "Manche suivante"],
    ["FINAL", "Voir le classement final"],
  ];
  for (const [nextStep, label] of steps) {
    it(`affiche la révélation avant « ${label} »`, () => {
      const props = { ...COMMON, game: revealGame(nextStep), onContinueGame: noopTrue };

      const host = html(<RevealScreen {...props} currentPlayerId="p1" isHost />);
      assert.match(host, new RegExp(label));
      assert.match(host, /Les estimations étaient en moyenne à 2 de votre niveau/);
      assert.match(host, /Exact !/);

      const guest = html(<RevealScreen {...props} currentPlayerId="p2" isHost={false} />);
      assert.match(guest, /En attente de l’hôte/);
      assert.match(guest, /Bob/);
    });
  }

  it("affiche la révélation sans résultats ou sans dessin à présenter", () => {
    assert.match(
      html(
        <RevealScreen
          {...COMMON}
          game={revealGame(null)}
          currentPlayerId="p1"
          isHost
          onContinueGame={noopTrue}
        />,
      ),
      /Résultats indisponibles/,
    );
    assert.equal(
      html(
        <RevealScreen
          {...COMMON}
          game={game({ phase: "REVEAL" })}
          currentPlayerId="p1"
          isHost
          onContinueGame={noopTrue}
        />,
      ),
      "",
    );
    assert.match(
      html(
        <RevealScreen
          {...COMMON}
          game={revealGame("FINAL")}
          currentPlayerId="p1"
          isHost
          pendingAction="continue"
          errorMessage="Erreur"
          onContinueGame={noopTrue}
        />,
      ),
      /Préparation…/,
    );
  });

  const finished = (winnerCount: number): PublicFinishedState => ({
    leaderboard: LEADERBOARD,
    winners: LEADERBOARD.slice(0, winnerCount).map((entry) => ({
      ...entry.player,
      score: entry.score,
    })),
    completedRounds: 2,
    completedTurns: 6,
  });

  it("affiche le classement final, la victoire ou l'égalité et la revanche", () => {
    const props = { ...COMMON, currentPlayerId: "p1", onRequestRematch: noopTrue };

    const win = html(<FinishedScreen {...props} finished={finished(1)} isHost />);
    assert.match(win, /Victoire de Alice/);
    assert.match(win, /Proposer une revanche/);
    assert.match(
      html(<FinishedScreen {...props} finished={finished(2)} isHost={false} />),
      /Victoire partagée/,
    );
    assert.match(
      html(<FinishedScreen {...props} finished={finished(2)} isHost={false} />),
      /L’hôte peut proposer une revanche/,
    );
    assert.match(html(<FinishedScreen {...props} finished={null} isHost />), /indisponible/i);
  });
});

describe("connexion et mise en page", () => {
  const overlay = (status: Parameters<typeof ConnectionRecoveryOverlay>[0]["status"], extra = {}) =>
    html(
      <ConnectionRecoveryOverlay
        status={status}
        announcement="Annonce"
        hasStoredSession
        isRetryingSessionRestore={false}
        onRetry={noop}
        {...extra}
      />,
    );

  it("signale une connexion interrompue, une restauration et un échec", () => {
    assert.match(overlay("disconnected"), /Connexion interrompue/);
    assert.match(overlay("restoring"), /Restauration/);
    assert.match(overlay("restore-failed"), /Restauration interrompue/);
    assert.match(overlay("restore-failed", { isRetryingSessionRestore: true }), /button/);
    assert.doesNotMatch(overlay("connected"), /connection-recovery-overlay/);
    assert.doesNotMatch(
      overlay("disconnected", { hasStoredSession: false }),
      /connection-recovery-overlay/,
    );
  });

  it("adapte la mise en page à la partie, au salon et à l'accueil", () => {
    assert.match(html(<AppLayout isGameActive>contenu</AppLayout>), /app-shell--active/);
    assert.match(
      html(
        <AppLayout isGameActive={false} isLobby>
          contenu
        </AppLayout>,
      ),
      /app-shell--lobby/,
    );
    assert.match(html(<AppLayout isGameActive={false}>contenu</AppLayout>), /Jeu multijoueur/);
  });

  it("assemble l'application à l'accueil sans navigateur", () => {
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
