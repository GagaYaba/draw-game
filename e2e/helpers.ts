import AxeBuilder from "@axe-core/playwright";
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  expect,
  type Page,
} from "@playwright/test";

import { settleAnimations } from "./contrast";

export interface Player {
  name: string;
  context: BrowserContext;
  page: Page;
}

export interface OpenPlayerOptions {
  /** Chemin d'entrée, par exemple un lien d'invitation `/?room=ABCDE`. */
  path?: string;
  /** Profil de navigateur (téléphone, tablette). */
  context?: BrowserContextOptions;
}

export async function openPlayer(
  browser: Browser,
  name: string,
  baseURL: string,
  options: OpenPlayerOptions = {},
): Promise<Player> {
  // Chaque joueur possède son propre contexte : stockage et socket indépendants.
  const context = await browser.newContext({ ...options.context, baseURL });
  const page = await context.newPage();
  await page.goto(options.path ?? "/");
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

/** Dessine un trait sans le valider, une fois l'éditeur affiché. */
export async function drawStroke(player: Player): Promise<void> {
  const canvas = player.page.locator("canvas[aria-label^='Zone de dessin']");
  await canvas.waitFor({ state: "visible" });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Zone de dessin non visible.");
  await player.page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await player.page.mouse.down();
  await player.page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 });
  await player.page.mouse.up();
}

/** Dessine un trait puis valide le dessin. */
export async function drawSimpleStroke(player: Player): Promise<void> {
  await drawStroke(player);
  await player.page.getByRole("button", { name: "Valider le dessin" }).click();
  await player.page.getByRole("dialog").getByRole("button", { name: "Valider mon dessin" }).click();
}

/** La page ne doit pas défiler horizontalement (écrans étroits). */
export async function expectNoHorizontalOverflow(player: Player): Promise<void> {
  const overflow = await player.page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${player.name} : débordement horizontal`).toBeLessThanOrEqual(1);
}

/** Trouve le joueur dont le dessin est présenté : il ne vote pas. */
export async function findAuthor(players: Player[]): Promise<Player> {
  for (;;) {
    for (const player of players) {
      if (await player.page.getByText("Votre dessin est présenté").isVisible()) {
        return player;
      }
    }
    await players[0]?.page.waitForTimeout(200);
  }
}

export async function voteValue(player: Player, value: number): Promise<void> {
  await player.page.getByRole("button", { name: `Choisir ${value} sur 10` }).click();
  await player.page.getByRole("button", { name: "Valider mon estimation" }).click();
  await player.page
    .getByRole("dialog")
    .getByRole("button", { name: "Valider mon estimation" })
    .click();
}

/**
 * Règles WCAG 2.1 A et AA automatisables (base technique du RGAA 4.1) et bonnes pratiques d'axe-core : renvoie une ligne par
 * violation, préfixée par le joueur et l'écran, pour pouvoir toutes les lister d'un coup.
 */
export async function collectAccessibilityFindings(
  player: Player,
  screen: string,
): Promise<string[]> {
  // Les transitions en cours (bouton qui vient d'être activé) donnent des couleurs intermédiaires :
  // on mesure l'état final, comme le ferait un utilisateur après la transition.
  await settleAnimations(player.page);
  const results = await new AxeBuilder({ page: player.page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();

  return results.violations.map(
    (violation) =>
      `${player.name} / ${screen} : ${violation.id} (${violation.impact}), ${violation.nodes.length} élément(s), ex. ${violation.nodes[0]?.target.join(" ")}`,
  );
}

/**
 * Promesse résolue quand le client Socket.IO de la page a terminé sa montée en WebSocket.
 * À appeler avant la navigation. Une page fermée pendant la phase d'interrogation HTTP n'est
 * détectée par le serveur qu'au bout du délai de battement de cœur (jusqu'à 45 s), ce qui rend
 * un scénario de coupure aléatoire : on attend donc la connexion définitive avant de couper.
 */
export function watchSocketUpgrade(page: Page): Promise<void> {
  return new Promise((resolve) => {
    page.on("websocket", (socket) => {
      socket.on("framesent", (frame) => {
        if (frame.payload === "5") resolve();
      });
    });
  });
}
