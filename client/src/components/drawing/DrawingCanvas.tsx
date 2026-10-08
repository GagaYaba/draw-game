import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  DRAWING_BACKGROUND_COLOR,
  DRAWING_MAX_POINTS_PER_STROKE,
  type DrawingColor,
  type DrawingDocument,
  type DrawingFillOperation,
  type DrawingPathStroke,
  type DrawingPoint,
  type DrawingStroke,
  type DrawingStrokeWidth,
  type DrawingTool,
} from "@drawing-game/shared";

import { createDrawingDocument } from "./drawing-document";
import { normalizePointerPosition, shouldAddPoint } from "./drawing-geometry";
import {
  copyDrawingRenderCache,
  getDrawingReferenceMetrics,
  prepareCanvasForDisplay,
  renderDrawingDocument,
  renderDrawingStroke,
  updateDrawingRenderCache,
  type DrawingRenderCacheState,
} from "./drawing-renderer";

interface DrawingCanvasProps {
  strokes: readonly DrawingStroke[];
  selectedTool: DrawingTool;
  selectedColor: DrawingColor;
  selectedWidth: DrawingStrokeWidth;
  remainingPointCapacity: number;
  remainingFillCapacity: number;
  disabled: boolean;
  describedBy?: string;
  onStrokeComplete: (stroke: DrawingStroke) => void;
  onStrokeActiveChange: (isActive: boolean) => void;
  onLimitReached: () => void;
}

export function DrawingCanvas({
  strokes,
  selectedTool,
  selectedColor,
  selectedWidth,
  remainingPointCapacity,
  remainingFillCapacity,
  disabled,
  describedBy,
  onStrokeComplete,
  onStrokeActiveChange,
  onLimitReached,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useMemo(() => createDrawingDocument(strokes), [strokes]);
  const drawingRef = useRef(drawing);
  const activeStrokeRef = useRef<DrawingPathStroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const renderCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    state: DrawingRenderCacheState | null;
    drawing: DrawingDocument | null;
  } | null>(null);

  drawingRef.current = drawing;

  const getRenderCache = useCallback(() => {
    const existingCache = renderCacheRef.current;
    if (existingCache !== null) {
      return existingCache;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) {
      return null;
    }

    const cache = { canvas, context, state: null, drawing: null };
    renderCacheRef.current = cache;
    return cache;
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const metrics = prepareCanvasForDisplay(canvas);
    if (metrics === null) {
      return;
    }

    const currentDrawing = drawingRef.current;
    const renderCache = getRenderCache();
    if (renderCache === null) {
      renderDrawingDocument(metrics.context, currentDrawing, metrics.width, metrics.height);
    } else {
      if (renderCache.drawing !== currentDrawing) {
        const update = updateDrawingRenderCache(
          renderCache.context,
          currentDrawing,
          getDrawingReferenceMetrics(renderCache.context),
          renderCache.state,
        );
        renderCache.state = update.state;
        renderCache.drawing = currentDrawing;
      }
      copyDrawingRenderCache(
        metrics.context,
        renderCache.canvas,
        metrics.backingWidth,
        metrics.backingHeight,
      );
    }

    const activeStroke = activeStrokeRef.current;
    if (activeStroke !== null) {
      renderDrawingStroke(
        metrics.context,
        activeStroke,
        metrics.width,
        metrics.height,
        DRAWING_BACKGROUND_COLOR,
      );
    }
  }, [getRenderCache]);

  useLayoutEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(redrawCanvas);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", redrawCanvas);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", redrawCanvas);
    };
  }, [redrawCanvas]);

  useEffect(() => {
    if (!disabled || activePointerIdRef.current === null) {
      return;
    }

    const pointerId = activePointerIdRef.current;
    activePointerIdRef.current = null;
    activeStrokeRef.current = null;
    onStrokeActiveChange(false);

    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    redrawCanvas();
  }, [disabled, onStrokeActiveChange, redrawCanvas]);

  const drawStrokeIncrement = (stroke: DrawingPathStroke, points: DrawingPoint[]) => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const metrics = prepareCanvasForDisplay(canvas);
    if (metrics === null) {
      return;
    }
    if (metrics.resized) {
      redrawCanvas();
      return;
    }

    renderDrawingStroke(
      metrics.context,
      { ...stroke, points },
      metrics.width,
      metrics.height,
      DRAWING_BACKGROUND_COLOR,
    );
  };

  const finishStroke = (pointerId: number) => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }

    const completedStroke = activeStrokeRef.current;
    activePointerIdRef.current = null;
    activeStrokeRef.current = null;
    onStrokeActiveChange(false);

    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }

    if (completedStroke !== null && completedStroke.points.length > 0) {
      onStrokeComplete({
        ...completedStroke,
        points: completedStroke.points.map((point) => ({ ...point })),
      });
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (
      disabled ||
      activePointerIdRef.current !== null ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    if (remainingPointCapacity < 1) {
      onLimitReached();
      return;
    }

    event.preventDefault();
    const point = normalizePointerPosition(event, event.currentTarget.getBoundingClientRect());
    if (selectedTool === "fill") {
      if (remainingFillCapacity < 1) {
        onLimitReached();
        return;
      }

      onStrokeComplete({
        tool: "fill",
        color: selectedColor,
        width: selectedWidth,
        points: [{ ...point }],
      } satisfies DrawingFillOperation);
      return;
    }

    const stroke: DrawingPathStroke = {
      tool: selectedTool,
      color: selectedTool === "eraser" ? DRAWING_BACKGROUND_COLOR : selectedColor,
      width: selectedWidth,
      points: [point],
    };

    activePointerIdRef.current = event.pointerId;
    activeStrokeRef.current = stroke;
    onStrokeActiveChange(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    drawStrokeIncrement(stroke, [point]);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const activeStroke = activeStrokeRef.current;
    if (activeStroke === null) {
      return;
    }

    const strokePointLimit = Math.min(DRAWING_MAX_POINTS_PER_STROKE, remainingPointCapacity);
    if (activeStroke.points.length >= strokePointLimit) {
      onLimitReached();
      return;
    }

    const previousPoint = activeStroke.points.at(-1);
    if (previousPoint === undefined) {
      return;
    }

    const nextPoint = normalizePointerPosition(event, event.currentTarget.getBoundingClientRect());
    if (!shouldAddPoint(previousPoint, nextPoint)) {
      return;
    }

    activeStroke.points.push(nextPoint);
    drawStrokeIncrement(activeStroke, [previousPoint, nextPoint]);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    finishStroke(event.pointerId);
  };

  return (
    <div
      className={`drawing-canvas-frame${disabled ? " drawing-canvas-frame--disabled" : ""}`}
      role="group"
      aria-label="Zone de dessin interactive au format quatre tiers"
      aria-describedby={describedBy}
      aria-disabled={disabled}
    >
      <canvas
        ref={canvasRef}
        className={`drawing-canvas drawing-canvas--${selectedTool}`}
        aria-label="Zone de dessin interactive au format quatre tiers"
        aria-disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
      >
        Votre navigateur ne permet pas d’afficher la zone de dessin.
      </canvas>
    </div>
  );
}
