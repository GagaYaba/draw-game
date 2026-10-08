import {
  DRAWING_ALLOWED_STROKE_WIDTHS,
  DRAWING_ASPECT_RATIO,
  DRAWING_BACKGROUND_COLOR,
  DRAWING_COLOR_PALETTE,
  DRAWING_DOCUMENT_VERSION,
  DRAWING_LEGACY_DOCUMENT_VERSION,
  DRAWING_MAX_FILL_OPERATIONS,
  DRAWING_MAX_POINTS_PER_STROKE,
  DRAWING_MAX_STROKES,
  DRAWING_MAX_TOTAL_POINTS,
  type DrawingColor,
  type DrawingDocument,
  type DrawingFillOperation,
  type DrawingPathStroke,
  type DrawingPoint,
  type DrawingStroke,
  type DrawingStrokeWidth,
} from "@drawing-game/shared";

type DrawingValidationErrorCode = "EMPTY_DRAWING" | "INVALID_DRAWING" | "DRAWING_TOO_LARGE";

export type DrawingValidationResult =
  | { success: true; document: DrawingDocument }
  | {
      success: false;
      error: {
        code: DrawingValidationErrorCode;
        message: string;
      };
    };

const INVALID_DRAWING_RESULT = {
  success: false,
  error: {
    code: "INVALID_DRAWING",
    message: "Le dessin contient des données invalides.",
  },
} as const satisfies DrawingValidationResult;

const EMPTY_DRAWING_RESULT = {
  success: false,
  error: {
    code: "EMPTY_DRAWING",
    message: "Le dessin est vide.",
  },
} as const satisfies DrawingValidationResult;

const DRAWING_TOO_LARGE_RESULT = {
  success: false,
  error: {
    code: "DRAWING_TOO_LARGE",
    message: "Le dessin dépasse la taille maximale autorisée.",
  },
} as const satisfies DrawingValidationResult;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Reflect.ownKeys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isAllowedStrokeWidth(value: unknown): value is DrawingStrokeWidth {
  return (
    typeof value === "number" && DRAWING_ALLOWED_STROKE_WIDTHS.some((width) => width === value)
  );
}

function isAllowedPenColor(value: string): value is DrawingColor {
  return DRAWING_COLOR_PALETTE.some((color) => color === value);
}

function isAllowedEraserColor(value: string): boolean {
  return value === DRAWING_BACKGROUND_COLOR || isAllowedPenColor(value);
}

function parsePoint(value: unknown): DrawingPoint | null {
  if (
    !isPlainRecord(value) ||
    !hasExactOwnKeys(value, ["x", "y"]) ||
    typeof value.x !== "number" ||
    !Number.isFinite(value.x) ||
    value.x < 0 ||
    value.x > 1 ||
    typeof value.y !== "number" ||
    !Number.isFinite(value.y) ||
    value.y < 0 ||
    value.y > 1
  ) {
    return null;
  }

  return { x: value.x, y: value.y };
}

function parseStroke(
  value: unknown,
  documentVersion: typeof DRAWING_LEGACY_DOCUMENT_VERSION | typeof DRAWING_DOCUMENT_VERSION,
): DrawingStroke | null {
  if (
    !isPlainRecord(value) ||
    !hasExactOwnKeys(value, ["tool", "color", "width", "points"]) ||
    typeof value.color !== "string" ||
    !isAllowedStrokeWidth(value.width) ||
    !Array.isArray(value.points) ||
    value.points.length < 1 ||
    value.points.length > DRAWING_MAX_POINTS_PER_STROKE
  ) {
    return null;
  }

  if (value.tool === "fill") {
    if (
      documentVersion === DRAWING_LEGACY_DOCUMENT_VERSION ||
      !isAllowedPenColor(value.color) ||
      value.points.length !== 1
    ) {
      return null;
    }

    const seed = parsePoint(value.points[0]);
    if (seed === null) {
      return null;
    }

    return {
      tool: "fill",
      color: value.color,
      width: value.width,
      points: [seed],
    } satisfies DrawingFillOperation;
  }

  if (
    (value.tool !== "pen" && value.tool !== "eraser") ||
    (value.tool === "pen" && !isAllowedPenColor(value.color)) ||
    (value.tool === "eraser" && !isAllowedEraserColor(value.color))
  ) {
    return null;
  }

  const points: DrawingPoint[] = [];
  for (let index = 0; index < value.points.length; index += 1) {
    const point = parsePoint(value.points[index]);
    if (point === null) {
      return null;
    }
    points.push(point);
  }

  return {
    tool: value.tool,
    color: value.tool === "eraser" ? DRAWING_BACKGROUND_COLOR : value.color,
    width: value.width,
    points,
  } satisfies DrawingPathStroke;
}

