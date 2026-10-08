import type { SyntheticEvent } from "react";

import "./Mascot.css";

export type MascotCharacter = "pig" | "poop";

export type MascotExpression =
  | "neutral"
  | "angry"
  | "sad"
  | "happy"
  | "surprised"
  | "confused"
  | "jump"
  | "hide"
  | "dance"
  | "formal"
  | "fly";

export interface MascotProps {
  character: MascotCharacter;
  expression: MascotExpression;
  size?: "xs" | "sm" | "md" | "lg";
  decorative?: boolean;
  alt?: string;
  className?: string;
}

const expressionFileNames: Record<MascotExpression, string> = {
  neutral: "neutral",
  angry: "angry",
  sad: "sad",
  happy: "happy",
  surprised: "surprised",
  confused: "confused",
  jump: "jump",
  hide: "hidden",
  dance: "dance",
  formal: "formal",
  fly: "fly",
};

const expressionLabels: Record<MascotExpression, string> = {
  neutral: "neutre",
  angry: "en colère",
  sad: "triste",
  happy: "heureux",
  surprised: "surpris",
  confused: "perplexe",
  jump: "qui saute",
  hide: "qui se cache",
  dance: "qui danse",
  formal: "en tenue de cérémonie",
  fly: "qui vole",
};

export function getMascotSource(character: MascotCharacter, expression: MascotExpression) {
  return `/mascots/${character}/${expressionFileNames[expression]}.png`;
}

function getDefaultAlt(character: MascotCharacter, expression: MascotExpression) {
  const characterLabel = character === "pig" ? "Cochon" : "Caca";
  return `${characterLabel} ${expressionLabels[expression]}`;
}

export function Mascot({
  character,
  expression,
  size = "md",
  decorative = false,
  alt,
  className,
}: MascotProps) {
  const fallbackSource = getMascotSource(character, "neutral");
  const handleLoadError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;

    if (image.dataset.fallbackApplied === "true") {
      image.hidden = true;
      return;
    }

    image.dataset.fallbackApplied = "true";
    image.src = fallbackSource;
  };

  return (
    <img
      className={`mascot mascot--${size}${className === undefined ? "" : ` ${className}`}`}
      src={getMascotSource(character, expression)}
      alt={decorative ? "" : (alt ?? getDefaultAlt(character, expression))}
      aria-hidden={decorative ? true : undefined}
      data-character={character}
      data-expression={expression}
      draggable={false}
      onError={handleLoadError}
    />
  );
}
