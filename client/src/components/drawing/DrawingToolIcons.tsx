interface DrawingToolIconProps {
  name: "pen" | "eraser" | "fill" | "undo" | "trash";
}

export function DrawingToolIcon({ name }: DrawingToolIconProps) {
  const commonProps = {
    className: "drawing-tool-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    focusable: false,
    "data-drawing-icon": name,
  };

  switch (name) {
    case "pen":
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="m4 20 4.2-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.2 16Z" />
          <path d="m14.8 6.4 3 3" />
        </svg>
      );
    case "eraser":
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="m7.2 18.5-3.1-3.1a2 2 0 0 1 0-2.8l7.5-7.5a2 2 0 0 1 2.8 0l4.5 4.5a2 2 0 0 1 0 2.8l-6.1 6.1Z" />
          <path d="m9.2 7.5 7.3 7.3" />
          <path d="M12.8 18.5H21" />
        </svg>
      );
    case "fill":
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="m13.4 4.4 6.2 6.2a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1 0-2.8l6.2-6.2a2 2 0 0 1 2.8 0Z" />
          <path d="m7 8 9 9" />
          <path d="M4 20h15" />
          <path d="M21 16.5c0 1.1-.9 2-2 2s-2-.9-2-2c0-.7.7-1.8 2-3.5 1.3 1.7 2 2.8 2 3.5Z" />
        </svg>
      );
    case "undo":
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="m9 7-5 5 5 5" />
          <path d="M20 17a7 7 0 0 0-7-7H4" />
        </svg>
      );
    case "trash":
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M4 7h16" />
          <path d="m9 7 .7-2h4.6l.7 2" />
          <path d="m6.5 7 .8 13h9.4l.8-13" />
          <path d="M10 11v5M14 11v5" />
        </svg>
      );
  }
}
