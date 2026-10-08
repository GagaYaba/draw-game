export const DRAWING_LEGACY_DOCUMENT_VERSION = 1 as const;
export const DRAWING_DOCUMENT_VERSION = 2 as const;
export const DRAWING_ASPECT_RATIO = "4:3" as const;
export const DRAWING_BACKGROUND_COLOR = "#FFFFFF" as const;

export const DRAWING_COLOR_PALETTE = [
  "#111111",
  "#616161",
  "#BDBDBD",
  "#FFFFFF",
  "#C62828",
  "#E53935",
  "#FB8C00",
  "#FDD835",
  "#2E7D32",
  "#43A047",
  "#00897B",
  "#00ACC1",
  "#1565C0",
  "#1E88E5",
  "#6A1B9A",
  "#8E24AA",
] as const;

export const DRAWING_ALLOWED_STROKE_WIDTHS = [4, 8, 14] as const;

export const DRAWING_MAX_STROKES = 250;
export const DRAWING_MAX_POINTS_PER_STROKE = 300;
export const DRAWING_MAX_TOTAL_POINTS = 30_000;
export const DRAWING_MAX_FILL_OPERATIONS = 16;

export type DrawingColor = (typeof DRAWING_COLOR_PALETTE)[number];
export type DrawingStrokeWidth = (typeof DRAWING_ALLOWED_STROKE_WIDTHS)[number];
export type DrawingPathTool = "pen" | "eraser";
export type DrawingTool = DrawingPathTool | "fill";

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingPathStroke {
  tool: DrawingPathTool;
  color: string;
  width: DrawingStrokeWidth;
  points: DrawingPoint[];
}

export interface DrawingFillOperation {
  tool: "fill";
  color: DrawingColor;
  width: DrawingStrokeWidth;
  points: [DrawingPoint];
}

/**
 * The `strokes` document field is kept for wire compatibility. Its ordered
 * entries are drawing operations: paths and seeded bucket fills.
 */
export type DrawingStroke = DrawingPathStroke | DrawingFillOperation;

export interface DrawingDocument {
  version: typeof DRAWING_DOCUMENT_VERSION;
  aspectRatio: typeof DRAWING_ASPECT_RATIO;
  backgroundColor: typeof DRAWING_BACKGROUND_COLOR;
  strokes: DrawingStroke[];
}
