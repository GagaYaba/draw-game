import type { ClientToServerEvents, ServerToClientEvents } from "@drawing-game/shared";
import { io, type Socket } from "socket.io-client";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
});
