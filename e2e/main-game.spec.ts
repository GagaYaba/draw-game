import { type ConsoleMessage, expect, test } from "@playwright/test";

import {
  createRoom,
  drawSimpleStroke,
  findAuthor,
  joinRoom,
  openPlayer,
  type Player,
  voteValue,
} from "./helpers";

const ROUNDS = 2;

/**
 * Parcours principal : salon à trois joueurs, deux manches où tout le monde dessine
 * en même temps, dessins présentés un par un, restauration d'un votant après
 * actualisation, classement, revanche et départ.
 */
test("une partie complète à trois joueurs, avec restauration et revanche", async ({
  browser,
  baseURL,
}) => {
  const errors: string[] = [];
  const watch = (player: Player) => {
    player.page.on("pageerror", (error) => errors.push(`${player.name}: ${error.message}`));
    player.page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") errors.push(`${player.name}: ${message.text()}`);
    });
  };

  if (!baseURL) throw new Error("baseURL absent de la configuration.");
  const alice = await openPlayer(browser, "Alice", baseURL);
  const bob = await openPlayer(browser, "Bob", baseURL);
  const chloe = await openPlayer(browser, "Chloe", baseURL);
  const players = [alice, bob, chloe];
  players.forEach(watch);

  try {
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    await joinRoom(chloe, code);
    for (const player of players) {
      for (const other of players.filter((candidate) => candidate !== player)) {
        await expect(player.page.getByText(other.name, { exact: true }).first()).toBeVisible();
      }
    }

    for (const player of players) {
      await player.page.getByRole("button", { name: "Je suis prêt" }).click();
    }
    await expect(alice.page.getByRole("button", { name: "Lancer la partie" })).toBeEnabled();
    await alice.page.getByRole("button", { name: "Lancer la partie" }).click();

    let restoredVoter = false;
    for (let round = 1; round <= ROUNDS; round += 1) {
      // Tout le monde dessine en même temps : Alice valide la première et attend les autres.
      await drawSimpleStroke(alice);
      await expect(alice.page.getByText("En attente des autres joueurs.")).toBeVisible();
      await expect(bob.page.getByRole("button", { name: "Valider le dessin" })).toBeVisible();
      await drawSimpleStroke(bob);
      await expect(alice.page.getByText("Encore en train de dessiner : Chloe.")).toBeVisible();
      await drawSimpleStroke(chloe);

      // Les trois dessins sont ensuite présentés un par un.
      for (let drawing = 1; drawing <= players.length; drawing += 1) {
        const author = await findAuthor(players);
        const [firstVoter, secondVoter] = players.filter((player) => player !== author);
        if (!firstVoter || !secondVoter) throw new Error("Deux votants attendus.");

        await expect(
          firstVoter.page.getByRole("button", { name: "Choisir 5 sur 10" }),
        ).toBeVisible();

        if (round === 1 && drawing === 1) {
          // Le votant est actualisé pendant son estimation : la session doit être restaurée.
          await firstVoter.page.reload();
          await expect(
            firstVoter.page.getByRole("button", { name: "Choisir 5 sur 10" }),
          ).toBeVisible();
          restoredVoter = true;
        }

        await voteValue(firstVoter, 4);
        await voteValue(secondVoter, 7);

        await expect(alice.page.getByText("Estimations validées").first()).toBeVisible();
        const continueLabel =
          drawing < players.length
            ? "Dessin suivant"
            : round < ROUNDS
              ? "Manche suivante"
              : "Voir le classement final";
        await alice.page.getByRole("button", { name: continueLabel }).click();
      }
    }

    expect(restoredVoter).toBe(true);
    await expect(alice.page.getByRole("button", { name: "Proposer une revanche" })).toBeVisible();

    await alice.page.getByRole("button", { name: "Proposer une revanche" }).click();
    for (const player of players) {
      await expect(player.page.getByRole("heading", { name: "Votre lobby" })).toBeVisible();
    }

    await chloe.page.getByRole("button", { name: "Quitter la partie" }).click();
    await expect(
      chloe.page.getByRole("heading", { name: "Rejoignez la table de jeu" }),
    ).toBeVisible();
    await expect(alice.page.getByText("Chloe", { exact: true })).toHaveCount(0);
  } finally {
    expect(errors, "Aucune erreur navigateur ou console attendue").toEqual([]);
  }
});