function validateSubmitDrawingPayloadUnsafe(payload: unknown): DrawingValidationResult {
  if (
    !isPlainRecord(payload) ||
    !hasExactOwnKeys(payload, ["drawing"]) ||
    !isPlainRecord(payload.drawing) ||
    !hasExactOwnKeys(payload.drawing, ["version", "aspectRatio", "backgroundColor", "strokes"]) ||
    (payload.drawing.version !== DRAWING_DOCUMENT_VERSION &&
      payload.drawing.version !== DRAWING_LEGACY_DOCUMENT_VERSION) ||
    payload.drawing.aspectRatio !== DRAWING_ASPECT_RATIO ||
    payload.drawing.backgroundColor !== DRAWING_BACKGROUND_COLOR ||
    !Array.isArray(payload.drawing.strokes)
  ) {
    return INVALID_DRAWING_RESULT;
  }

  const receivedStrokes = payload.drawing.strokes;
  if (receivedStrokes.length === 0) {
    return EMPTY_DRAWING_RESULT;
  }

  if (receivedStrokes.length > DRAWING_MAX_STROKES) {
    return DRAWING_TOO_LARGE_RESULT;
  }

  let totalPointCount = 0;
  let fillOperationCount = 0;
  for (let index = 0; index < receivedStrokes.length; index += 1) {
    const receivedStroke = receivedStrokes[index];
    if (!isPlainRecord(receivedStroke) || !Array.isArray(receivedStroke.points)) {
      return INVALID_DRAWING_RESULT;
    }

    if (receivedStroke.points.length > DRAWING_MAX_POINTS_PER_STROKE) {
      return DRAWING_TOO_LARGE_RESULT;
    }

    if (receivedStroke.tool === "fill") {
      fillOperationCount += 1;
      if (fillOperationCount > DRAWING_MAX_FILL_OPERATIONS) {
        return DRAWING_TOO_LARGE_RESULT;
      }
    }

    totalPointCount += receivedStroke.points.length;
    if (totalPointCount > DRAWING_MAX_TOTAL_POINTS) {
      return DRAWING_TOO_LARGE_RESULT;
    }
  }

  const strokes: DrawingStroke[] = [];
  for (let index = 0; index < receivedStrokes.length; index += 1) {
    const stroke = parseStroke(receivedStrokes[index], payload.drawing.version);
    if (stroke === null) {
      return INVALID_DRAWING_RESULT;
    }
    strokes.push(stroke);
  }

  return {
    success: true,
    document: {
      version: DRAWING_DOCUMENT_VERSION,
      aspectRatio: DRAWING_ASPECT_RATIO,
      backgroundColor: DRAWING_BACKGROUND_COLOR,
      strokes,
    },
  };
}

export function validateSubmitDrawingPayload(payload: unknown): DrawingValidationResult {
  try {
    return validateSubmitDrawingPayloadUnsafe(payload);
  } catch {
    return INVALID_DRAWING_RESULT;
  }
}

export function cloneDrawingDocument(document: DrawingDocument): DrawingDocument {
  return {
    version: DRAWING_DOCUMENT_VERSION,
    aspectRatio: DRAWING_ASPECT_RATIO,
    backgroundColor: DRAWING_BACKGROUND_COLOR,
    strokes: document.strokes.map((stroke): DrawingStroke => {
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
        points: stroke.points.map((point) => ({
          x: point.x,
          y: point.y,
        })),
      };
    }),
  };
}
