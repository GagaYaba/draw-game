import type { ReactNode } from "react";

interface GamePromptHeaderProps {
  statement: string;
  gauge: ReactNode;
  gaugePrompt?: ReactNode;
  valueText?: ReactNode;
}

export function GamePromptHeader({
  statement,
  gauge,
  gaugePrompt,
  valueText,
}: GamePromptHeaderProps) {
  return (
    <header
      className={`game-prompt-header${gaugePrompt === undefined ? "" : " game-prompt-header--with-question"}${valueText === undefined ? "" : " game-prompt-header--with-value"}`}
    >
      <div className="game-prompt-header__statement">
        <h2 className="card-label">Consigne</h2>
        <p className="game-prompt-text">{statement}</p>
      </div>
      {gaugePrompt !== undefined && (
        <div className="game-prompt-header__question">{gaugePrompt}</div>
      )}
      <div className="game-prompt-header__gauge">{gauge}</div>
      {valueText !== undefined && <div className="game-prompt-header__value">{valueText}</div>}
    </header>
  );
}

interface GamePromptValueProps {
  label: string;
  value: number;
  separator?: string;
}

export function GamePromptValue({ label, value, separator = " :" }: GamePromptValueProps) {
  return (
    <p
      className="scale-gauge__value-text game-prompt-value"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>
        {label}
        {separator}
      </span>
      <strong>{value}</strong>
      <span>/ 10</span>
    </p>
  );
}
