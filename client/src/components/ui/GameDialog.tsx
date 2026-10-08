import { useEffect, useId, useRef, type ReactNode } from "react";

import { Mascot, type MascotCharacter, type MascotExpression } from "../Mascot";

import "./GameDialog.css";

const FOCUSABLE_ELEMENT_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface GameDialogMascot {
  character: MascotCharacter;
  expression: MascotExpression;
}

export interface GameDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  value?: ReactNode;
  mascot?: GameDialogMascot;
  tone?: "default" | "danger";
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}

export function GameDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  value,
  mascot,
  tone = "default",
  isBusy = false,
  onConfirm,
  onCancel,
}: GameDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const valueId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const fallbackFocusTargetRef = useRef<HTMLElement | null>(null);
  const isBusyRef = useRef(isBusy);
  const onCancelRef = useRef(onCancel);

  isBusyRef.current = isBusy;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    fallbackFocusTargetRef.current =
      previouslyFocusedElementRef.current?.closest<HTMLElement>(".game-phase-layout") ??
      document.querySelector<HTMLElement>(".game-phase-layout");

    const focusFrame = window.requestAnimationFrame(() => {
      const cancelButton = cancelButtonRef.current;
      if (cancelButton !== null && !cancelButton.disabled) {
        cancelButton.focus();
      } else {
        dialogRef.current?.focus();
      }
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isBusyRef.current) {
          event.preventDefault();
          onCancelRef.current();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (dialog === null) {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (
        event.shiftKey &&
        (activeElement === firstElement ||
          !focusableElements.includes(activeElement as HTMLElement))
      ) {
        event.preventDefault();
        lastElement?.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !focusableElements.includes(activeElement as HTMLElement))
      ) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);

      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      const fallbackFocusTarget = fallbackFocusTargetRef.current;
      previouslyFocusedElementRef.current = null;
      fallbackFocusTargetRef.current = null;
      const canRestorePreviousFocus =
        previouslyFocusedElement?.isConnected === true &&
        !previouslyFocusedElement.matches(":disabled") &&
        previouslyFocusedElement.getAttribute("aria-disabled") !== "true";

      if (canRestorePreviousFocus) {
        previouslyFocusedElement.focus();
      } else if (fallbackFocusTarget?.isConnected) {
        fallbackFocusTarget.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (open && isBusy) {
      dialogRef.current?.focus();
    }
  }, [isBusy, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="game-dialog-overlay">
      <section
        ref={dialogRef}
        className={`game-dialog-card game-dialog-card--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={value === undefined ? descriptionId : `${descriptionId} ${valueId}`}
        aria-busy={isBusy}
        tabIndex={-1}
      >
        {mascot !== undefined && (
          <div className="game-dialog__mascot-tile" aria-hidden="true">
            <Mascot
              character={mascot.character}
              expression={mascot.expression}
              size="md"
              decorative
              className="game-dialog__mascot"
            />
          </div>
        )}

        <div className="game-dialog__content">
          <p className="game-dialog__eyebrow">Confirmation</p>
          <h2 id={titleId}>{title}</h2>
          <div id={descriptionId} className="game-dialog__description">
            {description}
          </div>

          {value !== undefined && (
            <div id={valueId} className="game-dialog__value">
              {value}
            </div>
          )}

          <div className="game-dialog__actions">
            <button
              ref={cancelButtonRef}
              className="button button--secondary"
              type="button"
              disabled={isBusy}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={isBusy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
