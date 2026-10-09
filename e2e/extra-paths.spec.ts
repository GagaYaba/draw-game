import { type ConsoleMessage, devices, expect, test } from "@playwright/test";

import {
  createRoom,
  drawSimpleStroke,
  drawStroke,
  expectNoHorizontalOverflow,
  findAuthor,
  joinRoom,
  openPlayer,
  type Player,
  voteValue,
} from "./helpers";

function collectErrors(players: Player[]): string[] {
  const errors: string[] = [];
  for (const player of players) {
    player.page.on("pageerror", (error) => errors.push(`${player.name}: ${error.message}`));
    player.page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") errors.push(`${player.name}: ${message.text()}`);
    });
  }
  return errors;
}

// Risque : un joueur qui se trompe de pseudonyme ou de code reste bloqué sans comprendre pourquoi.
test("entre par un lien d'invitation et comprend ses erreurs de saisie", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL absent de la configuration.");
  const alice = await openPlayer(browser, "Alice", baseURL);
  const code = await createRoom(alice);

  const bob = await openPlayer(browser, "Bob", baseURL, { path: `/?room=${code}` });
  try {
    await expect(bob.page.getByLabel("Code de la partie")).toHaveValue(code);

    await bob.page.getByLabel("Pseudonyme").fill("B");
    await bob.page.getByRole("button", { name: "Rejoindre la partie" }).click();
    await expect(
      bob.page.getByText("Le pseudonyme doit contenir entre 2 et 20 caractères."),
    ).toBeVisible();

    await bob.page.getByLabel("Pseudonyme").fill("Bob");
    await bob.page.getByLabel("Code de la partie").fill("ZZZZZ");
    await bob.page.getByRole("button", { name: "Rejoindre la partie" }).click();
    await expect(bob.page.getByText("Aucun salon ne correspond à ce code.")).toBeVisible();

    await joinRoom(bob, code);
    await expect(alice.page.getByText("Bob", { exact: true }).first()).toBeVisible();
  } finally {
    await alice.context.close();
    await bob.context.close();
  }
});

// Risque : le jeu doit rester jouable sur un téléphone, avec le minimum de joueurs (deux).
test("joue une partie à deux joueurs sur téléphone sans débordement horizontal", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL absent de la configuration.");
  const phone = { context: devices["Pixel 7"] };
  const alice = await openPlayer(browser, "Alice", baseURL, phone);
  const bob = await openPlayer(browser, "Bob", baseURL, phone);
  const players = [alice, bob];
  const errors = collectErrors(players);

  try {
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    for (const player of players) {
      await player.page.getByRole("button", { name: "Je suis prêt" }).click();
      await expectNoHorizontalOverflow(player);
    }
    await alice.page.getByRole("button", { name: "Lancer la partie" }).click();

    for (let round = 1; round <= 2; round += 1) {
      await drawSimpleStroke(alice);
      await expectNoHorizontalOverflow(alice);
      await drawSimpleStroke(bob);

      for (let drawing = 1; drawing <= 2; drawing += 1) {
        const author = await findAuthor(players);
        const voter = players.find((player) => player !== author);
        if (!voter) throw new Error("Un votant est attendu.");

        await expectNoHorizontalOverflow(voter);
        await voteValue(voter, 6);
        await expect(alice.page.getByText("Estimations validées").first()).toBeVisible();
        await expectNoHorizontalOverflow(alice);

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
    await expectNoHorizontalOverflow(bob);
  } finally {
    expect(errors, "Aucune erreur navigateur ou console attendue").toEqual([]);
    await alice.context.close();
    await bob.context.close();
  }
});

// Risque : une coupure en plein dessin fait perdre le travail du joueur ou bloque le groupe.
test("conserve le dessin en cours après actualisation, reprend après une coupure puis annule à l'expiration", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL absent de la configuration.");
  const alice = await openPlayer(browser, "Alice", baseURL);
  const bob = await openPlayer(browser, "Bob", baseURL);

  try {
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    for (const player of [alice, bob]) {
      await player.page.getByRole("button", { name: "Je suis prêt" }).click();
    }
    await alice.page.getByRole("button", { name: "Lancer la partie" }).click();

    // Un dessin vide ne peut pas être validé ; un trait non validé survit à l'actualisation.
    const validate = bob.page.getByRole("button", { name: "Valider le dessin" });
    await expect(validate).toBeDisabled();
    await drawStroke(bob);
    await expect(validate).toBeEnabled();
    await bob.page.reload();
    await expect(bob.page.getByRole("button", { name: "Valider le dessin" })).toBeEnabled();
    await expect(alice.page.getByText("Reconnexion…")).toHaveCount(0);

    // Bob ferme son onglet : le groupe voit la reconnexion, puis Bob reprend sa place.
    await bob.page.close();
    await expect(alice.page.getByText("Reconnexion…").first()).toBeVisible();
    const returning = await bob.context.newPage();
    await returning.goto("/");
    await expect(returning.getByRole("button", { name: "Valider le dessin" })).toBeVisible();
    await expect(alice.page.getByText("Reconnexion…")).toHaveCount(0);

    // Bob disparaît plus longtemps que le délai de reconnexion : la partie est annulée.
    await returning.close();
    await expect(alice.page.getByText(/partie a été annulée/)).toBeVisible({ timeout: 20_000 });
    await expect(alice.page.getByRole("heading", { name: "Votre lobby" })).toBeVisible();
  } finally {
    await alice.context.close();
    await bob.context.close();
  }
});
