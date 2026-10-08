import type { DrawingPoint } from "@drawing-game/shared";

export const MIN_DRAWING_POINT_DISTANCE = 0.0025;

export interface ClientPointerPosition {
  clientX: number;
  clientY: number;
}

export interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clampNormalizedCoordinate(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizePointerPosition(
  position: ClientPointerPosition,
  bounds: CanvasBounds,
): DrawingPoint {
  if (
    !Number.isFinite(position.clientX) ||
    !Number.isFinite(position.clientY) ||
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new RangeError("La position du pointeur ne peut pas être normalisée.");
  }

  return {
    x: clampNormalizedCoordinate((position.clientX - bounds.left) / bounds.width),
    y: clampNormalizedCoordinate((position.clientY - bounds.top) / bounds.height),
  };
}

export function distanceBetweenPoints(firstPoint: DrawingPoint, secondPoint: DrawingPoint): number {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

export function shouldAddPoint(
  previousPoint: DrawingPoint,
  nextPoint: DrawingPoint,
  minimumDistance = MIN_DRAWING_POINT_DISTANCE,
): boolean {
  return distanceBetweenPoints(previousPoint, nextPoint) >= minimumDistance;
}
