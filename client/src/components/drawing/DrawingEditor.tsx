import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  DRAWING_COLOR_PALETTE,
  DRAWING_MAX_FILL_OPERATIONS,
  DRAWING_MAX_STROKES,
  DRAWING_MAX_TOTAL_POINTS,
  type DrawingColor,
  type DrawingDocument,
  type DrawingStroke,
  type DrawingStrokeWidth,
  type DrawingTool,
} from "@drawing-game/shared";

import {
  countDrawingFillOperations,
  countDrawingPoints,
  createDrawingDocument,
  removeLastStroke,
} from "./drawing-document";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingToolbar } from "./DrawingToolbar";
import { GameDialog } from "../ui/GameDialog";
import {
  clearStoredDrawingDraft,
  matchesDrawingDraftContext,
  readStoredDrawingDraft,
  writeStoredDrawingDraft,
  type DrawingDraftContext,
} from "../../session/stored-drawing-draft";

interface DrawingEditorProps {
  disabled: boolean;
  isSubmitting: boolean;
  draftContext: DrawingDraftContext;
  onSubmit: (drawing: DrawingDocument) => boolean;
  sidebarHeader: ReactNode;
  sidebarFooter: ReactNode;
}

const DEFAULT_TOOL: DrawingTool = "pen";
const DEFAULT_COLOR: DrawingColor = DRAWING_COLOR_PALETTE[0];
const DEFAULT_WIDTH: DrawingStrokeWidth = 8;
type ActiveDrawingDialog = "clear" | "submit" | null;

function getInitialEditorState(context: DrawingDraftContext) {
  const draft = readStoredDrawingDraft();
  if (draft !== null && !matchesDrawingDraftContext(draft, context)) {
    clearStoredDrawingDraft();
  }

  if (draft === null || !matchesDrawingDraftContext(draft, context)) {
    return {
      strokes: [] as DrawingStroke[],
      selectedTool: DEFAULT_TOOL,
      selectedColor: DEFAULT_COLOR,
      selectedWidth: DEFAULT_WIDTH,
    };
  }

  return {
    strokes: draft.drawing.strokes,
    selectedTool: draft.selectedTool,
    selectedColor: draft.selectedColor,
    selectedWidth: draft.selectedWidth,
  };
}

