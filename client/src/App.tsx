import type { ReactNode } from "react";

import { ConnectionRecoveryOverlay } from "./components/ConnectionRecoveryOverlay";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { DrawingScreen } from "./components/DrawingScreen";
import { FinishedScreen } from "./components/FinishedScreen";
import { GameLogo } from "./components/GameLogo";
import { HealthCheck } from "./components/HealthCheck";
import { HomeScreen } from "./components/HomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { RevealScreen } from "./components/RevealScreen";
import { RoundIntroScreen } from "./components/RoundIntroScreen";
import { VotingScreen } from "./components/VotingScreen";
import { useRoomSession } from "./hooks/useRoomSession";

interface AppLayoutProps {
  isGameActive: boolean;
  isLobby?: boolean;
  children: ReactNode;
}

export function AppLayout({ isGameActive, isLobby = false, children }: AppLayoutProps) {
  const shellClassName = isGameActive
    ? "app-shell app-shell--active"
    : isLobby
      ? "app-shell app-shell--lobby"
      : "app-shell";

  return (
    <main className={shellClassName}>
      {!isGameActive && (
        <header className="hero">
          <p className="kicker">Jeu multijoueur</p>
          <GameLogo />
          <p className="subtitle">
            Réunissez votre groupe dans un salon avant de commencer à dessiner.
          </p>
        </header>
      )}

      {children}

      <details
        className="diagnostics"
        hidden={isGameActive}
        aria-hidden={isGameActive ? true : undefined}
      >
        <summary>Diagnostic technique</summary>
        <div className="panels diagnostics-panels">
          <ConnectionPanel />
          <HealthCheck />
        </div>
      </details>

      {!isGameActive && <footer>React · Express · Socket.IO · TypeScript</footer>}
    </main>
  );
}

export function App() {
  const roomSession = useRoomSession();
  const room = roomSession.session.room;
  const currentPlayerId = roomSession.session.currentPlayerId;
  const game = room?.game ?? null;
  const isGameActive = game !== null && game.phase !== "LOBBY";
  const currentPlayer = room?.players.find((player) => player.id === currentPlayerId) ?? null;
  const roundSecrets =
    game !== null &&
    (game.phase === "ROUND_INTRO" || game.phase === "DRAWING") &&
    roomSession.gameSecrets.gameId === game.gameId &&
    roomSession.gameSecrets.turnId === game.turnId
      ? roomSession.gameSecrets
      : null;

  return (
    <>
      <AppLayout isGameActive={isGameActive} isLobby={room !== null && !isGameActive}>
        {room === null ? (
          <HomeScreen
            nickname={roomSession.nickname}
            roomCode={roomSession.roomCode}
            pendingAction={roomSession.pendingAction}
            errorMessage={roomSession.errorMessage}
            isConnectionBlocked={roomSession.isConnectionBlocked}
            onNicknameChange={roomSession.setNickname}
            onRoomCodeChange={roomSession.setRoomCode}
            onCreateRoom={roomSession.createRoom}
            onJoinRoom={roomSession.joinRoom}
          />
        ) : game === null || game.phase === "LOBBY" ? (
          <LobbyScreen
            room={room}
            currentPlayerId={currentPlayerId}
            pendingAction={roomSession.pendingAction}
            errorMessage={roomSession.errorMessage}
            noticeMessage={roomSession.noticeMessage}
            isConnectionBlocked={roomSession.isConnectionBlocked}
            onSetReady={roomSession.setReady}
            onStartGame={roomSession.startGame}
            onLeaveRoom={roomSession.leaveRoom}
          />
        ) : game.phase === "ROUND_INTRO" ? (
          <RoundIntroScreen
            game={game}
            secretLevel={roundSecrets?.secretLevel ?? null}
            prompt={roundSecrets?.prompt ?? null}
            pendingAction={roomSession.pendingAction}
            errorMessage={roomSession.errorMessage}
            players={room.players}
            isConnectionBlocked={roomSession.isConnectionBlocked}
            onLeaveRoom={roomSession.leaveRoom}
          />
        ) : game.phase === "DRAWING" ? (
          <DrawingScreen
            roomCode={room.code}
            game={game}
            currentPlayerId={currentPlayerId}
            secretLevel={roundSecrets?.secretLevel ?? null}
            prompt={roundSecrets?.prompt ?? null}
            pendingAction={roomSession.pendingAction}
            errorMessage={roomSession.errorMessage}
            players={room.players}
            isConnectionBlocked={roomSession.isConnectionBlocked}
            onSubmitDrawing={roomSession.submitDrawing}
            onLeaveRoom={roomSession.leaveRoom}
          />
        ) : game.phase === "VOTING" ? (
          <VotingScreen
            game={game}
            currentPlayerId={currentPlayerId}
            guessState={roomSession.guessState}
            pendingAction={roomSession.pendingAction}
            errorMessage={roomSession.errorMessage}
            players={room.players}
            isConnectionBlocked={roomSession.isConnectionBlocked}
            onSelectGuess={roomSession.selectGuess}
            onSubmitGuess={roomSession.submitGuess}
            onLeaveRoom={roomSession.leaveRoom}
          />
        ) : game.phase === "REVEAL" ? (
          <RevealScreen
            game={game}
            currentPlayerId={currentPlayerId}
            isHost={currentPlayer?.isHost ?? false}
            pendingAction={roomSession.pendingAction}
            errorMessage={roomSession.errorMessage}
            players={room.players}
            isConnectionBlocked={roomSession.isConnectionBlocked}
            onContinueGame={roomSession.continueGame}
            onLeaveRoom={roomSession.leaveRoom}
          />
        ) : (
          <FinishedScreen
            finished={game.finished}
            currentPlayerId={currentPlayerId}
            isHost={currentPlayer?.isHost ?? false}
            pendingAction={roomSession.pendingAction}
            errorMessage={roomSession.errorMessage}
            players={room.players}
            isConnectionBlocked={roomSession.isConnectionBlocked}
            onRequestRematch={roomSession.requestRematch}
            onLeaveRoom={roomSession.leaveRoom}
          />
        )}
      </AppLayout>
      <ConnectionRecoveryOverlay
        status={roomSession.connectionStatus}
        announcement={roomSession.connectionAnnouncement}
        hasStoredSession={roomSession.hasStoredSession}
        isRetryingSessionRestore={roomSession.isRetryingSessionRestore}
        onRetry={roomSession.retrySessionRestore}
      />
    </>
  );
}
