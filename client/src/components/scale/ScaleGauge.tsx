import type { CSSProperties } from "react";

import { Mascot } from "../Mascot";
import {
  getScaleGaugeMarkerPosition,
  isScaleGaugeValue,
  SCALE_GAUGE_LEVELS,
} from "./scale-gauge.js";
import "./ScaleGauge.css";

export interface ScaleGaugeProps {
  lowLabel: string;
  highLabel: string;
  value?: number | null;
  showValueText?: boolean;
  valueTextLabel?: string;
  size?: "full" | "compact";
  ariaLabel?: string;
  reserveMarkerSpace?: boolean;
}

export function ScaleGauge({
  lowLabel,
  highLabel,
  value,
  showValueText = false,
  valueTextLabel = "Niveau secret",
  size = "full",
  ariaLabel,
  reserveMarkerSpace = false,
}: ScaleGaugeProps) {
  const validValue = isScaleGaugeValue(value) ? value : null;
  const markerPosition = getScaleGaugeMarkerPosition(validValue);
  const accessibleValueLabel =
    valueTextLabel === "Niveau secret" ? "Niveau secret actuel" : valueTextLabel;
  const accessibleLabel =
    ariaLabel ??
    `Échelle de ${lowLabel}, niveau 1, à ${highLabel}, niveau 10. ${
      validValue === null
        ? "Le niveau est secret."
        : `${accessibleValueLabel} : ${validValue} sur 10.`
    }`;
  const markerStyle =
    markerPosition === null
      ? undefined
      : ({
          "--scale-gauge-marker-position": `${markerPosition}%`,
        } as CSSProperties);

  return (
    <div className={`scale-gauge scale-gauge--${size}`} role="img" aria-label={accessibleLabel}>
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

          <div
            className={
              markerPosition === null && !reserveMarkerSpace
                ? "scale-gauge__track-wrap"
                : "scale-gauge__track-wrap scale-gauge__track-wrap--with-marker"
            }
            style={markerStyle}
          >
            {markerPosition !== null && <span className="scale-gauge__marker" aria-hidden="true" />}

            <div className="scale-gauge__track" aria-hidden="true">
              {SCALE_GAUGE_LEVELS.map((level) => (
                <span className="scale-gauge__segment" key={level} />
              ))}
            </div>
          </div>

          <ol className="scale-gauge__ticks" aria-hidden="true">
            {SCALE_GAUGE_LEVELS.map((level) => (
              <li key={level}>{level}</li>
            ))}
          </ol>

          {showValueText && validValue !== null && (
            <p className="scale-gauge__value-text" aria-hidden="true">
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
