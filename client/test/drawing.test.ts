import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DrawingDocument, DrawingStroke } from "@drawing-game/shared";

import {
  cloneDrawingStroke,
  countDrawingFillOperations,
  countDrawingPoints,
  createDrawingDocument,
  removeLastStroke,
} from "../src/components/drawing/drawing-document";
import { floodFillImageData, renderBucketFill } from "../src/components/drawing/drawing-fill";
import {
  distanceBetweenPoints,
  normalizePointerPosition,
  shouldAddPoint,
} from "../src/components/drawing/drawing-geometry";
import {
  copyDrawingRenderCache,
  DRAWING_REFERENCE_HEIGHT,
  DRAWING_REFERENCE_WIDTH,
  getDrawingReferenceMetrics,
  prepareCanvasForDisplay,
  renderDrawingDocument,
  renderDrawingStroke,
  updateDrawingRenderCache,
} from "../src/components/drawing/drawing-renderer";
import {
  getScaleGaugeMarkerPosition,
  isScaleGaugeValue,
} from "../src/components/scale/scale-gauge";

const PEN: DrawingStroke = {
  tool: "pen",
  color: "#C62828",
  width: 8,
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.5, y: 0.5 },
  ],
};
const DOT: DrawingStroke = { ...PEN, points: [{ x: 0.5, y: 0.5 }] };
const ERASER: DrawingStroke = { ...PEN, tool: "eraser", color: "#C62828" };
const FILL: DrawingStroke = {
  tool: "fill",
  color: "#1565C0",
  width: 4,
  points: [{ x: 0.1, y: 0.1 }],
};

describe("document de dessin", () => {
  it("copie les traits en profondeur et force le fond de la gomme", () => {
    const copy = cloneDrawingStroke(ERASER);
    assert.equal(copy.color, "#FFFFFF");
    assert.notEqual(copy.points[0], ERASER.points[0]);

    const fill = cloneDrawingStroke(FILL);
    assert.deepEqual(fill, FILL);
    assert.notEqual(fill.points[0], FILL.points[0]);
  });

  it("construit un document, retire le dernier trait et compte points et remplissages", () => {
    const document = createDrawingDocument([PEN, FILL]);
    assert.equal(document.version, 2);
    assert.equal(document.strokes.length, 2);
    assert.deepEqual(removeLastStroke(document.strokes), [PEN]);
    assert.deepEqual(removeLastStroke([]), []);
    assert.equal(countDrawingPoints(document.strokes), 3);
    assert.equal(countDrawingFillOperations(document.strokes), 1);
  });
});

describe("géométrie du pointeur", () => {
  const bounds = { left: 10, top: 20, width: 200, height: 100 };

  const positions: [number, number, number, number][] = [
    [110, 70, 0.5, 0.5],
    [0, 0, 0, 0],
    [999, 999, 1, 1],
  ];
  for (const [clientX, clientY, x, y] of positions) {
    it(`normalise (${clientX}, ${clientY}) en (${x}, ${y})`, () => {
      assert.deepEqual(normalizePointerPosition({ clientX, clientY }, bounds), { x, y });
    });
  }

  const invalid: [string, Parameters<typeof normalizePointerPosition>][] = [
    [
      "largeur nulle",
      [
        { clientX: 1, clientY: 1 },
        { ...bounds, width: 0 },
      ],
    ],
    [
      "hauteur négative",
      [
        { clientX: 1, clientY: 1 },
        { ...bounds, height: -1 },
      ],
    ],
    ["position non finie", [{ clientX: Number.NaN, clientY: 1 }, bounds]],
    [
      "bord non fini",
      [
        { clientX: 1, clientY: 1 },
        { ...bounds, left: Number.POSITIVE_INFINITY },
      ],
    ],
  ];
  for (const [label, args] of invalid) {
    it(`refuse ${label}`, () => {
      assert.throws(() => normalizePointerPosition(...args), RangeError);
    });
  }

  it("n'ajoute un point qu'au-delà de la distance minimale", () => {
    assert.equal(distanceBetweenPoints({ x: 0, y: 0 }, { x: 0.3, y: 0.4 }), 0.5);
    assert.equal(shouldAddPoint({ x: 0, y: 0 }, { x: 0.001, y: 0 }), false);
    assert.equal(shouldAddPoint({ x: 0, y: 0 }, { x: 0.01, y: 0 }), true);
    assert.equal(shouldAddPoint({ x: 0, y: 0 }, { x: 0.01, y: 0 }, 0.1), false);
  });
});

