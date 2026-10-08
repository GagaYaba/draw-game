import type { CSSProperties } from "react";

import {
  DRAWING_ALLOWED_STROKE_WIDTHS,
  DRAWING_COLOR_PALETTE,
  type DrawingColor,
  type DrawingStrokeWidth,
  type DrawingTool,
} from "@drawing-game/shared";

import { DrawingToolIcon } from "./DrawingToolIcons";
import "./DrawingTools.css";

const COLOR_LABELS: Record<DrawingColor, string> = {
  "#111111": "Noir",
  "#616161": "Gris",
  "#BDBDBD": "Gris clair",
  "#FFFFFF": "Blanc",
  "#C62828": "Rouge foncé",
  "#E53935": "Rouge",
  "#FB8C00": "Orange",
  "#FDD835": "Jaune",
  "#2E7D32": "Vert foncé",
  "#43A047": "Vert",
  "#00897B": "Turquoise",
  "#00ACC1": "Cyan",
  "#1565C0": "Bleu foncé",
  "#1E88E5": "Bleu",
  "#6A1B9A": "Violet foncé",
  "#8E24AA": "Violet",
};

const TOOL_LABELS: Record<DrawingTool, string> = {
  pen: "stylo",
  eraser: "gomme",
  fill: "pot de peinture",
};

const WIDTH_LABELS: Record<DrawingStrokeWidth, string> = {
  4: "Fin",
  8: "Moyen",
  14: "Épais",
};

function isLightColor(color: DrawingColor): boolean {
  return color === "#BDBDBD" || color === "#FFFFFF" || color === "#FDD835";
}

interface DrawingToolbarProps {
  selectedTool: DrawingTool;
  selectedColor: DrawingColor;
  selectedWidth: DrawingStrokeWidth;
  canUndo: boolean;
  disabled: boolean;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: DrawingColor) => void;
  onWidthChange: (width: DrawingStrokeWidth) => void;
  onUndo: () => void;
  onClear: () => void;
}

export function DrawingToolbar({
  selectedTool,
  selectedColor,
  selectedWidth,
  canUndo,
  disabled,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onClear,
}: DrawingToolbarProps) {
  return (
    <div className="drawing-toolbar drawing-tools" role="group" aria-label="Outils de dessin">
      <fieldset className="toolbar-group toolbar-group--tools">
        <legend>Outil</legend>
        <div className="toolbar-options toolbar-options--tools">
          <button
            className="tool-button tool-button--icon"
            type="button"
            aria-label="Stylo"
            aria-pressed={selectedTool === "pen"}
            title="Stylo"
            disabled={disabled}
            onClick={() => onToolChange("pen")}
          >
            <DrawingToolIcon name="pen" />
          </button>
          <button
            className="tool-button tool-button--icon"
            type="button"
            aria-label="Gomme"
            aria-pressed={selectedTool === "eraser"}
            title="Gomme"
            disabled={disabled}
            onClick={() => onToolChange("eraser")}
          >
            <DrawingToolIcon name="eraser" />
          </button>
          <button
            className="tool-button tool-button--icon"
            type="button"
            aria-label="Pot de peinture"
            aria-pressed={selectedTool === "fill"}
            title="Pot de peinture"
            disabled={disabled}
            onClick={() => onToolChange("fill")}
          >
            <DrawingToolIcon name="fill" />
          </button>
        </div>
      </fieldset>

      <fieldset className="toolbar-group toolbar-group--colors">
        <legend>Couleur</legend>
        <div className="toolbar-options toolbar-options--colors">
          {DRAWING_COLOR_PALETTE.map((color) => {
            const isSelected = selectedColor === color;
            const style = { "--swatch-color": color } as CSSProperties;

            return (
              <button
                key={color}
                className={`color-button${isLightColor(color) ? " color-button--light" : ""}`}
                style={style}
                type="button"
                aria-label={`Couleur ${COLOR_LABELS[color]}`}
                aria-pressed={isSelected}
                title={COLOR_LABELS[color]}
                disabled={disabled}
                onClick={() => onColorChange(color)}
              >
                <span className="color-swatch" aria-hidden="true" />
                <span className="color-selection-mark" aria-hidden="true">
                  {isSelected ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset
        className="toolbar-group toolbar-group--widths"
        aria-disabled={selectedTool === "fill"}
      >
        <legend>Taille</legend>
        <div className="toolbar-options toolbar-options--widths">
          {DRAWING_ALLOWED_STROKE_WIDTHS.map((width) => (
            <button
              key={width}
              className="tool-button"
              type="button"
              aria-pressed={selectedWidth === width}
              disabled={disabled || selectedTool === "fill"}
              onClick={() => onWidthChange(width)}
            >
              {WIDTH_LABELS[width]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="toolbar-history-actions" aria-label="Actions du dessin">
        <button
          className="tool-button tool-button--icon"
          type="button"
          aria-label="Annuler"
          title="Annuler"
          disabled={disabled || !canUndo}
          onClick={onUndo}
        >
          <DrawingToolIcon name="undo" />
        </button>
        <button
          className="tool-button tool-button--icon tool-button--danger"
          type="button"
          aria-label="Tout effacer"
          title="Tout effacer"
          disabled={disabled || !canUndo}
          onClick={onClear}
        >
          <DrawingToolIcon name="trash" />
        </button>
      </div>

      <p className="toolbar-selection" aria-live="polite">
        Outil : {TOOL_LABELS[selectedTool]}. Couleur : {COLOR_LABELS[selectedColor]}.
        {selectedTool !== "fill" && <> Taille : {WIDTH_LABELS[selectedWidth]}.</>}
      </p>
    </div>
  );
}
