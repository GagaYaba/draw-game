import {
  DRAWING_ASPECT_RATIO,
  DRAWING_BACKGROUND_COLOR,
  DRAWING_DOCUMENT_VERSION,
  type DrawingDocument,
  type DrawingStroke,
} from "@drawing-game/shared";

export function cloneDrawingStroke(stroke: DrawingStroke): DrawingStroke {
  if (stroke.tool === "fill") {
    const seed = stroke.points[0];
    return {
      tool: "fill",
      color: stroke.color,
      width: stroke.width,
      points: [{ x: seed.x, y: seed.y }],
    };
  }

  return {
    tool: stroke.tool,
    color: stroke.tool === "eraser" ? DRAWING_BACKGROUND_COLOR : stroke.color,
    width: stroke.width,
    points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
  };
}

export function createDrawingDocument(strokes: readonly DrawingStroke[]): DrawingDocument {
  return {
    version: DRAWING_DOCUMENT_VERSION,
    aspectRatio: DRAWING_ASPECT_RATIO,
    backgroundColor: DRAWING_BACKGROUND_COLOR,
    strokes: strokes.map(cloneDrawingStroke),
  };
}

export function removeLastStroke(strokes: readonly DrawingStroke[]): DrawingStroke[] {
  return strokes.slice(0, -1);
}

export function countDrawingPoints(strokes: readonly DrawingStroke[]): number {
  return strokes.reduce((total, stroke) => total + stroke.points.length, 0);
}

export function countDrawingFillOperations(strokes: readonly DrawingStroke[]): number {
  return strokes.reduce((total, stroke) => total + (stroke.tool === "fill" ? 1 : 0), 0);
}
