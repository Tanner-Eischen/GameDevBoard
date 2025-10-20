import sharp from "sharp";
import type { InsertTileset, MultiTileConfig, TilesetData, TilesetType } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { storage } from "../storage";

export type AutoCropMode = "detect" | "grid";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  pixelCount: number;
}

export interface AutoCropTilesetOptions {
  imageUrl: string;
  mode: AutoCropMode;
  tileSize: number;
  spacing?: number;
  minArea?: number;
  confirmOnly?: boolean;
  tilesetType?: TilesetType;
  namePrefix?: string;
  packId?: string | null;
  alphaThreshold?: number;
}

export type AutoCropTilesetResult =
  | { boundingBoxes: BoundingBox[] }
  | { tilesets: TilesetData[] };

const DEFAULT_ALPHA_THRESHOLD = 1;

export async function autoCropTileset({
  imageUrl,
  mode,
  tileSize,
  spacing = 0,
  minArea,
  confirmOnly = false,
  tilesetType = "multi-tile",
  namePrefix = "Auto Crop",
  packId = null,
  alphaThreshold = DEFAULT_ALPHA_THRESHOLD,
}: AutoCropTilesetOptions): Promise<AutoCropTilesetResult> {
  if (!imageUrl) {
    throw new Error("imageUrl is required for auto-cropping");
  }

  if (!tileSize || tileSize <= 0) {
    throw new Error("tileSize must be a positive number");
  }

  if (spacing < 0) {
    throw new Error("spacing cannot be negative");
  }

  const objectStorage = new ObjectStorageService();
  const sourceFile = await objectStorage.getObjectEntityFile(imageUrl);
  const [imageBuffer] = await sourceFile.download();

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Failed to download source image for auto-cropping");
  }

  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imageWidth = info.width ?? 0;
  const imageHeight = info.height ?? 0;

  if (imageWidth === 0 || imageHeight === 0) {
    throw new Error("Unable to determine source image dimensions");
  }

  const effectiveMinArea = Math.max(0, minArea ?? 0);
  const boundingBoxes =
    mode === "detect"
      ? detectObjects(data, info, {
          minArea: effectiveMinArea,
          alphaThreshold,
        })
      : sliceGrid(data, info, {
          tileSize,
          spacing,
          minArea: effectiveMinArea,
          alphaThreshold,
        });

  if (boundingBoxes.length === 0) {
    throw new Error("No tiles detected in the source image");
  }

  if (confirmOnly) {
    return { boundingBoxes };
  }

  const tilesetPayloads: InsertTileset[] = [];
  let index = 0;
  for (const box of boundingBoxes) {
    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
      .png()
      .toBuffer();

    const uploadUrl = await objectStorage.getObjectEntityUploadURL();
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: croppedBuffer,
      headers: {
        "Content-Type": "image/png",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to upload cropped tileset image (status: ${response.status})`
      );
    }

    const normalizedPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
    const columns = Math.max(1, Math.ceil(box.width / tileSize));
    const rows = Math.max(1, Math.ceil(box.height / tileSize));
    const multiTileConfig = buildMultiTileConfig(columns, rows);

    tilesetPayloads.push({
      name: `${namePrefix} ${++index}`,
      tileSize,
      spacing,
      imageUrl: normalizedPath,
      columns,
      rows,
      tilesetType,
      multiTileConfig,
      packId,
    });
  }

  const createdTilesets = await storage.createTilesetsBatch(tilesetPayloads);
  return { tilesets: createdTilesets };
}

function detectObjects(
  data: Buffer,
  info: sharp.OutputInfo,
  {
    minArea,
    alphaThreshold,
  }: {
    minArea: number;
    alphaThreshold: number;
  }
): BoundingBox[] {
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const channels = info.channels ?? 4;
  const visited = new Uint8Array(width * height);
  const results: BoundingBox[] = [];

  const getAlpha = (x: number, y: number) => {
    const idx = (y * width + x) * channels + (channels - 1);
    return data[idx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * width + x;
      if (visited[offset]) continue;
      visited[offset] = 1;

      if (getAlpha(x, y) <= alphaThreshold) {
        continue;
      }

      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let pixelCount = 0;

      const stack: Array<{ x: number; y: number }> = [{ x, y }];

      while (stack.length > 0) {
        const { x: cx, y: cy } = stack.pop()!;
        const coordOffset = cy * width + cx;
        if (visited[coordOffset] === 2) {
          continue;
        }
        visited[coordOffset] = 2;
        pixelCount++;

        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          { x: cx + 1, y: cy },
          { x: cx - 1, y: cy },
          { x: cx, y: cy + 1 },
          { x: cx, y: cy - 1 },
        ];

        for (const neighbor of neighbors) {
          if (
            neighbor.x < 0 ||
            neighbor.y < 0 ||
            neighbor.x >= width ||
            neighbor.y >= height
          ) {
            continue;
          }

          const neighborOffset = neighbor.y * width + neighbor.x;
          if (visited[neighborOffset]) {
            continue;
          }

          visited[neighborOffset] = 1;
          if (getAlpha(neighbor.x, neighbor.y) > alphaThreshold) {
            stack.push(neighbor);
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const area = boxWidth * boxHeight;

      if (area >= minArea) {
        results.push({
          x: minX,
          y: minY,
          width: boxWidth,
          height: boxHeight,
          area,
          pixelCount,
        });
      }
    }
  }

  return results.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}

function sliceGrid(
  data: Buffer,
  info: sharp.OutputInfo,
  {
    tileSize,
    spacing,
    minArea,
    alphaThreshold,
  }: {
    tileSize: number;
    spacing: number;
    minArea: number;
    alphaThreshold: number;
  }
): BoundingBox[] {
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const channels = info.channels ?? 4;
  const results: BoundingBox[] = [];
  const step = tileSize + spacing;

  const getAlpha = (x: number, y: number) => {
    const idx = (y * width + x) * channels + (channels - 1);
    return data[idx];
  };

  for (let top = 0; top + tileSize <= height; top += step) {
    for (let left = 0; left + tileSize <= width; left += step) {
      let pixelCount = 0;
      for (let py = 0; py < tileSize; py++) {
        for (let px = 0; px < tileSize; px++) {
          const alpha = getAlpha(left + px, top + py);
          if (alpha > alphaThreshold) {
            pixelCount++;
          }
        }
      }

      if (pixelCount === 0) {
        continue;
      }

      const area = tileSize * tileSize;
      if (area < minArea) {
        continue;
      }

      results.push({
        x: left,
        y: top,
        width: tileSize,
        height: tileSize,
        area,
        pixelCount,
      });
    }
  }

  return results;
}

function buildMultiTileConfig(columns: number, rows: number): MultiTileConfig {
  const tiles: MultiTileConfig["tiles"] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      tiles.push({ x, y });
    }
  }
  return { tiles };
}
