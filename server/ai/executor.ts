import type { CanvasState, TileMap, Shape, Tile } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

// AI function execution results
export interface ExecutionResult {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  canvasUpdates?: {
    shapes?: Shape[];
    tiles?: Tile[];
  };
}

// Paint terrain on the canvas
export function executePaintTerrain(
  params: {
    tilesetName: string;
    area: { x: number; y: number; width: number; height: number };
    pattern: string;
  },
  canvasState: CanvasState,
  tileMap: TileMap,
  tilesets: Array<{ id: string; name: string }>
): ExecutionResult {
  const tileset = tilesets.find(t => t.name === params.tilesetName);
  
  if (!tileset) {
    return {
      success: false,
      message: `Tileset "${params.tilesetName}" not found`
    };
  }

  const newTiles: Tile[] = [];
  const { x, y, width, height } = params.area;

  if (params.pattern === "fill") {
    // Fill entire area
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        newTiles.push({
          x: x + dx,
          y: y + dy,
          tilesetId: tileset.id,
          tileIndex: 4 // Center tile for auto-tiling
        });
      }
    }
  } else if (params.pattern === "border") {
    // Paint border only
    for (let dx = 0; dx < width; dx++) {
      newTiles.push({ x: x + dx, y, tilesetId: tileset.id, tileIndex: 4 });
      newTiles.push({ x: x + dx, y: y + height - 1, tilesetId: tileset.id, tileIndex: 4 });
    }
    for (let dy = 1; dy < height - 1; dy++) {
      newTiles.push({ x, y: y + dy, tilesetId: tileset.id, tileIndex: 4 });
      newTiles.push({ x: x + width - 1, y: y + dy, tilesetId: tileset.id, tileIndex: 4 });
    }
  } else if (params.pattern === "checkerboard") {
    // Alternating pattern
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if ((dx + dy) % 2 === 0) {
          newTiles.push({
            x: x + dx,
            y: y + dy,
            tilesetId: tileset.id,
            tileIndex: 4
          });
        }
      }
    }
  }

  return {
    success: true,
    message: `Painted ${newTiles.length} ${params.tilesetName} tiles in ${params.pattern} pattern`,
    canvasUpdates: { tiles: newTiles }
  };
}

// Create shapes on the canvas
export function executeCreateShapes(
  params: {
    shapeType: string;
    count: number;
    layout: string;
    area?: { x: number; y: number; width: number; height: number };
    style?: { fill?: string; stroke?: string; size?: number };
  },
  canvasState: CanvasState
): ExecutionResult {
  const newShapes: Shape[] = [];
  
  // Default area if not specified (center of canvas)
  const area = params.area || { x: 200, y: 200, width: 400, height: 400 };
  const size = params.style?.size || 50;
  const fill = params.style?.fill || "#3b82f6";
  const stroke = params.style?.stroke || "#1e40af";

  for (let i = 0; i < params.count; i++) {
    let x: number, y: number;

    if (params.layout === "grid") {
      const cols = Math.ceil(Math.sqrt(params.count));
      const col = i % cols;
      const row = Math.floor(i / cols);
      x = area.x + (col * (area.width / cols)) + (area.width / cols / 2);
      y = area.y + (row * (area.height / cols)) + (area.height / cols / 2);
    } else if (params.layout === "random") {
      x = area.x + Math.random() * area.width;
      y = area.y + Math.random() * area.height;
    } else if (params.layout === "circle") {
      const angle = (i / params.count) * Math.PI * 2;
      const radius = Math.min(area.width, area.height) / 3;
      x = area.x + area.width / 2 + Math.cos(angle) * radius;
      y = area.y + area.height / 2 + Math.sin(angle) * radius;
    } else { // line
      x = area.x + (i / (params.count - 1 || 1)) * area.width;
      y = area.y + area.height / 2;
    }

    const shape: Shape = {
      id: uuidv4(),
      type: params.shapeType as any,
      transform: {
        x,
        y,
        width: size,
        height: size,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      },
      style: {
        fill,
        stroke,
        strokeWidth: 2,
        opacity: 1
      },
      metadata: {
        createdBy: "ai-agent",
        createdAt: Date.now(),
        locked: false,
        layer: 0
      }
    };

    newShapes.push(shape);
  }

  return {
    success: true,
    message: `Created ${params.count} ${params.shapeType}(s) in ${params.layout} layout`,
    canvasUpdates: { shapes: newShapes }
  };
}

// Analyze the canvas
export function executeAnalyzeCanvas(
  canvasState: CanvasState,
  tileMap: TileMap
): ExecutionResult {
  const shapeCount = canvasState.shapes.length;
  const tileCount = tileMap.tiles.length;
  
  // Count shape types
  const shapeCounts: Record<string, number> = {};
  canvasState.shapes.forEach(shape => {
    shapeCounts[shape.type] = (shapeCounts[shape.type] || 0) + 1;
  });

  // Count tile types
  const tileCounts: Record<string, number> = {};
  tileMap.tiles.forEach(tile => {
    tileCounts[tile.tilesetId] = (tileCounts[tile.tilesetId] || 0) + 1;
  });

  const analysis = {
    totalShapes: shapeCount,
    totalTiles: tileCount,
    shapeBreakdown: shapeCounts,
    tileBreakdown: tileCounts,
    canvasInfo: {
      zoom: canvasState.zoom,
      gridSize: canvasState.gridSize,
      gridVisible: canvasState.gridVisible
    }
  };

  const suggestions: string[] = [];
  
  if (shapeCount === 0 && tileCount === 0) {
    suggestions.push("Your canvas is empty. Try asking me to paint some terrain or add shapes!");
  } else {
    if (shapeCount > 0 && tileCount === 0) {
      suggestions.push("You have shapes but no terrain. Consider adding grass, dirt, or water tiles for a more complete scene.");
    }
    if (tileCount > 0 && shapeCount === 0) {
      suggestions.push("You have terrain but no objects. Try adding some shapes like circles or stars to populate your map.");
    }
    if (shapeCount > 10) {
      suggestions.push("You have many shapes. Consider organizing them or using layers to group related objects.");
    }
  }

  return {
    success: true,
    message: `Canvas Analysis:\n- ${shapeCount} shapes\n- ${tileCount} tiles\n\nSuggestions:\n${suggestions.join('\n')}`
  };
}

// Clear canvas elements
export function executeClearCanvas(
  params: { target: string },
  canvasState: CanvasState,
  tileMap: TileMap
): ExecutionResult {
  // Calculate what will be cleared
  let itemCount = 0;
  if (params.target === "all") {
    itemCount = canvasState.shapes.length + tileMap.tiles.length;
  } else if (params.target === "shapes") {
    itemCount = canvasState.shapes.length;
  } else if (params.target === "tiles") {
    itemCount = tileMap.tiles.length;
  }

  const updates: { shapes?: Shape[]; tiles?: Tile[] } = {};

  if (params.target === "all" || params.target === "shapes") {
    updates.shapes = []; // Clear all shapes
  }

  if (params.target === "all" || params.target === "tiles") {
    updates.tiles = []; // Clear all tiles
  }

  return {
    success: true,
    message: `Cleared ${params.target} from canvas`,
    requiresConfirmation: true,
    confirmationPrompt: `This will delete ${itemCount} ${params.target === "all" ? "items" : params.target}. Are you sure?`,
    canvasUpdates: updates
  };
}
