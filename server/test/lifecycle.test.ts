import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { GameManager } from "../src/game/game-manager.js";
import { RoomManager } from "../src/rooms/room-manager.js";
import {
  DEFAULT_RECONNECT_GRACE_MS,
  isValidReconnectGraceMs,
  MAX_RECONNECT_TIMER_DELAY_MS,
  ReconnectManager,
  type ReconnectExpirationResult,
} from "../src/sessions/reconnect-manager.js";
import { SessionRestorationManager } from "../src/sessions/session-restoration.js";
import {
  closeHttpServer,
  closeSocketServer,
  createGracefulShutdown,
  installShutdownSignalHandlers,
  type ShutdownSignal,
} from "../src/shutdown/graceful-shutdown.js";

const silentLogger = { info: () => undefined, error: () => undefined };

describe("arrêt gracieux", () => {
  const options = (overrides: Partial<Parameters<typeof createGracefulShutdown>[0]> = {}) => {
    const calls: string[] = [];
    const exits: number[] = [];
    return {
      calls,
      exits,
      options: {
        closeSocketServer: async () => void calls.push("socket"),
        closeHttpServer: async () => void calls.push("http"),
        dispose: () => void calls.push("dispose"),
        exit: (code: number) => void exits.push(code),
        logger: silentLogger,
        ...overrides,
      },
    };
  };

  it("ferme les ressources dans l'ordre puis quitte avec le code 0, une seule fois", async () => {
    const { calls, exits, options: shutdownOptions } = options();
    const controller = createGracefulShutdown(shutdownOptions);

    assert.equal(controller.isShuttingDown, false);
    const first = controller.shutdown("SIGTERM");
    assert.equal(controller.isShuttingDown, true);
    assert.equal(controller.shutdown("SIGINT"), first);
    await first;

    assert.deepEqual(calls, ["socket", "http", "dispose"]);
    assert.deepEqual(exits, [0]);
  });

  const failures: [string, Partial<Parameters<typeof createGracefulShutdown>[0]>][] = [
    [
      "la fermeture Socket.IO",
      { closeSocketServer: async () => Promise.reject(new Error("socket")) },
    ],
    ["la fermeture HTTP", { closeHttpServer: async () => Promise.reject(new Error("http")) }],
    [
      "la libération des ressources",
      {
        dispose: () => {
          throw new Error("dispose");
        },
      },
    ],
  ];

  for (const [label, overrides] of failures) {
    it(`quitte avec le code 1 si ${label} échoue`, async () => {
      const { exits, options: shutdownOptions } = options(overrides);
      await createGracefulShutdown(shutdownOptions).shutdown("SIGINT");

      assert.deepEqual(exits, [1]);
    });
  }

  it("force l'arrêt après le délai si une fermeture ne se termine pas", async () => {
    let forced: (() => void) | undefined;
    const {
      calls,
      exits,
      options: shutdownOptions,
    } = options({
      closeSocketServer: () => new Promise<void>(() => undefined),
      scheduleTimeout: (callback) => {
        forced = callback;
        return 1;
      },
      clearScheduledTimeout: () => undefined,
    });
    void createGracefulShutdown(shutdownOptions).shutdown("SIGTERM");

    assert.ok(forced);
    forced();
    assert.deepEqual(calls, ["dispose"]);
    assert.deepEqual(exits, [1]);
  });

  it("refuse un délai d'arrêt forcé invalide", () => {
    const { options: shutdownOptions } = options({ forceShutdownDelayMs: 0 });
    assert.throws(() => createGracefulShutdown(shutdownOptions), RangeError);
  });

  it("ignore les serveurs déjà arrêtés et remonte les autres erreurs", async () => {
    const notRunning = Object.assign(new Error("not running"), { code: "ERR_SERVER_NOT_RUNNING" });
    const fail = new Error("boom");

    await closeSocketServer({ close: (callback) => callback(notRunning) });
    await closeSocketServer({
      close: () => {
        throw notRunning;
      },
    });
    await assert.rejects(closeSocketServer({ close: (callback) => callback(fail) }), fail);
    await assert.rejects(
      closeSocketServer({
        close: () => {
          throw fail;
        },
      }),
      fail,
    );

    await closeHttpServer({ listening: false, close: () => assert.fail("pas d'appel attendu") });
    await closeHttpServer({ listening: true, close: (callback) => callback() });
    await closeHttpServer({ listening: true, close: (callback) => callback(notRunning) });
    await assert.rejects(
      closeHttpServer({ listening: true, close: (callback) => callback(fail) }),
      fail,
    );
    await assert.rejects(
      closeHttpServer({
        listening: true,
        close: () => {
          throw fail;
        },
      }),
      fail,
    );
    await closeHttpServer({
      listening: true,
      close: () => {
        throw notRunning;
      },
    });
  });

  it("n'exécute qu'un arrêt par signal reçu et permet de retirer les écouteurs", () => {
    const listeners = new Map<ShutdownSignal, () => void>();
    const source = {
      once: (signal: ShutdownSignal, listener: () => void) => void listeners.set(signal, listener),
      off: (signal: ShutdownSignal) => void listeners.delete(signal),
    };
    const received: ShutdownSignal[] = [];
    installShutdownSignalHandlers(source, async (signal) => void received.push(signal));

    listeners.get("SIGTERM")?.();
    listeners.get("SIGINT")?.();
    assert.deepEqual(received, ["SIGTERM"]);
    assert.equal(listeners.size, 0);

    const uninstall = installShutdownSignalHandlers(source, async () => undefined);
    assert.equal(listeners.size, 2);
    uninstall();
    uninstall();
    assert.equal(listeners.size, 0);
  });
});

