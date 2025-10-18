import type { Tile } from '@shared/schema';

/**
 * 3x3 auto-tiling system
 * 
 * Tileset layout (indices):
 * 0 1 2
 * 3 4 5
 * 6 7 8
 * 
 * Each tile represents a neighbor configuration:
 * - 0: Top-left corner (neighbors: right, bottom)
 * - 1: Top edge (neighbors: left, right, bottom)
 * - 2: Top-right corner (neighbors: left, bottom)
 * - 3: Left edge (neighbors: top, right, bottom)
 * - 4: Center/full (neighbors: all sides)
 * - 5: Right edge (neighbors: top, left, bottom)
 * - 6: Bottom-left corner (neighbors: top, right)
 * - 7: Bottom edge (neighbors: top, left, right)
 * - 8: Bottom-right corner (neighbors: top, left)
 */

interface NeighborConfig {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Calculate the correct tile index based on neighbor configuration
 */
export function calculateAutoTileIndex(neighbors: NeighborConfig): number {
  const { top, bottom, left, right } = neighbors;

  // All four sides have neighbors = center tile
  if (top && bottom && left && right) return 4;

  // Three neighbors
  if (top && left && right && !bottom) return 1; // Top edge
  if (top && bottom && left && !right) return 3; // Left edge
  if (top && bottom && right && !left) return 5; // Right edge
  if (bottom && left && right && !top) return 7; // Bottom edge

  // Two neighbors (corners)
  if (right && bottom && !top && !left) return 0; // Top-left corner
  if (left && bottom && !top && !right) return 2; // Top-right corner
  if (top && right && !bottom && !left) return 6; // Bottom-left corner
  if (top && left && !bottom && !right) return 8; // Bottom-right corner

  // Two neighbors (opposite sides) - use center
  if (top && bottom && !left && !right) return 4; // Vertical center
  if (left && right && !top && !bottom) return 4; // Horizontal center

  // One neighbor - use appropriate edge tile facing the neighbor
  if (bottom && !top && !left && !right) return 1; // Top edge (neighbor below)
  if (top && !bottom && !left && !right) return 7; // Bottom edge (neighbor above)
  if (right && !top && !bottom && !left) return 3; // Left edge (neighbor to right)
  if (left && !top && !bottom && !right) return 5; // Right edge (neighbor to left)

  // No neighbors = isolated tile, use center
  return 4;
}

/**
 * Get the neighbor configuration for a tile at the given position
 */
export function getNeighborConfig(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[]
): NeighborConfig {
  const hasTileAt = (tx: number, ty: number) => {
    return tiles.some(
      (t) => t.x === tx && t.y === ty && t.tilesetId === tilesetId
    );
  };

  return {
    top: hasTileAt(x, y - 1),
    bottom: hasTileAt(x, y + 1),
    left: hasTileAt(x - 1, y),
    right: hasTileAt(x + 1, y),
  };
}

/**
 * Get all tiles that need to be updated when a tile is added/removed
 */
export function getTilesToUpdate(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[],
  includeSelf: boolean = true
): Array<{ x: number; y: number; tileIndex: number }> {
  const updates: Array<{ x: number; y: number; tileIndex: number }> = [];

  // Update surrounding tiles (N, S, E, W)
  const positions = [
    { x, y: y - 1 }, // Top
    { x, y: y + 1 }, // Bottom
    { x: x - 1, y }, // Left
    { x: x + 1, y }, // Right
  ];

  if (includeSelf) {
    positions.push({ x, y }); // Center
  }

  for (const pos of positions) {
    const existingTile = tiles.find(
      (t) => t.x === pos.x && t.y === pos.y && t.tilesetId === tilesetId
    );

    if (existingTile || (pos.x === x && pos.y === y && includeSelf)) {
      const neighbors = getNeighborConfig(pos.x, pos.y, tilesetId, tiles);
      const tileIndex = calculateAutoTileIndex(neighbors);
      updates.push({ x: pos.x, y: pos.y, tileIndex });
    }
  }

  return updates;
}
