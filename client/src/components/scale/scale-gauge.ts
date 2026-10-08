export const SCALE_GAUGE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const SCALE_GAUGE_MIN = 1;
const SCALE_GAUGE_MAX = 10;

export function isScaleGaugeValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= SCALE_GAUGE_MIN &&
    value <= SCALE_GAUGE_MAX
  );
}

export function getScaleGaugeMarkerPosition(value: unknown): number | null {
  if (!isScaleGaugeValue(value)) {
    return null;
  }

  return ((value - 0.5) / SCALE_GAUGE_LEVELS.length) * 100;
}