export function DrawingEditor({
  disabled,
  isSubmitting,
  draftContext,
  onSubmit,
  sidebarHeader,
  sidebarFooter,
}: DrawingEditorProps) {
  const [initialEditorState] = useState(() => getInitialEditorState(draftContext));
  const [strokes, setStrokes] = useState<DrawingStroke[]>(initialEditorState.strokes);
  const [selectedTool, setSelectedTool] = useState<DrawingTool>(initialEditorState.selectedTool);
  const [selectedColor, setSelectedColor] = useState<DrawingColor>(
    initialEditorState.selectedColor,
  );
  const [selectedWidth, setSelectedWidth] = useState<DrawingStrokeWidth>(
    initialEditorState.selectedWidth,
  );
  const [isStrokeActive, setIsStrokeActive] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActiveDrawingDialog>(null);
  const submissionRequestedRef = useRef(false);

  useEffect(() => {
    if (!isSubmitting) {
      submissionRequestedRef.current = false;
    }
  }, [isSubmitting]);

  useEffect(() => {
    if (disabled) {
      setActiveDialog(null);
    }
  }, [disabled]);

  useEffect(() => {
    writeStoredDrawingDraft({
      ...draftContext,
      drawing: createDrawingDocument(strokes),
      selectedTool,
      selectedColor,
      selectedWidth,
      savedAt: Date.now(),
    });
  }, [
    draftContext.gameId,
    draftContext.playerId,
    draftContext.roomCode,
    draftContext.turnId,
    selectedColor,
    selectedTool,
    selectedWidth,
    strokes,
  ]);

  const totalPointCount = useMemo(() => countDrawingPoints(strokes), [strokes]);
  const remainingPointCapacity = Math.max(0, DRAWING_MAX_TOTAL_POINTS - totalPointCount);
  const fillOperationCount = useMemo(() => countDrawingFillOperations(strokes), [strokes]);
  const remainingFillCapacity = Math.max(0, DRAWING_MAX_FILL_OPERATIONS - fillOperationCount);
  const canStartStroke = strokes.length < DRAWING_MAX_STROKES && remainingPointCapacity > 0;
  const editorIsDisabled = disabled || !canStartStroke;

  const handleStrokeComplete = (stroke: DrawingStroke) => {
    if (stroke.tool === "fill" && fillOperationCount >= DRAWING_MAX_FILL_OPERATIONS) {
      setLimitMessage("La limite de remplissages est atteinte. Annulez une action pour continuer.");
      return;
    }

    setStrokes((currentStrokes) => [...currentStrokes, stroke]);
    setLimitMessage(null);
  };

  const handleLimitReached = () => {
    if (selectedTool === "fill" && remainingFillCapacity === 0) {
      setLimitMessage("La limite de remplissages est atteinte. Annulez une action pour continuer.");
      return;
    }

    setLimitMessage(
      "La limite de complexité du dessin est atteinte. Annulez une action pour continuer.",
    );
  };

  const handleUndo = () => {
    setStrokes((currentStrokes) => removeLastStroke(currentStrokes));
    setLimitMessage(null);
  };

  const handleClear = () => {
    if (strokes.length === 0) {
      return;
    }

    setActiveDialog("clear");
  };

  const confirmClear = () => {
    if (disabled) {
      setActiveDialog(null);
      return;
    }

    setStrokes([]);
    setLimitMessage(null);
    setActiveDialog(null);
  };

  const handleSubmit = () => {
    if (disabled || isSubmitting || submissionRequestedRef.current || strokes.length === 0) {
      return;
    }

    setActiveDialog("submit");
  };

  const confirmSubmit = () => {
    if (disabled || isSubmitting || submissionRequestedRef.current || strokes.length === 0) {
      return;
    }

    submissionRequestedRef.current = true;
    const submissionStarted = onSubmit(createDrawingDocument(strokes));
    setActiveDialog(null);
    if (!submissionStarted) {
      submissionRequestedRef.current = false;
    }
  };

  const handleColorChange = (color: DrawingColor) => {
    setSelectedColor(color);
    setSelectedTool((currentTool) => (currentTool === "eraser" ? "pen" : currentTool));
  };

  const handleToolChange = (tool: DrawingTool) => {
    setSelectedTool(tool);
    setLimitMessage(null);
  };

  return (
    <>
      <section
        className="game-phase-layout__main drawing-editor drawing-editor__canvas-stage"
        aria-labelledby="drawing-editor-title"
      >
        <h2 className="visually-hidden" id="drawing-editor-title">
          Zone de dessin
        </h2>
        <p id="drawing-canvas-help" className="drawing-canvas-help visually-hidden">
          Dessinez avec la souris, le doigt ou un stylet. Le dessin reste dans ce navigateur jusqu’à
          sa validation.
        </p>

        <div className="game-media-viewport drawing-canvas-viewport">
          <DrawingCanvas
            strokes={strokes}
            selectedTool={selectedTool}
            selectedColor={selectedColor}
            selectedWidth={selectedWidth}
            remainingPointCapacity={remainingPointCapacity}
            remainingFillCapacity={remainingFillCapacity}
            disabled={editorIsDisabled}
            describedBy="drawing-canvas-help"
            onStrokeComplete={handleStrokeComplete}
            onStrokeActiveChange={setIsStrokeActive}
            onLimitReached={handleLimitReached}
          />
        </div>
      </section>

      <aside className="game-phase-layout__sidebar drawing-editor-controls">
        {sidebarHeader}

        <div className="drawing-editor-heading">
          <div>
            <p className="card-label">Votre dessin</p>
            <h2>Outils de dessin</h2>
          </div>
          <p>
            {strokes.length} action{strokes.length > 1 ? "s" : ""}
          </p>
        </div>

        <DrawingToolbar
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          selectedWidth={selectedWidth}
          canUndo={strokes.length > 0}
          disabled={disabled || isStrokeActive}
          onToolChange={handleToolChange}
          onColorChange={handleColorChange}
          onWidthChange={setSelectedWidth}
          onUndo={handleUndo}
          onClear={handleClear}
        />

        {limitMessage !== null && (
          <p className="drawing-limit-message" role="status">
            {limitMessage}
          </p>
        )}

        <div className="drawing-submit-area">
          <p id="drawing-submit-help">Validation définitive pour ce tour.</p>
          <button
            className="button button--primary drawing-submit-button"
            type="button"
            disabled={disabled || isSubmitting || isStrokeActive || strokes.length === 0}
            aria-describedby="drawing-submit-help"
            onClick={handleSubmit}
          >
            {isSubmitting ? "Envoi du dessin…" : "Valider le dessin"}
          </button>
        </div>

        {sidebarFooter}

        {isSubmitting && (
          <p className="visually-hidden" role="status" aria-live="polite">
            Envoi du dessin au serveur en cours.
          </p>
        )}
      </aside>

      <GameDialog
        open={activeDialog === "submit"}
        title="Valider le dessin ?"
        description="Après validation, votre dessin sera envoyé aux autres joueurs et vous ne pourrez plus le modifier."
        confirmLabel="Valider mon dessin"
        cancelLabel="Continuer à dessiner"
        mascot={{ character: "pig", expression: "happy" }}
        isBusy={isSubmitting || disabled}
        onConfirm={confirmSubmit}
        onCancel={() => setActiveDialog(null)}
      />

      <GameDialog
        open={activeDialog === "clear"}
        title="Tout effacer ?"
        description="Tous les traits et remplissages de ce dessin seront supprimés."
        confirmLabel="Tout effacer"
        cancelLabel="Garder mon dessin"
        mascot={{ character: "poop", expression: "confused" }}
        tone="danger"
        isBusy={disabled}
        onConfirm={confirmClear}
        onCancel={() => setActiveDialog(null)}
      />
    </>
  );
}
