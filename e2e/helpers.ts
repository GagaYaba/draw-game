import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export interface Player {
  name: string;
  context: BrowserContext;
  page: Page;
}

export async function openPlayer(browser: Browser, name: string, baseURL: string): Promise<Player> {
  // Chaque joueur possède son propre contexte : stockage et socket indépendants.
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rejoignez la table de jeu" })).toBeVisible();
  return { name, context, page };
}

export async function createRoom(host: Player): Promise<string> {
  await host.page.getByLabel("Pseudonyme").fill(host.name);
  await host.page.getByRole("button", { name: "Créer une partie" }).click();
  await expect(host.page.getByRole("heading", { name: "Votre lobby" })).toBeVisible();
  const code = await host.page.locator(".room-code span[aria-hidden='true']").textContent();
  if (!code) throw new Error("Code de salon introuvable.");
  return code.trim();
}

export async function joinRoom(player: Player, code: string): Promise<void> {
  await player.page.getByLabel("Pseudonyme").fill(player.name);
  await player.page.getByLabel("Code de la partie").fill(code);
  await player.page.getByRole("button", { name: "Rejoindre la partie" }).click();
  await expect(player.page.getByRole("heading", { name: "Votre lobby" })).toBeVisible();
}

/** Trouve le joueur dont l'écran propose le dessin. */
export async function findDrawer(players: Player[]): Promise<Player> {
  for (;;) {
    for (const player of players) {
      if (await player.page.getByRole("button", { name: "Valider le dessin" }).isVisible()) {
        return player;
      }
    }
    await players[0]?.page.waitForTimeout(200);
  }
}

export async function drawSimpleStroke(player: Player): Promise<void> {
  const canvas = player.page.locator("canvas[aria-label^='Zone de dessin']");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Zone de dessin non visible.");
  await player.page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await player.page.mouse.down();
  await player.page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 });
  await player.page.mouse.up();
  await player.page.getByRole("button", { name: "Valider le dessin" }).click();
  await player.page.getByRole("dialog").getByRole("button", { name: "Valider mon dessin" }).click();
}

export async function voteValue(player: Player, value: number): Promise<void> {
  await player.page.getByRole("button", { name: `Choisir ${value} sur 10` }).click();
  await player.page.getByRole("button", { name: "Valider mon estimation" }).click();
  await player.page
    .getByRole("dialog")
    .getByRole("button", { name: "Valider mon estimation" })
    .click();
}
