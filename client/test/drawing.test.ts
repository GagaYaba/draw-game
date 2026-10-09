import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DrawingStroke } from "@drawing-game/shared";

import {
  countDrawingFillOperations,
  countDrawingPoints,
  createDrawingDocument,
  removeLastStroke,
} from "../src/components/drawing/drawing-document";
import { floodFillImageData, renderBucketFill } from "../src/components/drawing/drawing-fill";
import {
  normalizePointerPosition,
  shouldAddPoint,
} from "../src/components/drawing/drawing-geometry";
import {
  DRAWING_REFERENCE_HEIGHT,
  DRAWING_REFERENCE_WIDTH,
  getDrawingReferenceMetrics,
  renderDrawingStroke,
  updateDrawingRenderCache,
} from "../src/components/drawing/drawing-renderer";

const PEN: DrawingStroke = {
  tool: "pen",
  color: "#C62828",
  width: 8,
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.5, y: 0.5 },
  ],
};
const FILL: DrawingStroke = {
  tool: "fill",
  color: "#1565C0",
  width: 4,
  points: [{ x: 0.1, y: 0.1 }],
};

function createImage(width: number, height: number, wallColumn?: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (wallColumn !== undefined) {
    for (let y = 0; y < height; y += 1) {
      data.set([0, 0, 0, 255], (y * width + wallColumn) * 4);
    }
  }
  return { data, width, height } as unknown as ImageData;
}

function createRecordingContext(
  width = DRAWING_REFERENCE_WIDTH,
  height = DRAWING_REFERENCE_HEIGHT,
) {
  const calls: string[] = [];
  const context = new Proxy({ canvas: { width, height } } as Record<string, unknown>, {
    get(target, property: string) {
      if (property in target) return target[property];
      return (...args: unknown[]) => void calls.push(`${property}(${args.length})`);
    },
    set(target, property: string, value) {
      target[property] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { context, calls };
}

describe("éditeur de dessin", () => {
  // Risque : des coordonnées mal normalisées déforment le dessin envoyé aux autres joueurs.
  it("normalise les positions du pointeur et construit le document envoyé", () => {
    const bounds = { left: 10, top: 20, width: 200, height: 100 };
    assert.deepEqual(normalizePointerPosition({ clientX: 110, clientY: 70 }, bounds), {
      x: 0.5,
      y: 0.5,
    });
    assert.deepEqual(normalizePointerPosition({ clientX: 999, clientY: 0 }, bounds), {
      x: 1,
      y: 0,
    });
    assert.throws(
      () => normalizePointerPosition({ clientX: 1, clientY: 1 }, { ...bounds, width: 0 }),
      RangeError,
    );
    assert.throws(
      () => normalizePointerPosition({ clientX: Number.NaN, clientY: 1 }, bounds),
      RangeError,
    );
    assert.equal(shouldAddPoint({ x: 0, y: 0 }, { x: 0.001, y: 0 }), false);
    assert.equal(shouldAddPoint({ x: 0, y: 0 }, { x: 0.01, y: 0 }), true);

    const document = createDrawingDocument([PEN, FILL]);
    assert.equal(document.version, 2);
    assert.deepEqual(removeLastStroke(document.strokes), [PEN]);
    assert.equal(countDrawingPoints(document.strokes), 3);
    assert.equal(countDrawingFillOperations(document.strokes), 1);
  });

  // Risque : le pot de peinture déborde ou plante sur un canevas illisible.
  it("remplit la zone connectée sans franchir un mur et reste inoffensif en cas d'échec", () => {
    const image = createImage(6, 4, 3);
    assert.equal(floodFillImageData(image, { x: 0, y: 0 }, "#C62828"), true);
    assert.deepEqual([...image.data.slice(0, 4)], [198, 40, 40, 255]);
    assert.deepEqual([...image.data.slice(3 * 4, 3 * 4 + 4)], [0, 0, 0, 255], "le mur est intact");
    assert.deepEqual(
      [...image.data.slice(5 * 4, 5 * 4 + 4)],
      [255, 255, 255, 255],
      "l'autre côté est intact",
    );

    assert.equal(floodFillImageData(createImage(2, 2), { x: 0.5, y: 0.5 }, "#FFFFFF"), false);
    assert.equal(floodFillImageData(createImage(0, 0), { x: 0, y: 0 }, "#C62828"), false);

    const failing = {
      canvas: { width: 2, height: 2 },
      getImageData: () => {
        throw new Error("lecture interdite");
      },
    } as unknown as CanvasRenderingContext2D;
    assert.equal(renderBucketFill(failing, { x: 0, y: 0 }, "#C62828"), false);
  });

  // Risque : un cache de rendu faux affiche un dessin différent de celui qui sera envoyé.
  it("choisit entre rendu complet, ajout et cache inchangé", () => {
    const { context, calls } = createRecordingContext();
    renderDrawingStroke(context, PEN, 1200, 900, "#FFFFFF");
    assert.ok(calls.includes("lineTo(2)"));
    renderDrawingStroke(context, { ...PEN, points: [{ x: 0.5, y: 0.5 }] }, 1200, 900, "#FFFFFF");
    assert.ok(calls.includes("arc(5)"), "un point isolé est tracé comme un disque");

    const metrics = getDrawingReferenceMetrics(context);
    const document = createDrawingDocument([PEN]);
    const full = updateDrawingRenderCache(context, document, metrics, null);
    assert.equal(full.strategy, "full");
    assert.equal(
      updateDrawingRenderCache(context, document, metrics, full.state).strategy,
      "unchanged",
    );
    const appended = updateDrawingRenderCache(
      context,
      createDrawingDocument([PEN, FILL]),
      metrics,
      full.state,
    );
    assert.equal(appended.strategy, "append");
    assert.equal(
      updateDrawingRenderCache(context, createDrawingDocument([]), metrics, appended.state)
        .strategy,
      "full",
      "annuler un trait impose un rendu complet",
    );
  });
});