describe("jauge d'échelle", () => {
  it("accepte les niveaux de 1 à 10 et place le repère au centre de chaque case", () => {
    assert.equal(isScaleGaugeValue(1), true);
    assert.equal(isScaleGaugeValue(10), true);
    assert.equal(isScaleGaugeValue(0), false);
    assert.equal(isScaleGaugeValue(5.5), false);
    assert.equal(isScaleGaugeValue("5"), false);
    assert.equal(getScaleGaugeMarkerPosition(1), 5);
    assert.equal(getScaleGaugeMarkerPosition(10), 95);
    assert.equal(getScaleGaugeMarkerPosition(null), null);
  });
});

function createImage(width: number, height: number, wallColumn?: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  if (wallColumn !== undefined) {
    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + wallColumn) * 4;
      data.set([0, 0, 0, 255], offset);
    }
  }
  return { data, width, height } as unknown as ImageData;
}

describe("remplissage", () => {
  it("remplit la zone connectée sans franchir un mur", () => {
    const image = createImage(6, 4, 3);

    assert.equal(floodFillImageData(image, { x: 0, y: 0 }, "#C62828"), true);
    assert.deepEqual([...image.data.slice(0, 4)], [198, 40, 40, 255]);
    const wall = (0 * 6 + 3) * 4;
    assert.deepEqual([...image.data.slice(wall, wall + 4)], [0, 0, 0, 255]);
    const right = (0 * 6 + 5) * 4;
    assert.deepEqual([...image.data.slice(right, right + 4)], [255, 255, 255, 255]);
  });

  it("ne change rien quand la zone a déjà la couleur demandée, ou pour une image invalide", () => {
    const white = createImage(2, 2);
    assert.equal(floodFillImageData(white, { x: 0.5, y: 0.5 }, "#FFFFFF"), false);
    assert.deepEqual([...white.data], new Array(16).fill(255));
    assert.equal(
      floodFillImageData(
        { data: new Uint8ClampedArray(3), width: 1, height: 1 } as ImageData,
        { x: 0, y: 0 },
        "#C62828",
      ),
      false,
    );
    assert.equal(floodFillImageData(createImage(0, 0), { x: 0, y: 0 }, "#C62828"), false);
  });

  it("renvoie false si la lecture du canevas échoue ou si le canevas est vide", () => {
    const failing = {
      canvas: { width: 2, height: 2 },
      getImageData: () => {
        throw new Error("lecture interdite");
      },
    } as unknown as CanvasRenderingContext2D;
    assert.equal(renderBucketFill(failing, { x: 0, y: 0 }, "#C62828"), false);

    const empty = { canvas: { width: 0, height: 0 } } as unknown as CanvasRenderingContext2D;
    assert.equal(renderBucketFill(empty, { x: 0, y: 0 }, "#C62828"), false);

    const image = createImage(2, 2);
    let written = false;
    const working = {
      canvas: { width: 2, height: 2 },
      getImageData: () => image,
      putImageData: () => {
        written = true;
      },
    } as unknown as CanvasRenderingContext2D;
    assert.equal(renderBucketFill(working, { x: 0, y: 0 }, "#C62828"), true);
    assert.equal(written, true);
  });
});

