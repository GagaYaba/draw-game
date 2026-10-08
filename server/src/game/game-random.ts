import type { DrawingPrompt } from "./game-types.js";

export type RandomSource = () => number;

function getRandomIndex(length: number, random: RandomSource): number {
  const value = random();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("La source aléatoire doit produire une valeur entre 0 inclus et 1 exclu.");
  }

  return Math.floor(value * length);
}

export function shufflePlayerIds(
  playerIds: readonly string[],
  random: RandomSource = Math.random,
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
  random: RandomSource = Math.random,
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

export function generateSecretLevel(random: RandomSource = Math.random): number {
  return getRandomIndex(10, random) + 1;
}
