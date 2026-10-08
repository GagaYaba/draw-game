import type { PendingRoomAction } from "../hooks/useRoomSession";
import { Mascot } from "./Mascot";

interface HomeScreenProps {
  nickname: string;
  roomCode: string;
  pendingAction: PendingRoomAction;
  errorMessage: string | null;
  isConnectionBlocked?: boolean;
  onNicknameChange: (nickname: string) => void;
  onRoomCodeChange: (roomCode: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export function HomeScreen({
  nickname,
  roomCode,
  pendingAction,
  errorMessage,
  isConnectionBlocked = false,
  onNicknameChange,
  onRoomCodeChange,
  onCreateRoom,
  onJoinRoom,
}: HomeScreenProps) {
  const isPending = pendingAction !== null || isConnectionBlocked;

  const handleJoinSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onJoinRoom();
  };

  return (
    <div className="home-table-layout">
      <Mascot
        character="poop"
        expression="neutral"
        size="lg"
        decorative
        className="home-table-layout__mascot home-table-layout__mascot--low mascot--arrive"
      />
      <section
        className="game-card welcome-card"
        aria-labelledby="welcome-title"
        aria-busy={isPending}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nouveau salon</p>
            <h2 id="welcome-title">Rejoignez la table de jeu</h2>
          </div>
          <span className="capacity-note">De 2 à 6 joueurs</span>
        </div>

        <div className="field field--nickname">
          <label htmlFor="nickname">Pseudonyme</label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            value={nickname}
            onChange={(event) => onNicknameChange(event.target.value)}
            minLength={2}
            maxLength={20}
            autoComplete="nickname"
            placeholder="Pseudo"
            aria-describedby={errorMessage === null ? undefined : "room-form-error"}
            disabled={isPending}
          />
          <p className="field-hint">Entre 2 et 20 caractères.</p>
        </div>

        {errorMessage !== null && (
          <p
            className="form-message form-message--error form-message--with-mascot"
            id="room-form-error"
            role="alert"
          >
            <Mascot
              character="poop"
              expression={roomCode.trim() === "" ? "confused" : "angry"}
              size="xs"
              decorative
            />
            <span>{errorMessage}</span>
          </p>
        )}

        <div className="room-actions">
          <section className="action-card" aria-labelledby="create-title">
            <div>
              <p className="action-number" aria-hidden="true">
                01
              </p>
              <h3 id="create-title">Créer une partie</h3>
              <p>Ouvrez un salon et partagez son code avec votre groupe.</p>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={onCreateRoom}
              disabled={isPending}
            >
              {pendingAction === "create" ? "Création…" : "Créer une partie"}
            </button>
          </section>

          <form className="action-card" onSubmit={handleJoinSubmit} aria-labelledby="join-title">
            <div>
              <p className="action-number" aria-hidden="true">
                02
              </p>
              <h3 id="join-title">Rejoindre une partie</h3>
              <label htmlFor="room-code">Code de la partie</label>
              <input
                className="room-code-input"
                id="room-code"
                name="roomCode"
                type="text"
                value={roomCode}
                onChange={(event) => onRoomCodeChange(event.target.value)}
                maxLength={5}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                placeholder="7KXMP"
                aria-describedby={errorMessage === null ? undefined : "room-form-error"}
                disabled={isPending}
              />
            </div>
            <button className="button button--secondary" type="submit" disabled={isPending}>
              {pendingAction === "join" ? "Connexion…" : "Rejoindre la partie"}
            </button>
          </form>
        </div>

        {isPending && (
          <p className="visually-hidden" role="status" aria-live="polite">
            {isConnectionBlocked
              ? "Les actions sont indisponibles pendant la restauration de la session."
              : pendingAction === "create"
                ? "Création du salon en cours."
                : "Connexion au salon en cours."}
          </p>
        )}
      </section>
      <Mascot
        character="pig"
        expression="neutral"
        size="lg"
        decorative
        className="home-table-layout__mascot home-table-layout__mascot--high mascot--arrive"
      />
    </div>
  );
}
