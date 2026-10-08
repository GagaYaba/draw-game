import { useId, useLayoutEffect, useRef } from "react";

import type { DrawingDocument } from "@drawing-game/shared";

import {
  copyDrawingRenderCache,
  getDrawingReferenceMetrics,
  prepareCanvasForDisplay,
  renderDrawingDocument,
  updateDrawingRenderCache,
  type DrawingRenderCacheState,
} from "./drawing-renderer";

interface DrawingPreviewProps {
  drawing: DrawingDocument;
  description: string;
}

export function DrawingPreview({ drawing, description }: DrawingPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    state: DrawingRenderCacheState | null;
    drawing: DrawingDocument | null;
  } | null>(null);
  const descriptionId = useId();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }

    const redraw = () => {
      const metrics = prepareCanvasForDisplay(canvas);
      if (metrics === null) {
        return;
      }

      let renderCache = renderCacheRef.current;
      if (renderCache === null) {
        const cacheCanvas = document.createElement("canvas");
        const cacheContext = cacheCanvas.getContext("2d", {
          willReadFrequently: true,
        });
        if (cacheContext !== null) {
          renderCache = {
            canvas: cacheCanvas,
            context: cacheContext,
            state: null,
            drawing: null,
          };
          renderCacheRef.current = renderCache;
        }
      }

      if (renderCache === null) {
        renderDrawingDocument(metrics.context, drawing, metrics.width, metrics.height);
        return;
      }

      const currentDrawing = drawing;
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
    };

    redraw();
    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", redraw);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", redraw);
    };
  }, [drawing]);

  return (
    <figure className="drawing-preview">
      <div className="drawing-preview-frame">
        <canvas
          ref={canvasRef}
          className="drawing-preview-canvas"
          role="img"
          aria-label="Dessin soumis par le dessinateur"
          aria-describedby={descriptionId}
        >
          Votre navigateur ne permet pas d’afficher le dessin soumis.
        </canvas>
      </div>
      <figcaption id={descriptionId}>{description}</figcaption>
    </figure>
  );
}
