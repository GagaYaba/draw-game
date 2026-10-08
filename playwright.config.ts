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
    env: { PORT: String(PORT), NODE_ENV: "production" },
    timeout: 180_000,
  },
});