describe("expiration des reconnexions", () => {
  function setup(overrides: ConstructorParameters<typeof ReconnectManager>[2] = {}) {
    let now = 1_000;
    const timers: { callback: () => void; delay: number; cleared: boolean }[] = [];
    const expirations: ReconnectExpirationResult[] = [];
    const errors: unknown[] = [];
    const rooms = new RoomManager({ clock: () => now });
    const games = new GameManager(rooms, { clock: () => now });
    const reconnect = new ReconnectManager(rooms, games, {
      graceMs: 100,
      clock: () => now,
      scheduleTimer: (callback, delay) => {
        timers.push({ callback, delay, cleared: false });
        return timers.length - 1;
      },
      clearTimer: (handle) => {
        const timer = timers[handle as number];
        if (timer) {
          timer.cleared = true;
        }
      },
      onPlayerExpired: (result) => expirations.push(result),
      onError: (error) => errors.push(error),
      ...overrides,
    });
    const code = rooms.createRoom("s0", "Alice", randomUUID()).session.roomCode;
    rooms.joinRoom("s1", "Bob", code, randomUUID());

    return {
      rooms,
      games,
      reconnect,
      timers,
      expirations,
      errors,
      code,
      clock: () => now,
      advance: (ms: number) => {
        now += ms;
      },
    };
  }

  it("retire le joueur absent à l'échéance et prévient l'appelant", () => {
    const { rooms, reconnect, timers, expirations, code, advance } = setup();

    const disconnection = reconnect.markPlayerDisconnected("s1");
    assert.ok(disconnection);
    assert.equal(disconnection.reconnectDeadline, 1_100);
    assert.equal(reconnect.getPendingTimerCount(), 1);
    assert.equal(timers[0]?.delay, 100);

    advance(100);
    timers[0]?.callback();

    assert.equal(expirations.length, 1);
    assert.equal(expirations[0]?.departure.room?.playerCount, 1);
    assert.equal(expirations[0]?.gameWasCancelled, false);
    assert.equal(reconnect.getPendingTimerCount(), 0);
    assert.equal(rooms.getPublicRoomState(code).playerCount, 1);
  });

  it("annule le minuteur d'un joueur revenu à temps", () => {
    const { reconnect, timers, expirations } = setup();
    const disconnection = reconnect.markPlayerDisconnected("s1");
    assert.ok(disconnection);

    reconnect.clearPlayerReconnectTimer(disconnection.roomCode, disconnection.playerId);
    reconnect.clearPlayerReconnectTimer(disconnection.roomCode, disconnection.playerId);

    assert.equal(timers[0]?.cleared, true);
    assert.equal(reconnect.getPendingTimerCount(), 0);
    assert.equal(expirations.length, 0);
  });

  it("reprogramme un minuteur déclenché avant l'échéance", () => {
    const { reconnect, timers, expirations, advance } = setup();
    reconnect.markPlayerDisconnected("s1");

    advance(40);
    timers[0]?.callback();

    assert.equal(expirations.length, 0);
    assert.equal(timers.length, 2);
    assert.equal(timers[1]?.delay, 60);
  });

  it("annule la partie en cours quand un joueur expire", () => {
    const { rooms, games, reconnect, timers, expirations, advance } = setup({ graceMs: 50 });
    const { code } = (() => {
      const code = rooms.createRoom("s5", "Carole", randomUUID()).session.roomCode;
      rooms.joinRoom("s6", "Dan", code, randomUUID());
      rooms.setPlayerReady("s5", true);
      rooms.setPlayerReady("s6", true);
      return { code };
    })();
    games.startGame("s5");

    reconnect.markPlayerDisconnected("s6");
    advance(50);
    timers.at(-1)?.callback();

    assert.equal(expirations.at(-1)?.gameWasCancelled, true);
    assert.equal(rooms.getRoomByCode(code)?.game, null);
  });

  it("force l'expiration si le minuteur ne peut pas être programmé", () => {
    const { reconnect, expirations, errors } = setup({
      scheduleTimer: () => {
        throw new Error("minuteur indisponible");
      },
    });

    assert.equal(reconnect.markPlayerDisconnected("s1"), null);
    assert.equal(errors.length, 1);
    assert.equal(expirations.length, 1);
  });

  it("ignore les connexions inconnues, libère les minuteurs et valide le délai", () => {
    const { reconnect, timers } = setup();
    assert.equal(reconnect.markPlayerDisconnected("inconnue"), null);

    reconnect.markPlayerDisconnected("s1");
    reconnect.dispose();
    assert.equal(timers[0]?.cleared, true);

    assert.equal(isValidReconnectGraceMs(DEFAULT_RECONNECT_GRACE_MS), true);
    assert.equal(isValidReconnectGraceMs(0), true);
    assert.equal(isValidReconnectGraceMs(MAX_RECONNECT_TIMER_DELAY_MS + 1), false);
    assert.equal(isValidReconnectGraceMs(-1), false);
    assert.equal(isValidReconnectGraceMs(1.5), false);
    assert.throws(() => setup({ graceMs: -1 }), RangeError);
  });

  it("restaure une session et annule son minuteur de reconnexion", () => {
    const { rooms, reconnect, timers, clock } = setup();
    const restoration = new SessionRestorationManager(rooms, reconnect, { clock });
    const clientInstanceId = randomUUID();
    const zoe = rooms.createRoom("s9", "Zoé", clientInstanceId);
    reconnect.markPlayerDisconnected("s9");
    assert.equal(reconnect.getPendingTimerCount(), 1);

    const restored = restoration.restoreSession("s10", {
      roomCode: zoe.session.roomCode,
      playerId: zoe.session.playerId,
      token: zoe.session.token,
      clientInstanceId,
    });

    assert.equal(restored.data.session.playerId, zoe.session.playerId);
    assert.equal(reconnect.getPendingTimerCount(), 0);
    assert.equal(timers.at(-1)?.cleared, true);

    restoration.rollbackRoomAdmission(zoe.session.roomCode, zoe.session.playerId);
    assert.equal(rooms.getRoomByCode(zoe.session.roomCode), undefined);
  });
});
