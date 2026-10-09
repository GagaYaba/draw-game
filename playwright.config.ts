import { defineConfig, devices } from "@playwright/test";

const PORT = 3480;

export default defineConfig({
  testDir: "e2e",
  // Chaque scénario joue une partie complète : un worker limite les interférences entre serveurs.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm start",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    // Délai de reconnexion réduit pour tester l'expiration sans attendre 60 secondes.
    env: {
      PORT: String(PORT),
      NODE_ENV: "production",
      PLAYER_RECONNECT_GRACE_MS: "6000",
      // Tous les tests partent de la même adresse : le quota de production (5 salons par jour) ne convient pas.
      MAX_ROOMS_PER_IP_PER_DAY: "1000",
    },
    timeout: 180_000,
  },
});
