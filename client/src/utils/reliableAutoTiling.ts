import type { Tile } from '@shared/schema';

/**
 * Reliable 3x3 auto-tiling system
 * 
 * This is a simplified but robust autotiling implementation that handles
 * the most common use cases without complex dependencies.
 * 
 * Tileset layout (indices):
 * 0 1 2
 * 3 4 5  
 * 6 7 8
 * 
 * Bitmask algorithm maps 4-neighbor patterns to tile indices
 */

interface NeighborConfig {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

// Reliable bitmask to tile index lookup
const BITMASK_TO_TILE: number[] = [
  4,  // 0000 (no neighbors) → center/isolated
  7,  // 0001 (N) → bottom edge
  3,  // 0010 (E) → left edge
  6,  // 0011 (N+E) → bottom-left corner
  1,  // 0100 (S) → top edge
  4,  // 0101 (N+S) → vertical center
  0,  // 0110 (E+S) → top-left corner
  3,  // 0111 (N+E+S) → left edge
  5,  // 1000 (W) → right edge
  8,  // 1001 (N+W) → bottom-right corner
  4,  // 1010 (E+W) → horizontal center
  7,  // 1011 (N+E+W) → bottom edge
  2,  // 1100 (S+W) → top-right corner
  5,  // 1101 (N+S+W) → right edge
  1,  // 1110 (E+S+W) → top edge
  4,  // 1111 (all) → center
];

/**
 * Calculate the correct tile index based on neighbor configuration
 */
export function calculateReliableAutoTileIndex(neighbors: NeighborConfig): number {
  const bitmask =
    (neighbors.top ? 1 : 0) |
    (neighbors.right ? 2 : 0) |
    (neighbors.bottom ? 4 : 0) |
    (neighbors.left ? 8 : 0);

  return BITMASK_TO_TILE[bitmask];
}

/**
 * Get neighbor configuration for a tile position
 * Only considers tiles from the same tileset and layer
 */
export function getReliableNeighborConfig(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[],
  layer: 'terrain' | 'props' = 'terrain'
): NeighborConfig {
  const hasTileAt = (tx: number, ty: number) => {
    return tiles.some(
      (t) => t.x === tx && t.y === ty && t.tilesetId === tilesetId && t.layer === layer
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
 * Get all tiles that need updating when a tile is added or removed
 * Returns a clean, predictable set of updates
 */
export function getReliableTilesToUpdate(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[],
  includeSelf: boolean = true,
  layer: 'terrain' | 'props' = 'terrain'
): Array<{ x: number; y: number; tileIndex: number; tilesetId: string }> {
  const updates: Array<{ x: number; y: number; tileIndex: number; tilesetId: string }> = [];

  // Define positions to check (center + 4 neighbors)
  const positions = [
    { x, y: y - 1 }, // Top
    { x, y: y + 1 }, // Bottom
    { x: x - 1, y }, // Left
    { x: x + 1, y }, // Right
  ];

  if (includeSelf) {
    positions.push({ x, y }); // Center
  }

  // Update each position that has a tile of the same type
  for (const pos of positions) {
    const tilesAtPosition = tiles.filter(
      (t) => t.x === pos.x && t.y === pos.y && t.tilesetId === tilesetId && t.layer === layer
    );

    // Update each tile at this position
    for (const tile of tilesAtPosition) {
      const neighbors = getReliableNeighborConfig(pos.x, pos.y, tilesetId, tiles, layer);
      const tileIndex = calculateReliableAutoTileIndex(neighbors);
      
      updates.push({
        x: pos.x,
        y: pos.y,
        tileIndex,
        tilesetId: tile.tilesetId,
      });
    }

    // If no tile exists at this position but it's the center and we want to include self
    if (tilesAtPosition.length === 0 && pos.x === x && pos.y === y && includeSelf) {
      const neighbors = getReliableNeighborConfig(pos.x, pos.y, tilesetId, tiles, layer);
      const tileIndex = calculateReliableAutoTileIndex(neighbors);
      
      updates.push({
        x: pos.x,
        y: pos.y,
        tileIndex,
        tilesetId,
      });
    }
  }

  return updates;
}

/**
 * Batch update multiple tile positions efficiently
 * Useful for brush painting multiple tiles at once
 */
export function getReliableBatchTileUpdates(
  positions: Array<{ x: number; y: number }>,
  tilesetId: string,
  existingTiles: Tile[],
  layer: 'terrain' | 'props' = 'terrain'
): Array<{ x: number; y: number; tileIndex: number; tilesetId: string }> {
  const allUpdates = new Map<string, { x: number; y: number; tileIndex: number; tilesetId: string }>();

  // Simulate adding all new tiles to the tile array
  const simulatedTiles = [...existingTiles];
  positions.forEach(pos => {
    // Add placeholder tiles for calculation
    simulatedTiles.push({
      x: pos.x,
      y: pos.y,
      tilesetId,
      tileIndex: 4, // Temporary center tile
      layer,
    });
  });

  // Calculate updates for each position and its neighbors
  positions.forEach(pos => {
    const updates = getReliableTilesToUpdate(
      pos.x,
      pos.y,
      tilesetId,
      simulatedTiles,
      true,
      layer
    );

    updates.forEach(update => {
      const key = `${update.x},${update.y},${update.tilesetId}`;
      allUpdates.set(key, update);
    });
  });

  return Array.from(allUpdates.values());
}

/**
 * Validate that a tileset is compatible with autotiling
 */
export function validateAutoTileset(tileset: any): boolean {
  if (!tileset) return false;
  if (tileset.tilesetType !== 'auto-tiling') return false;
  if (!tileset.imageUrl) return false;
  if (tileset.rows !== 3 || tileset.columns !== 3) return false;
  return true;
}

/**
 * Debug helper to visualize neighbor patterns
 */
export function debugNeighborPattern(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[],
  layer: 'terrain' | 'props' = 'terrain'
): void {
  const neighbors = getReliableNeighborConfig(x, y, tilesetId, tiles, layer);
  const tileIndex = calculateReliableAutoTileIndex(neighbors);
  
  console.log(`Autotiling debug for (${x}, ${y}):`);
  console.log(`  Neighbors: T=${neighbors.top}, R=${neighbors.right}, B=${neighbors.bottom}, L=${neighbors.left}`);
  console.log(`  Calculated tile index: ${tileIndex}`);
  console.log(`  Bitmask: ${(neighbors.top ? 1 : 0) | (neighbors.right ? 2 : 0) | (neighbors.bottom ? 4 : 0) | (neighbors.left ? 8 : 0)}`);
}