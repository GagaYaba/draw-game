import type { ReactNode } from "react";

interface GamePhaseLayoutProps {
  ariaLabel: string;
  prompt: ReactNode;
  children: ReactNode;
  className?: string;
  isBusy?: boolean;
}

export function GamePhaseLayout({
  ariaLabel,
  prompt,
  children,
  className,
  isBusy = false,
}: GamePhaseLayoutProps) {
  return (
    <section
      className={`game-card game-phase game-phase-layout${className === undefined ? "" : ` ${className}`}`}
      aria-label={ariaLabel}
      aria-busy={isBusy}
      tabIndex={-1}
    >
      {prompt}
      <div className="game-phase-layout__body">{children}</div>
    </section>
  );
}
