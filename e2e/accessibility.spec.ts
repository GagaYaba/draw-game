import { expect, test } from "@playwright/test";

import { collectContrastFindings } from "./contrast";
import {
  collectAccessibilityFindings,
  createRoom,
  drawStroke,
  expectNoHorizontalOverflow,
  findAuthor,
  joinRoom,
  openPlayer,
  type Player,
  voteValue,
} from "./helpers";

// Risque : un écran inutilisable avec une aide technique ou un zoom fort exclut des joueurs.
// Ce test applique les règles WCAG 2.1 A et AA automatisables (base du RGAA 4.1) à chaque écran,
// avec un joueur sur une fenêtre de 320 pixels de large (critère de réflexion du contenu).
test("respecte les règles WCAG 2.1 AA automatisables sur chaque écran, sans défilement horizontal à 320 px", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL absent de la configuration.");
  // Contrôles d'axe-core et de contraste (captures) sur une douzaine d'écrans : plus long que la limite par défaut.
  test.setTimeout(300_000);
  const alice = await openPlayer(browser, "Alice", baseURL, {
    context: { viewport: { width: 320, height: 640 } },
  });
  const bob = await openPlayer(browser, "Bob", baseURL);
  const players = [alice, bob];
  const findings: string[] = [];
  const check = async (player: Player, screen: string) => {
    const viewport = player === alice ? "320 px" : "bureau";
    findings.push(...(await collectAccessibilityFindings(player, `${screen} (${viewport})`)));
    findings.push(...(await collectContrastFindings(player.page, `${screen} (${viewport})`)));
    await expectNoHorizontalOverflow(player);
  };

  try {
    await check(alice, "accueil");
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    await check(alice, "salon");
    await check(bob, "salon");

    for (const player of players) {
      await player.page.getByRole("button", { name: "Je suis prêt" }).click();
    }
    await alice.page.getByRole("button", { name: "Lancer la partie" }).click();

    for (let round = 1; round <= 2; round += 1) {
      await drawStroke(alice);
      if (round === 1) {
        await check(alice, "dessin");
        await alice.page.getByRole("button", { name: "Valider le dessin" }).click();
        await check(alice, "confirmation du dessin");
        await alice.page
          .getByRole("dialog")
          .getByRole("button", { name: "Valider mon dessin" })
          .click();
        await expect(alice.page.getByText("En attente des autres joueurs.")).toBeVisible();
        await check(alice, "attente des autres joueurs");
      } else {
        await alice.page.getByRole("button", { name: "Valider le dessin" }).click();
        await alice.page
          .getByRole("dialog")
          .getByRole("button", { name: "Valider mon dessin" })
          .click();
      }
      await drawStroke(bob);
      await bob.page.getByRole("button", { name: "Valider le dessin" }).click();
      await bob.page
        .getByRole("dialog")
        .getByRole("button", { name: "Valider mon dessin" })
        .click();

      for (let drawing = 1; drawing <= 2; drawing += 1) {
        const author = await findAuthor(players);
        const voter = players.find((player) => player !== author);
        if (!voter) throw new Error("Un votant est attendu.");

        if (round === 1 && drawing === 1) {
          await check(voter, "vote");
          await check(author, "vote (auteur)");
        }
        await voteValue(voter, 6);
        await expect(alice.page.getByText("Estimations validées").first()).toBeVisible();
        if (round === 1 && drawing === 1) {
          await check(alice, "révélation");
          await check(bob, "révélation");
        }

        const label =
          drawing < 2
            ? "Dessin suivant"
            : round < 2
              ? "Manche suivante"
              : "Voir le classement final";
        await alice.page.getByRole("button", { name: label }).click();
      }
    }

    await expect(alice.page.getByRole("button", { name: "Proposer une revanche" })).toBeVisible();
    await check(alice, "classement final");
    await check(bob, "classement final");
  } finally {
    await alice.context.close();
    await bob.context.close();
  }

  expect(findings, "Violations WCAG 2.1 A/AA détectées").toEqual([]);
});

interface FocusInfo {
  name: string;
  hasFocusIndicator: boolean;
}

/** Appuie sur Tab jusqu'à atteindre un contrôle dont le nom correspond, et relève son indicateur de focus. */
async function tabTo(player: Player, name: RegExp, maxTabs = 25): Promise<FocusInfo> {
  for (let tab = 0; tab < maxTabs; tab += 1) {
    await player.page.keyboard.press("Tab");
    const info = await player.page.evaluate((): FocusInfo => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return { name: "", hasFocusIndicator: false };
      const style = getComputedStyle(element);
      const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none";
      const label =
        element.getAttribute("aria-label") ??
        element.labels?.[0]?.textContent ??
        element.textContent ??
        "";
      return { name: label.trim(), hasFocusIndicator: outline || shadow };
    });
    if (name.test(info.name)) return info;
  }
  throw new Error(`Contrôle « ${name} » inaccessible au clavier après ${maxTabs} tabulations.`);
}

// Risque : un joueur qui n'utilise pas la souris ne peut pas créer ni préparer une partie.
test("permet de créer un salon et de se déclarer prêt au clavier, avec un focus visible", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL absent de la configuration.");
  const alice = await openPlayer(browser, "Alice", baseURL);

  try {
    const nickname = await tabTo(alice, /Pseudonyme/);
    expect(nickname.hasFocusIndicator, "focus visible sur le pseudonyme").toBe(true);
    await alice.page.keyboard.type("Alice");

    const create = await tabTo(alice, /Créer une partie/);
    expect(create.hasFocusIndicator, "focus visible sur « Créer une partie »").toBe(true);
    await alice.page.keyboard.press("Enter");
    await expect(alice.page.getByRole("heading", { name: "Votre lobby" })).toBeVisible();

    const ready = await tabTo(alice, /Je suis prêt/);
    expect(ready.hasFocusIndicator, "focus visible sur « Je suis prêt »").toBe(true);
    await alice.page.keyboard.press("Enter");
    await expect(alice.page.getByRole("button", { name: "Je ne suis plus prêt" })).toBeVisible();
  } finally {
    await alice.context.close();
  }
});
