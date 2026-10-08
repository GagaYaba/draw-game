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
  type DrawingTool,
} from "@drawing-game/shared";

import type { BrowserStorage } from "./stored-session";

export const STORED_DRAWING_DRAFT_KEY = "drawing-scale-game-draft";

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_SERIALIZED_DRAFT_LENGTH = 2_500_000;

export interface DrawingDraftContext {
  roomCode: string;
  gameId: string;
  turnId: string;
  playerId: string;
}

export interface StoredDrawingDraft extends DrawingDraftContext {
  drawing: DrawingDocument;
  selectedTool: DrawingTool;
  selectedColor: DrawingColor;
  selectedWidth: DrawingStrokeWidth;
  savedAt: number;
}

function getBrowserStorage(): BrowserStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value: Record<string, unknown>, expectedKeys: readonly string[]) {
  const actualKeys = Reflect.ownKeys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    value.trim() === value &&
    !/\s/u.test(value)
  );
}

function isRoomCode(value: unknown): value is string {
  return typeof value === "string" && ROOM_CODE_PATTERN.test(value);
}

function isDrawingTool(value: unknown): value is DrawingTool {
  return value === "pen" || value === "eraser" || value === "fill";
}

function isDrawingColor(value: unknown): value is DrawingColor {
  return typeof value === "string" && DRAWING_COLOR_PALETTE.some((color) => color === value);
}

function isDrawingWidth(value: unknown): value is DrawingStrokeWidth {
  return (
    typeof value === "number" && DRAWING_ALLOWED_STROKE_WIDTHS.some((width) => width === value)
  );
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
    !isDrawingTool(value.tool) ||
    typeof value.color !== "string" ||
    !isDrawingWidth(value.width) ||
    !Array.isArray(value.points) ||
    value.points.length < 1 ||
    value.points.length > DRAWING_MAX_POINTS_PER_STROKE
  ) {
    return null;
  }

  if (value.tool === "fill") {
    if (
      documentVersion === DRAWING_LEGACY_DOCUMENT_VERSION ||
      !isDrawingColor(value.color) ||
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

  const validColor =
    value.tool === "pen" ? isDrawingColor(value.color) : value.color === DRAWING_BACKGROUND_COLOR;
  if (!validColor) {
    return null;
  }

  const points: DrawingPoint[] = [];
  for (const receivedPoint of value.points) {
    const point = parsePoint(receivedPoint);
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

function parseDrawingDocument(value: unknown): DrawingDocument | null {
  if (
    !isPlainRecord(value) ||
    !hasExactOwnKeys(value, ["version", "aspectRatio", "backgroundColor", "strokes"]) ||
    (value.version !== DRAWING_DOCUMENT_VERSION &&
      value.version !== DRAWING_LEGACY_DOCUMENT_VERSION) ||
    value.aspectRatio !== DRAWING_ASPECT_RATIO ||
    value.backgroundColor !== DRAWING_BACKGROUND_COLOR ||
    !Array.isArray(value.strokes) ||
    value.strokes.length > DRAWING_MAX_STROKES
  ) {
    return null;
  }

  const strokes: DrawingStroke[] = [];
  let totalPointCount = 0;
  let fillOperationCount = 0;

  for (const receivedStroke of value.strokes) {
    const stroke = parseStroke(receivedStroke, value.version);
    if (stroke === null) {
      return null;
    }

    if (stroke.tool === "fill") {
      fillOperationCount += 1;
      if (fillOperationCount > DRAWING_MAX_FILL_OPERATIONS) {
        return null;
      }
    }

    totalPointCount += stroke.points.length;
    if (totalPointCount > DRAWING_MAX_TOTAL_POINTS) {
      return null;
    }

    strokes.push(stroke);
  }

  return {
    version: DRAWING_DOCUMENT_VERSION,
    aspectRatio: DRAWING_ASPECT_RATIO,
    backgroundColor: DRAWING_BACKGROUND_COLOR,
    strokes,
  };
}

export function parseStoredDrawingDraft(value: unknown): StoredDrawingDraft | null {
  if (
    !isPlainRecord(value) ||
    !hasExactOwnKeys(value, [
      "roomCode",
      "gameId",
      "turnId",
      "playerId",
      "drawing",
      "selectedTool",
      "selectedColor",
      "selectedWidth",
      "savedAt",
    ]) ||
    !isRoomCode(value.roomCode) ||
    !isIdentifier(value.gameId) ||
    !isIdentifier(value.turnId) ||
    !isIdentifier(value.playerId) ||
    !isDrawingTool(value.selectedTool) ||
    !isDrawingColor(value.selectedColor) ||
    !isDrawingWidth(value.selectedWidth) ||
    typeof value.savedAt !== "number" ||
    !Number.isSafeInteger(value.savedAt) ||
    value.savedAt < 0
  ) {
    return null;
  }

  const drawing = parseDrawingDocument(value.drawing);
  if (drawing === null) {
    return null;
  }

  return {
    roomCode: value.roomCode,
    gameId: value.gameId,
    turnId: value.turnId,
    playerId: value.playerId,
    drawing,
    selectedTool: value.selectedTool,
    selectedColor: value.selectedColor,
    selectedWidth: value.selectedWidth,
    savedAt: value.savedAt,
  };
}

export function matchesDrawingDraftContext(
  draft: StoredDrawingDraft,
  context: DrawingDraftContext,
) {
  return (
    draft.roomCode === context.roomCode &&
    draft.gameId === context.gameId &&
    draft.turnId === context.turnId &&
    draft.playerId === context.playerId
  );
}

export function readStoredDrawingDraft(
  storage: BrowserStorage | null = getBrowserStorage(),
): StoredDrawingDraft | null {
  if (storage === null) {
    return null;
  }

  try {
    const serialized = storage.getItem(STORED_DRAWING_DRAFT_KEY);
    if (serialized === null) {
      return null;
    }

    if (serialized.length > MAX_SERIALIZED_DRAFT_LENGTH) {
      storage.removeItem(STORED_DRAWING_DRAFT_KEY);
      return null;
    }

    const draft = parseStoredDrawingDraft(JSON.parse(serialized) as unknown);
    if (draft !== null) {
      return draft;
    }

    storage.removeItem(STORED_DRAWING_DRAFT_KEY);
  } catch {
    try {
      storage.removeItem(STORED_DRAWING_DRAFT_KEY);
    } catch {
      // Le stockage peut être indisponible ou interdit par le navigateur.
    }
  }

  return null;
}

export function writeStoredDrawingDraft(
  draft: StoredDrawingDraft,
  storage: BrowserStorage | null = getBrowserStorage(),
) {
  const parsedDraft = parseStoredDrawingDraft(draft);
  if (storage === null || parsedDraft === null) {
    return false;
  }

  try {
    storage.setItem(STORED_DRAWING_DRAFT_KEY, JSON.stringify(parsedDraft));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredDrawingDraft(storage: BrowserStorage | null = getBrowserStorage()) {
  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(STORED_DRAWING_DRAFT_KEY);
  } catch {
    // Le nettoyage ne doit jamais faire planter l'application.
  }
}
