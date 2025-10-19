import type { Tile } from '@shared/schema';

/**
 * 3x3 auto-tiling system using 4-neighbor bitmask algorithm
 * 
 * Tileset layout (indices):
 * 0 1 2
 * 3 4 5
 * 6 7 8
 * 
 * Bitmask bits:
 * - North (top) = 1
 * - East (right) = 2
 * - South (bottom) = 4
 * - West (left) = 8
 * 
 * Bitmask value (0-15) maps to tile index (0-8)
 */

interface NeighborConfig {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Bitmask to tile index lookup table
 * Maps 4-neighbor bitmask (0-15) to 3x3 tile index (0-8)
 */
const BITMASK_TO_TILE: number[] = [
  4,  // 0000 (no neighbors) → center/isolated
  7,  // 0001 (N) → bottom edge
  3,  // 0010 (E) → left edge
  6,  // 0011 (N+E) → bottom-left corner
  1,  // 0100 (S) → top edge
  4,  // 0101 (N+S) → center (vertical)
  0,  // 0110 (E+S) → top-left corner
  3,  // 0111 (N+E+S) → left edge
  5,  // 1000 (W) → right edge
  8,  // 1001 (N+W) → bottom-right corner
  4,  // 1010 (E+W) → center (horizontal)
  7,  // 1011 (N+E+W) → bottom edge
  2,  // 1100 (S+W) → top-right corner
  5,  // 1101 (N+S+W) → right edge
  1,  // 1110 (E+S+W) → top edge
  4,  // 1111 (all) → center
];

/**
 * Calculate the correct tile index based on neighbor configuration using bitmask
 */
export function calculateAutoTileIndex(neighbors: NeighborConfig): number {
  // Calculate bitmask: N=1, E=2, S=4, W=8
  const bitmask =
    (neighbors.top ? 1 : 0) |
    (neighbors.right ? 2 : 0) |
    (neighbors.bottom ? 4 : 0) |
    (neighbors.left ? 8 : 0);

  return BITMASK_TO_TILE[bitmask];
}

/**
 * Get the neighbor configuration for a tile at the given position
 * For both terrain and props tiles, only considers tiles from the same tileset as neighbors
 * This creates proper edges when different terrain types meet
 */
export function getNeighborConfig(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[],
  layer?: 'terrain' | 'props'
): NeighborConfig {
  // Determine if the current tile is terrain or props
  // Use explicit layer parameter if provided, otherwise try to find the tile
  let isTerrainLayer: boolean;
  if (layer !== undefined) {
    isTerrainLayer = layer === 'terrain';
  } else {
    const currentTile = tiles.find(t => t.x === x && t.y === y && t.tilesetId === tilesetId);
    isTerrainLayer = currentTile?.layer === 'terrain';
  }

  const hasTileAt = (tx: number, ty: number) => {
    if (isTerrainLayer) {
      // For terrain tiles: only consider tiles from the SAME tileset as neighbors
      // This creates proper edges when different terrain types meet
      return tiles.some(
        (t) => t.x === tx && t.y === ty && t.tilesetId === tilesetId && t.layer === 'terrain'
      );
    } else {
      // For props tiles: only consider tiles from the same tileset
      return tiles.some(
        (t) => t.x === tx && t.y === ty && t.tilesetId === tilesetId
      );
    }
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
 * For terrain tiles, this also updates neighboring tiles of different terrain types
 * to create proper edges (e.g., water edges when grass is painted next to water)
 */
export function getTilesToUpdate(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[],
  includeSelf: boolean = true,
  layer?: 'terrain' | 'props'
): Array<{ x: number; y: number; tileIndex: number; tilesetId: string }> {
  const updates: Array<{ x: number; y: number; tileIndex: number; tilesetId: string }> = [];

  // Determine if this is a terrain or props tile
  // Use explicit layer parameter if provided, otherwise try to find the tile in the array
  let isTerrainLayer: boolean;
  if (layer !== undefined) {
    isTerrainLayer = layer === 'terrain';
  } else {
    const currentTile = tiles.find(t => t.x === x && t.y === y && t.tilesetId === tilesetId);
    isTerrainLayer = currentTile?.layer === 'terrain';
  }

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
    if (isTerrainLayer) {
      // For terrain tiles: update ALL terrain tiles at neighboring positions (cross-tileset)
      const tilesAtPosition = tiles.filter(
        (t) => t.x === pos.x && t.y === pos.y && t.layer === 'terrain'
      );
      
      for (const tile of tilesAtPosition) {
        const neighbors = getNeighborConfig(pos.x, pos.y, tile.tilesetId, tiles, 'terrain');
        const tileIndex = calculateAutoTileIndex(neighbors);
        updates.push({ x: pos.x, y: pos.y, tileIndex, tilesetId: tile.tilesetId });
      }
      
      // If no tile at position but includeSelf and it's the center, add it
      if (tilesAtPosition.length === 0 && pos.x === x && pos.y === y && includeSelf) {
        const neighbors = getNeighborConfig(pos.x, pos.y, tilesetId, tiles, 'terrain');
        const tileIndex = calculateAutoTileIndex(neighbors);
        updates.push({ x: pos.x, y: pos.y, tileIndex, tilesetId });
      }
    } else {
      // For props tiles: only update tiles from the same tileset (original behavior)
      const existingTile = tiles.find(
        (t) => t.x === pos.x && t.y === pos.y && t.tilesetId === tilesetId
      );

      if (existingTile || (pos.x === x && pos.y === y && includeSelf)) {
        const neighbors = getNeighborConfig(pos.x, pos.y, tilesetId, tiles, 'props');
        const tileIndex = calculateAutoTileIndex(neighbors);
        updates.push({ x: pos.x, y: pos.y, tileIndex, tilesetId });
      }
    }
  }

  return updates;
}
