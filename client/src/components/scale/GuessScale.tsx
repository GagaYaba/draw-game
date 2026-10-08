import type { CSSProperties } from "react";

import { Mascot } from "../Mascot";
import {
  getScaleGaugeMarkerPosition,
  isScaleGaugeValue,
  SCALE_GAUGE_LEVELS,
} from "./scale-gauge.js";
import "./ScaleGauge.css";
import "./GuessScale.css";

export interface GuessScaleProps {
  lowLabel: string;
  highLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  size?: "full" | "compact";
  showValueText?: boolean;
  valueTextLabel?: string;
}

export function GuessScale({
  lowLabel,
  highLabel,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  size = "full",
  showValueText = true,
  valueTextLabel = "Votre estimation",
}: GuessScaleProps) {
  const validValue = isScaleGaugeValue(value) ? value : null;
  const markerPosition = getScaleGaugeMarkerPosition(validValue);
  const markerStyle =
    markerPosition === null
      ? undefined
      : ({
          "--scale-gauge-marker-position": `${markerPosition}%`,
        } as CSSProperties);
  const accessibleLabel =
    ariaLabel ?? `Choisissez une estimation de 1 à 10, de ${lowLabel} à ${highLabel}.`;
  const options = SCALE_GAUGE_LEVELS.map((level) => {
    const isSelected = validValue === level;

    return (
      <button
        className="scale-gauge__segment guess-scale__option"
        type="button"
        key={level}
        aria-label={`Choisir ${level} sur 10`}
        aria-pressed={isSelected}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            onChange(level);
          }
        }}
      >
        <span className="guess-scale__level" aria-hidden="true">
          {level}
        </span>
      </button>
    );
  });

  return (
    <div
      className={
        disabled
          ? `scale-gauge guess-scale guess-scale--${size} guess-scale--disabled`
          : `scale-gauge guess-scale guess-scale--${size}`
      }
      role="group"
      aria-label={accessibleLabel}
      aria-disabled={disabled}
    >
      <div className="scale-gauge__endpoint-layout">
        <Mascot
          character="poop"
          expression="neutral"
          size={size === "compact" ? "xs" : "sm"}
          decorative
          className="scale-gauge__mascot scale-gauge__mascot--low"
        />
        <div className="scale-gauge__core">
          <div className="scale-gauge__labels" aria-hidden="true">
            <span>{lowLabel}</span>
            <span>{highLabel}</span>
          </div>

          {size === "compact" ? (
            <>
              <div
                className={
                  markerPosition === null
                    ? "scale-gauge__track-wrap guess-scale__track-wrap"
                    : "scale-gauge__track-wrap scale-gauge__track-wrap--with-marker guess-scale__track-wrap"
                }
                style={markerStyle}
              >
                {markerPosition !== null && (
                  <span className="scale-gauge__marker" aria-hidden="true" />
                )}
                <div className="scale-gauge__track guess-scale__visual-track" aria-hidden="true">
                  {SCALE_GAUGE_LEVELS.map((level) => (
                    <span className="scale-gauge__segment" key={level} />
                  ))}
                </div>
              </div>
              <div className="guess-scale__option-grid">{options}</div>
            </>
          ) : (
            <div
              className={
                markerPosition === null
                  ? "scale-gauge__track-wrap guess-scale__track-wrap guess-scale__full-control"
                  : "scale-gauge__track-wrap scale-gauge__track-wrap--with-marker guess-scale__track-wrap guess-scale__full-control"
              }
              style={markerStyle}
            >
              {markerPosition !== null && (
                <span className="scale-gauge__marker" aria-hidden="true" />
              )}
              <div
                className="scale-gauge__track guess-scale__visual-track guess-scale__full-visual"
                aria-hidden="true"
              >
                {SCALE_GAUGE_LEVELS.map((level) => (
                  <span className="scale-gauge__segment" key={level} />
                ))}
              </div>
              <div className="scale-gauge__track guess-scale__track guess-scale__full-options">
                {options}
              </div>
            </div>
          )}

          {showValueText && validValue !== null && (
            <p
              className="scale-gauge__value-text guess-scale__value-text"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span>{valueTextLabel} :</span>
              <strong>{validValue}</strong>
              <span>/ 10</span>
            </p>
          )}
        </div>
        <Mascot
          character="pig"
          expression="neutral"
          size={size === "compact" ? "xs" : "sm"}
          decorative
          className="scale-gauge__mascot scale-gauge__mascot--high"
        />
      </div>
    </div>
  );
}
