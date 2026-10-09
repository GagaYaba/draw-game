import type { DrawingDocument, DrawingStroke } from "@drawing-game/shared";

import { renderBucketFill } from "./drawing-fill";

export const DRAWING_REFERENCE_WIDTH = 1_200;
export const DRAWING_REFERENCE_HEIGHT = 900;

export interface CanvasDisplayMetrics {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  backingWidth: number;
  backingHeight: number;
  devicePixelRatio: number;
  resized: boolean;
}

export interface DrawingRenderCacheState {
  width: number;
  height: number;
  backingWidth: number;
  backingHeight: number;
  devicePixelRatio: number;
  backgroundColor: string;
  strokeFingerprints: readonly string[];
}

export interface DrawingRenderCacheUpdate {
  state: DrawingRenderCacheState;
  strategy: "full" | "append" | "unchanged";
}

export function getDrawingReferenceMetrics(
  context: CanvasRenderingContext2D,
): CanvasDisplayMetrics {
  return {
    context,
    width: DRAWING_REFERENCE_WIDTH,
    height: DRAWING_REFERENCE_HEIGHT,
    backingWidth: DRAWING_REFERENCE_WIDTH,
    backingHeight: DRAWING_REFERENCE_HEIGHT,
    devicePixelRatio: 1,
    resized:
      context.canvas.width !== DRAWING_REFERENCE_WIDTH ||
      context.canvas.height !== DRAWING_REFERENCE_HEIGHT,
  };
}

function getScaledStrokeWidth(stroke: DrawingStroke, width: number, height: number): number {
  const displayScale = Math.min(width / DRAWING_REFERENCE_WIDTH, height / DRAWING_REFERENCE_HEIGHT);
  return stroke.width * displayScale;
}

export function renderDrawingStroke(
  context: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  width: number,
  height: number,
  backgroundColor: string,
): void {
  const [firstPoint, ...remainingPoints] = stroke.points;

  if (firstPoint === undefined || width <= 0 || height <= 0) {
    return;
  }

  if (stroke.tool === "fill") {
    renderBucketFill(context, firstPoint, stroke.color);
    return;
  }

  const color = stroke.tool === "eraser" ? backgroundColor : stroke.color;
  const lineWidth = getScaledStrokeWidth(stroke, width, height);
  const firstX = firstPoint.x * width;
  const firstY = firstPoint.y * height;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = lineWidth;
  context.strokeStyle = color;
  context.fillStyle = color;

  if (remainingPoints.length === 0) {
    context.beginPath();
    context.arc(firstX, firstY, lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(firstX, firstY);
  for (const point of remainingPoints) {
    context.lineTo(point.x * width, point.y * height);
  }
  context.stroke();
  context.restore();
}

export function renderDrawingDocument(
  context: CanvasRenderingContext2D,
  drawing: DrawingDocument,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = drawing.backgroundColor;
  context.fillRect(0, 0, width, height);

  for (const stroke of drawing.strokes) {
    renderDrawingStroke(context, stroke, width, height, drawing.backgroundColor);
  }
}

function fingerprintDrawingStroke(stroke: DrawingStroke): string {
  return JSON.stringify([
    stroke.tool,
    stroke.color,
    stroke.width,
    stroke.points.map((point) => [point.x, point.y]),
  ]);
}

function cacheMatchesSurface(
  state: DrawingRenderCacheState,
  metrics: CanvasDisplayMetrics,
): boolean {
  return (
    state.width === metrics.width &&
    state.height === metrics.height &&
    state.backingWidth === metrics.backingWidth &&
    state.backingHeight === metrics.backingHeight &&
    state.devicePixelRatio === metrics.devicePixelRatio
  );
}

/**
 * Synchronizes a persistent backing canvas with a drawing document.
 *
 * Appended operations are rendered incrementally. Undo, clear, an edited
 * prefix, a background change, a DPR change, or a real resize rebuilds the
 * backing canvas so its pixels always match a canonical full replay.
 */
export function updateDrawingRenderCache(
  context: CanvasRenderingContext2D,
  drawing: DrawingDocument,
  metrics: CanvasDisplayMetrics,
  previousState: DrawingRenderCacheState | null,
): DrawingRenderCacheUpdate {
  const backingStoreChanged =
    context.canvas.width !== metrics.backingWidth ||
    context.canvas.height !== metrics.backingHeight;

  if (context.canvas.width !== metrics.backingWidth) {
    context.canvas.width = metrics.backingWidth;
  }
  if (context.canvas.height !== metrics.backingHeight) {
    context.canvas.height = metrics.backingHeight;
  }

  context.setTransform(metrics.devicePixelRatio, 0, 0, metrics.devicePixelRatio, 0, 0);

  const strokeFingerprints = drawing.strokes.map(fingerprintDrawingStroke);
  const hasMatchingPrefix =
    previousState !== null &&
    previousState.strokeFingerprints.length <= strokeFingerprints.length &&
    previousState.strokeFingerprints.every(
      (fingerprint, index) => fingerprint === strokeFingerprints[index],
    );
  const canAppend =
    previousState !== null &&
    !backingStoreChanged &&
    cacheMatchesSurface(previousState, metrics) &&
    previousState.backgroundColor === drawing.backgroundColor &&
    hasMatchingPrefix;

  let strategy: DrawingRenderCacheUpdate["strategy"];
  if (!canAppend) {
    renderDrawingDocument(context, drawing, metrics.width, metrics.height);
    strategy = "full";
  } else if (previousState.strokeFingerprints.length === strokeFingerprints.length) {
    strategy = "unchanged";
  } else {
    for (
      let index = previousState.strokeFingerprints.length;
      index < drawing.strokes.length;
      index += 1
    ) {
      const stroke = drawing.strokes[index];
      if (stroke !== undefined) {
        renderDrawingStroke(
          context,
          stroke,
          metrics.width,
          metrics.height,
          drawing.backgroundColor,
        );
      }
    }
    strategy = "append";
  }

  return {
    state: {
      width: metrics.width,
      height: metrics.height,
      backingWidth: metrics.backingWidth,
      backingHeight: metrics.backingHeight,
      devicePixelRatio: metrics.devicePixelRatio,
      backgroundColor: drawing.backgroundColor,
      strokeFingerprints,
    },
    strategy,
  };
}

export function copyDrawingRenderCache(
  destination: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  backingWidth: number,
  backingHeight: number,
): void {
  destination.save();
  destination.setTransform(1, 0, 0, 1, 0, 0);
  destination.clearRect(0, 0, backingWidth, backingHeight);
  destination.imageSmoothingEnabled = true;
  destination.imageSmoothingQuality = "high";
  destination.drawImage(
    source,
    0,
    0,
    source.width,
    source.height,
    0,
    0,
    backingWidth,
    backingHeight,
  );
  destination.restore();
}

export function prepareCanvasForDisplay(canvas: HTMLCanvasElement): CanvasDisplayMetrics | null {
  const bounds = canvas.getBoundingClientRect();

  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const backingWidth = Math.max(1, Math.round(bounds.width * devicePixelRatio));
  const backingHeight = Math.max(1, Math.round(bounds.height * devicePixelRatio));
  const resized = canvas.width !== backingWidth || canvas.height !== backingHeight;

  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }

  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  return {
    context,
    width: bounds.width,
    height: bounds.height,
    backingWidth,
    backingHeight,
    devicePixelRatio,
    resized,
  };
}
