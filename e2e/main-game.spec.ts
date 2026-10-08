import { expect, test, type ConsoleMessage } from "@playwright/test";

import {
  createRoom,
  drawSimpleStroke,
  findDrawer,
  joinRoom,
  openPlayer,
  type Player,
  voteValue,
} from "./helpers";

const TURNS = 6;

/**
 * Parcours principal : salon à trois joueurs, deux manches complètes,
 * restauration d'un votant après actualisation, classement, revanche et départ.
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
    for (let turn = 1; turn <= TURNS; turn += 1) {
      const drawer = await findDrawer(players);
      const [firstVoter, secondVoter] = players.filter((player) => player !== drawer);
      if (!firstVoter || !secondVoter) throw new Error("Deux votants attendus.");

      await drawSimpleStroke(drawer);
      await expect(firstVoter.page.getByRole("button", { name: "Choisir 5 sur 10" })).toBeVisible();

      if (turn === 1) {
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
      const continueLabel = turn === TURNS ? "Voir le classement final" : "Lancer le prochain tour";
      await alice.page.getByRole("button", { name: continueLabel }).click();
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
