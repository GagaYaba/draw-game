import type { DrawingColor, DrawingPoint } from "@drawing-game/shared";

interface RgbaColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function parseHexColor(color: DrawingColor): RgbaColor {
  return {
    red: Number.parseInt(color.slice(1, 3), 16),
    green: Number.parseInt(color.slice(3, 5), 16),
    blue: Number.parseInt(color.slice(5, 7), 16),
    alpha: 255,
  };
}

function pixelMatches(pixels: Uint8ClampedArray, offset: number, color: RgbaColor): boolean {
  return (
    pixels[offset] === color.red &&
    pixels[offset + 1] === color.green &&
    pixels[offset + 2] === color.blue &&
    pixels[offset + 3] === color.alpha
  );
}

function writePixel(pixels: Uint8ClampedArray, offset: number, color: RgbaColor): void {
  pixels[offset] = color.red;
  pixels[offset + 1] = color.green;
  pixels[offset + 2] = color.blue;
  pixels[offset + 3] = color.alpha;
}

function getPixelOffset(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function clampSeedCoordinate(value: number, size: number): number {
  return Math.min(size - 1, Math.max(0, Math.floor(value * size)));
}

/**
 * Applies a deterministic four-connected scanline fill to an ImageData-like
 * buffer. Exact RGBA matching keeps antialiased stroke boundaries intact.
 */
export function floodFillImageData(
  imageData: ImageData,
  seed: DrawingPoint,
  color: DrawingColor,
): boolean {
  const { data: pixels, width, height } = imageData;
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    return false;
  }

  const seedX = clampSeedCoordinate(seed.x, width);
  const seedY = clampSeedCoordinate(seed.y, height);
  const targetOffset = getPixelOffset(seedX, seedY, width);
  const targetColor: RgbaColor = {
    red: pixels[targetOffset] ?? 0,
    green: pixels[targetOffset + 1] ?? 0,
    blue: pixels[targetOffset + 2] ?? 0,
    alpha: pixels[targetOffset + 3] ?? 0,
  };
  const replacementColor = parseHexColor(color);

  if (
    targetColor.red === replacementColor.red &&
    targetColor.green === replacementColor.green &&
    targetColor.blue === replacementColor.blue &&
    targetColor.alpha === replacementColor.alpha
  ) {
    return false;
  }

  const pendingCoordinates: number[] = [seedX, seedY];

  while (pendingCoordinates.length > 0) {
    const y = pendingCoordinates.pop();
    const x = pendingCoordinates.pop();
    if (x === undefined || y === undefined) {
      break;
    }

    if (!pixelMatches(pixels, getPixelOffset(x, y, width), targetColor)) {
      continue;
    }

    let left = x;
    while (left > 0 && pixelMatches(pixels, getPixelOffset(left - 1, y, width), targetColor)) {
      left -= 1;
    }

    let right = x;
    while (
      right < width - 1 &&
      pixelMatches(pixels, getPixelOffset(right + 1, y, width), targetColor)
    ) {
      right += 1;
    }

    let hasPendingAbove = false;
    let hasPendingBelow = false;

    for (let currentX = left; currentX <= right; currentX += 1) {
      writePixel(pixels, getPixelOffset(currentX, y, width), replacementColor);

      if (y > 0) {
        const matchesAbove = pixelMatches(
          pixels,
          getPixelOffset(currentX, y - 1, width),
          targetColor,
        );
        if (matchesAbove && !hasPendingAbove) {
          pendingCoordinates.push(currentX, y - 1);
        }
        hasPendingAbove = matchesAbove;
      }

      if (y < height - 1) {
        const matchesBelow = pixelMatches(
          pixels,
          getPixelOffset(currentX, y + 1, width),
          targetColor,
        );
        if (matchesBelow && !hasPendingBelow) {
          pendingCoordinates.push(currentX, y + 1);
        }
        hasPendingBelow = matchesBelow;
      }
    }
  }

  return true;
}

export function renderBucketFill(
  context: CanvasRenderingContext2D,
  seed: DrawingPoint,
  color: DrawingColor,
): boolean {
  const { width, height } = context.canvas;
  if (width <= 0 || height <= 0) {
    return false;
  }

  try {
    const imageData = context.getImageData(0, 0, width, height);
    if (!floodFillImageData(imageData, seed, color)) {
      return false;
    }

    context.putImageData(imageData, 0, 0);
    return true;
  } catch {
    // A canvas read can fail in hardened browser contexts. Drawing must remain
    // usable even when the optional bucket operation cannot be applied.
    return false;
  }
}
