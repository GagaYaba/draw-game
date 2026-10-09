import type { PendingRoomAction } from "../../hooks/useRoomSession";

interface GameLeaveActionProps {
  id: string;
  message: string;
  pendingAction: PendingRoomAction;
  disabled?: boolean;
  onLeaveRoom: () => void;
}

export function GameLeaveAction({
  id,
  message,
  pendingAction,
  disabled = false,
  onLeaveRoom,
}: GameLeaveActionProps) {
  return (
    <div className="game-sidebar-leave">
      <p id={id}>{message}</p>
      <button
        className="button button--danger-ghost"
        type="button"
        onClick={onLeaveRoom}
        disabled={disabled}
        aria-describedby={id}
      >
        {pendingAction === "leave" ? "Départ…" : "Quitter la partie"}
      </button>
    </div>
  );
}
