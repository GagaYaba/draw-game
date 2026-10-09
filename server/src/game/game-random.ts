import { randomInt } from "node:crypto";

import type { DrawingPrompt } from "./game-types.js";

export type RandomSource = () => number;

const SECURE_RANDOM_RESOLUTION = 2 ** 32;

/**
 * Source aléatoire cryptographique : les niveaux secrets et l'ordre des dessins ne doivent pas
 * pouvoir être déduits des valeurs déjà révélées (Math.random est prévisible).
 */
export const secureRandom: RandomSource = () =>
  randomInt(SECURE_RANDOM_RESOLUTION) / SECURE_RANDOM_RESOLUTION;

function getRandomIndex(length: number, random: RandomSource): number {
  const value = random();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("La source aléatoire doit produire une valeur entre 0 inclus et 1 exclu.");
  }

  return Math.floor(value * length);
}

export function shufflePlayerIds(
  playerIds: readonly string[],
  random: RandomSource = secureRandom,
): string[] {
  const shuffled = [...playerIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = getRandomIndex(index + 1, random);
    const current = shuffled[index];
    shuffled[index] = shuffled[otherIndex] as string;
    shuffled[otherIndex] = current as string;
  }

  return shuffled;
}

export function selectDrawingPrompt(
  prompts: readonly DrawingPrompt[],
  random: RandomSource = secureRandom,
): DrawingPrompt {
  if (prompts.length === 0) {
    throw new RangeError("La banque de consignes ne peut pas être vide.");
  }

  const prompt = prompts[getRandomIndex(prompts.length, random)];

  if (prompt === undefined) {
    throw new RangeError("Impossible de sélectionner une consigne.");
  }

  return prompt;
}

export function generateSecretLevel(random: RandomSource = secureRandom): number {
  return getRandomIndex(10, random) + 1;
}
