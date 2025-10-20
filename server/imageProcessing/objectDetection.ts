import sharp from "sharp";

/**
 * Options for the connected-component object detector.
 */
export interface DetectionOptions {
  /** Minimum number of non-transparent pixels required for a region to be emitted. */
  minArea?: number;
  /** Optional base tile size (square) used to derive tile counts. */
  tileSize?: number | { width: number; height: number };
  /** Spacing in pixels between tiles when deriving tile counts. */
  spacing?: number;
  /** Alpha threshold between 0-255 that marks a pixel as opaque. */
  alphaThreshold?: number;
}

/**
 * Options for slicing a spritesheet or tilemap into a regular grid.
 */
export interface SliceGridOptions {
  tileSize: number | { width: number; height: number };
  rows: number;
  columns: number;
  spacing?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * A detected object's placement and derived sizing metadata.
 */
export interface DetectedObject {
  /** The x coordinate (in pixels) of the object's left edge. */
  x: number;
  /** The y coordinate (in pixels) of the object's top edge. */
  y: number;
  /** Width of the object's bounding box in pixels. */
  width: number;
  /** Height of the object's bounding box in pixels. */
  height: number;
  /** Number of pixels wide for the object. Mirrors {@link width} for clarity. */
  pixelWidth: number;
  /** Number of pixels tall for the object. Mirrors {@link height}. */
  pixelHeight: number;
  /** Optional base tile width used when deriving {@link columns}. */
  baseTileWidth?: number;
  /** Optional base tile height used when deriving {@link rows}. */
  baseTileHeight?: number;
  /** Number of tiles horizontally that cover the object (if tile size provided). */
  columns?: number;
  /** Number of tiles vertically that cover the object (if tile size provided). */
  rows?: number;
}

interface InternalTileSize {
  width: number;
  height: number;
}

interface FloodFillResult {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const DEFAULT_ALPHA_THRESHOLD = 1;

function normalizeTileSize(tileSize?: number | { width: number; height: number }): InternalTileSize | undefined {
  if (tileSize == null) {
    return undefined;
  }

  if (typeof tileSize === "number") {
    return { width: tileSize, height: tileSize };
  }

  const { width, height } = tileSize;
  if (width <= 0 || height <= 0) {
    throw new Error("tileSize width and height must be positive numbers");
  }

  return { width, height };
}

async function decodeToRgba(buffer: Buffer) {
  return sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

function buildAlphaMask(data: Buffer, width: number, height: number, channels: number, alphaThreshold: number) {
  const alphaIndex = channels - 1;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const alpha = data[i * channels + alphaIndex];
    if (alpha >= alphaThreshold) {
      mask[i] = 1;
    }
  }

  return mask;
}

function floodFill(startIndex: number, width: number, height: number, mask: Uint8Array, visited: Uint8Array): FloodFillResult {
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  queue[tail++] = startIndex;
  visited[startIndex] = 1;

  let area = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  const deltas = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);

    area += 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    for (const { dx, dy } of deltas) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const neighborIndex = ny * width + nx;
      if (visited[neighborIndex] || mask[neighborIndex] === 0) {
        continue;
      }
      visited[neighborIndex] = 1;
      queue[tail++] = neighborIndex;
    }
  }

  return { area, minX, minY, maxX, maxY };
}

function createDetectedObject(bounds: FloodFillResult, tile: InternalTileSize | undefined, spacing: number): DetectedObject {
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const detected: DetectedObject = {
    x: bounds.minX,
    y: bounds.minY,
    width,
    height,
    pixelWidth: width,
    pixelHeight: height,
  };

  if (tile) {
    const columns = Math.max(1, Math.round((width + spacing) / (tile.width + spacing)));
    const rows = Math.max(1, Math.round((height + spacing) / (tile.height + spacing)));

    detected.baseTileWidth = tile.width;
    detected.baseTileHeight = tile.height;
    detected.columns = columns;
    detected.rows = rows;
  }

  return detected;
}

/**
 * Detects contiguous non-transparent regions from a PNG buffer using
 * connected-component labelling. Returns bounding boxes for regions whose
 * area is above {@link DetectionOptions.minArea}.
 */
export async function detectObjects(buffer: Buffer, options: DetectionOptions = {}): Promise<DetectedObject[]> {
  const { minArea = 1, spacing = 0, alphaThreshold = DEFAULT_ALPHA_THRESHOLD } = options;
  if (minArea < 1) {
    throw new Error("minArea must be at least 1");
  }
  if (spacing < 0) {
    throw new Error("spacing must be non-negative");
  }

  const tile = normalizeTileSize(options.tileSize);
  const { data, info } = await decodeToRgba(buffer);
  const { width, height, channels } = info;

  if (!width || !height || !channels) {
    throw new Error("Unable to determine image dimensions");
  }

  const mask = buildAlphaMask(data, width, height, channels, alphaThreshold);
  const visited = new Uint8Array(width * height);
  const results: DetectedObject[] = [];

  for (let index = 0; index < mask.length; index++) {
    if (mask[index] === 0 || visited[index]) {
      continue;
    }

    const bounds = floodFill(index, width, height, mask, visited);
    if (bounds.area < minArea) {
      continue;
    }

    results.push(createDetectedObject(bounds, tile, spacing));
  }

  return results.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}

/**
 * Slices an image buffer into an axis-aligned grid of tiles using the
 * provided tile dimensions and spacing. Returns the bounding boxes in the
 * same {@link DetectedObject} format as {@link detectObjects}.
 */
export async function sliceGrid(buffer: Buffer, { tileSize, rows, columns, spacing = 0, offsetX = 0, offsetY = 0 }: SliceGridOptions): Promise<DetectedObject[]> {
  if (rows <= 0 || columns <= 0) {
    throw new Error("rows and columns must be positive integers");
  }
  if (spacing < 0) {
    throw new Error("spacing must be non-negative");
  }

  const tile = normalizeTileSize(tileSize);
  if (!tile) {
    throw new Error("tileSize is required for sliceGrid");
  }

  const { info } = await decodeToRgba(buffer);
  const { width: imageWidth, height: imageHeight } = info;
  if (!imageWidth || !imageHeight) {
    throw new Error("Unable to determine image dimensions");
  }

  const results: DetectedObject[] = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = offsetX + column * (tile.width + spacing);
      const y = offsetY + row * (tile.height + spacing);

      if (x + tile.width > imageWidth || y + tile.height > imageHeight) {
        continue;
      }

      results.push({
        x,
        y,
        width: tile.width,
        height: tile.height,
        pixelWidth: tile.width,
        pixelHeight: tile.height,
        baseTileWidth: tile.width,
        baseTileHeight: tile.height,
        columns: 1,
        rows: 1,
      });
    }
  }

  return results;
}

export type { InternalTileSize as NormalizedTileSize };
