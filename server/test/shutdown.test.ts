import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  closeHttpServer,
  closeSocketServer,
  createGracefulShutdown,
  installShutdownSignalHandlers,
  type ShutdownSignal,
} from "../src/shutdown/graceful-shutdown.js";

const silentLogger = { info: () => undefined, error: () => undefined };

function setup(overrides: Partial<Parameters<typeof createGracefulShutdown>[0]> = {}) {
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
}

describe("arrêt gracieux", () => {
  // Risque : un déploiement Render envoie SIGTERM ; il ne doit pas laisser de connexions ni de minuteurs.
  it("ferme les ressources dans l'ordre, quitte avec 0 ou 1 selon le résultat, et force l'arrêt si besoin", async () => {
    const success = setup();
    const controller = createGracefulShutdown(success.options);
    const first = controller.shutdown("SIGTERM");
    assert.equal(controller.shutdown("SIGINT"), first, "un seul arrêt par processus");
    await first;
    assert.deepEqual(success.calls, ["socket", "http", "dispose"]);
    assert.deepEqual(success.exits, [0]);

    const failing = setup({ closeHttpServer: async () => Promise.reject(new Error("http")) });
    await createGracefulShutdown(failing.options).shutdown("SIGINT");
    assert.deepEqual(failing.exits, [1]);

    let forced: (() => void) | undefined;
    const stuck = setup({
      closeSocketServer: () => new Promise<void>(() => undefined),
      scheduleTimeout: (callback) => {
        forced = callback;
        return 1;
      },
      clearScheduledTimeout: () => undefined,
    });
    void createGracefulShutdown(stuck.options).shutdown("SIGTERM");
    forced?.();
    assert.deepEqual(stuck.calls, ["dispose"]);
    assert.deepEqual(stuck.exits, [1]);

    assert.throws(
      () => createGracefulShutdown(setup({ forceShutdownDelayMs: 0 }).options),
      RangeError,
    );
  });

  it("ignore un serveur déjà arrêté et n'exécute qu'un arrêt par signal reçu", async () => {
    const notRunning = Object.assign(new Error("arrêté"), { code: "ERR_SERVER_NOT_RUNNING" });
    const failure = new Error("échec");

    await closeSocketServer({ close: (callback) => callback(notRunning) });
    await assert.rejects(closeSocketServer({ close: (callback) => callback(failure) }), failure);
    await closeHttpServer({ listening: false, close: () => assert.fail("pas d'appel attendu") });
    await closeHttpServer({ listening: true, close: (callback) => callback(notRunning) });
    await assert.rejects(
      closeHttpServer({ listening: true, close: (callback) => callback(failure) }),
      failure,
    );

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
    assert.equal(listeners.size, 0, "les écouteurs sont retirés après le premier signal");
  });
});
