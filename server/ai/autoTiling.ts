import type { Tile } from "@shared/schema";

/**
 * Server-side 3x3 auto-tiling system using 4-neighbor bitmask algorithm
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
function calculateAutoTileIndex(neighbors: NeighborConfig): number {
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
function getNeighborConfig(
  x: number,
  y: number,
  tilesetId: string,
  tiles: Tile[],
  layer: 'terrain' | 'props'
): NeighborConfig {
  const hasTileAt = (tx: number, ty: number) => {
    if (layer === 'terrain') {
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
 * Apply auto-tiling to a set of new tiles and their neighbors
 * Returns all tiles that need to be added/updated with correct auto-tiling indices
 * Creates proper edges when different terrain types meet
 */
export function applyAutoTiling(
  newTiles: Tile[],
  existingTiles: Tile[],
  tilesetId: string
): Tile[] {
  // Filter to only terrain tiles for neighbor checking
  const terrainTiles = [...existingTiles, ...newTiles].filter(t => t.layer === 'terrain');
  
  // Create a combined tile map
  const tileMap = new Map<string, Tile>();
  terrainTiles.forEach(t => {
    tileMap.set(`${t.x},${t.y}`, t);
  });
  
  const allTiles = Array.from(tileMap.values());
  
  // Collect all tiles that need auto-tiling updates
  const tilesToUpdate = new Map<string, Tile>();
  
  // For each new tile, update it and its neighbors
  newTiles.forEach(newTile => {
    const positions = [
      { x: newTile.x, y: newTile.y },     // Self
      { x: newTile.x, y: newTile.y - 1 }, // Top
      { x: newTile.x, y: newTile.y + 1 }, // Bottom
      { x: newTile.x - 1, y: newTile.y }, // Left
      { x: newTile.x + 1, y: newTile.y }, // Right
    ];
    
    positions.forEach(pos => {
      // For terrain tiles: update ALL terrain tiles at neighboring positions (cross-tileset)
      const tilesAtPosition = allTiles.filter(
        (t) => t.x === pos.x && t.y === pos.y && t.layer === 'terrain'
      );
      
      for (const tile of tilesAtPosition) {
        const key = `${pos.x},${pos.y},${tile.tilesetId}`;
        const neighbors = getNeighborConfig(pos.x, pos.y, tile.tilesetId, allTiles, 'terrain');
        const tileIndex = calculateAutoTileIndex(neighbors);
        
        tilesToUpdate.set(key, {
          x: pos.x,
          y: pos.y,
          tilesetId: tile.tilesetId,
          tileIndex,
          layer: 'terrain',
        });
      }
      
      // If no tile at position but it's the center, add it
      if (tilesAtPosition.length === 0 && pos.x === newTile.x && pos.y === newTile.y) {
        const key = `${pos.x},${pos.y},${tilesetId}`;
        const neighbors = getNeighborConfig(pos.x, pos.y, tilesetId, allTiles, 'terrain');
        const tileIndex = calculateAutoTileIndex(neighbors);
        
        tilesToUpdate.set(key, {
          x: pos.x,
          y: pos.y,
          tilesetId,
          tileIndex,
          layer: 'terrain',
        });
      }
    });
  });
  
  return Array.from(tilesToUpdate.values());
}