function createRecordingContext(
  canvasWidth = DRAWING_REFERENCE_WIDTH,
  canvasHeight = DRAWING_REFERENCE_HEIGHT,
) {
  const calls: string[] = [];
  const context = new Proxy(
    { canvas: { width: canvasWidth, height: canvasHeight } } as Record<string, unknown>,
    {
      get(target, property: string) {
        if (property in target) return target[property];
        return (...args: unknown[]) => {
          calls.push(`${property}(${args.length})`);
        };
      },
      set(target, property: string, value) {
        target[property] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;

  return { context, calls };
}

describe("rendu du dessin", () => {
  it("trace un point, une ligne et une gomme, et ignore un trait sans point ou une surface vide", () => {
    const dot = createRecordingContext();
    renderDrawingStroke(dot.context, DOT, 1200, 900, "#FFFFFF");
    assert.ok(dot.calls.includes("arc(5)"));

    const line = createRecordingContext();
    renderDrawingStroke(line.context, PEN, 1200, 900, "#FFFFFF");
    assert.ok(line.calls.includes("lineTo(2)"));

    const eraser = createRecordingContext();
    renderDrawingStroke(eraser.context, ERASER, 1200, 900, "#FFFFFF");
    assert.equal((eraser.context as unknown as { strokeStyle: string }).strokeStyle, "#FFFFFF");

    const none = createRecordingContext();
    renderDrawingStroke(none.context, { ...PEN, points: [] }, 1200, 900, "#FFFFFF");
    renderDrawingStroke(none.context, PEN, 0, 900, "#FFFFFF");
    assert.deepEqual(none.calls, []);
  });

  it("choisit entre rendu complet, ajout incrémental et cache inchangé", () => {
    const { context } = createRecordingContext();
    const metrics = getDrawingReferenceMetrics(context);
    const document: DrawingDocument = createDrawingDocument([PEN]);

    assert.equal(metrics.resized, false);
    const full = updateDrawingRenderCache(context, document, metrics, null);
    assert.equal(full.strategy, "full");

    const unchanged = updateDrawingRenderCache(context, document, metrics, full.state);
    assert.equal(unchanged.strategy, "unchanged");

    const appended = updateDrawingRenderCache(
      context,
      createDrawingDocument([PEN, DOT]),
      metrics,
      full.state,
    );
    assert.equal(appended.strategy, "append");

    const undone = updateDrawingRenderCache(
      context,
      createDrawingDocument([]),
      metrics,
      appended.state,
    );
    assert.equal(undone.strategy, "full");

    const resizedSurface = createRecordingContext(10, 10);
    const resizedMetrics = getDrawingReferenceMetrics(resizedSurface.context);
    assert.equal(resizedMetrics.resized, true);
    assert.equal(
      updateDrawingRenderCache(resizedSurface.context, document, resizedMetrics, full.state)
        .strategy,
      "full",
    );
  });

  it("rend tout un document et copie le cache sur la surface visible", () => {
    const { context, calls } = createRecordingContext();
    renderDrawingDocument(context, createDrawingDocument([PEN, FILL]), 1200, 900);
    assert.ok(calls.includes("clearRect(4)"));
    assert.ok(calls.includes("fillRect(4)"));

    const destination = createRecordingContext();
    copyDrawingRenderCache(
      destination.context,
      { width: 10, height: 10 } as HTMLCanvasElement,
      20,
      20,
    );
    assert.ok(destination.calls.includes("drawImage(9)"));
  });

  it("prépare un canevas selon sa taille affichée, ou renvoie null", () => {
    const { context } = createRecordingContext();
    const canvas = (width: number, hasContext = true) =>
      ({
        width: 0,
        height: 0,
        getBoundingClientRect: () => ({ width, height: width }),
        getContext: () => (hasContext ? context : null),
      }) as unknown as HTMLCanvasElement;
    const globals = globalThis as unknown as { window?: { devicePixelRatio: number } };
    const previousWindow = globals.window;
    globals.window = { devicePixelRatio: 2 };

    try {
      const metrics = prepareCanvasForDisplay(canvas(100));
      assert.equal(metrics?.backingWidth, 200);
      assert.equal(metrics?.resized, true);
      assert.equal(prepareCanvasForDisplay(canvas(0)), null);
      assert.equal(prepareCanvasForDisplay(canvas(100, false)), null);
    } finally {
      globals.window = previousWindow;
    }
  });
});
