import type { CanvasState, TileMap, Shape, Tile } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import { applyAutoTiling } from "./autoTiling";

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

// Helper: Generate points for a curved path (Catmull-Rom spline)
function generateCurvedPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  curvePoints: number = 3,
  curvature: number = 0.3
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const controlPoints: Array<{ x: number; y: number }> = [start];

  // Generate random control points between start and end
  for (let i = 1; i < curvePoints; i++) {
    const t = i / curvePoints;
    const baseX = start.x + (end.x - start.x) * t;
    const baseY = start.y + (end.y - start.y) * t;
    
    // Add perpendicular offset for curvature
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / length;
    const perpY = dx / length;
    
    // Alternate curve direction for winding effect
    const offset = (i % 2 === 0 ? 1 : -1) * curvature * length;
    
    controlPoints.push({
      x: Math.round(baseX + perpX * offset),
      y: Math.round(baseY + perpY * offset)
    });
  }
  
  controlPoints.push(end);

  // Interpolate between control points
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)];
    
    const steps = 20;
    for (let t = 0; t <= steps; t++) {
      const u = t / steps;
      const u2 = u * u;
      const u3 = u2 * u;
      
      // Catmull-Rom spline formula
      const x = 0.5 * (
        2 * p1.x +
        (-p0.x + p2.x) * u +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3
      );
      const y = 0.5 * (
        2 * p1.y +
        (-p0.y + p2.y) * u +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3
      );
      
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  return points;
}

// Helper: Generate tiles along a path with width
function generatePathTiles(
  pathPoints: Array<{ x: number; y: number }>,
  width: number,
  tilesetId: string
): Tile[] {
  const tiles: Tile[] = [];
  const tileSet = new Set<string>();

  for (const point of pathPoints) {
    // Add tiles in a circle around each point for path width
    const radius = Math.floor(width / 2);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Use circular brush
        if (dx * dx + dy * dy <= radius * radius) {
          const tileX = point.x + dx;
          const tileY = point.y + dy;
          const key = `${tileX},${tileY}`;
          
          if (!tileSet.has(key)) {
            tileSet.add(key);
            tiles.push({
              x: tileX,
              y: tileY,
              tilesetId,
              tileIndex: 4,
              layer: 'terrain'
            });
          }
        }
      }
    }
  }

  return tiles;
}

// Paint terrain on the canvas
export function executePaintTerrain(
  params: {
    tilesetName: string;
    area: { x: number; y: number; width: number; height: number };
    pattern: string;
    pathWidth?: number;
    curveIntensity?: number;
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
          tileIndex: 4,
          layer: 'terrain'
        });
      }
    }
  } else if (params.pattern === "border") {
    // Paint border only
    for (let dx = 0; dx < width; dx++) {
      newTiles.push({ x: x + dx, y, tilesetId: tileset.id, tileIndex: 4, layer: 'terrain' });
      newTiles.push({ x: x + dx, y: y + height - 1, tilesetId: tileset.id, tileIndex: 4, layer: 'terrain' });
    }
    for (let dy = 1; dy < height - 1; dy++) {
      newTiles.push({ x, y: y + dy, tilesetId: tileset.id, tileIndex: 4, layer: 'terrain' });
      newTiles.push({ x: x + width - 1, y: y + dy, tilesetId: tileset.id, tileIndex: 4, layer: 'terrain' });
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
            tileIndex: 4,
            layer: 'terrain'
          });
        }
      }
    }
  } else if (params.pattern === "horizontal_path" || params.pattern === "vertical_path") {
    // Straight path (for roads, simple rivers)
    const pathWidth = params.pathWidth || 3;
    const isHorizontal = params.pattern === "horizontal_path";
    
    if (isHorizontal) {
      const centerY = y + Math.floor(height / 2);
      for (let dx = 0; dx < width; dx++) {
        for (let dy = -Math.floor(pathWidth / 2); dy <= Math.floor(pathWidth / 2); dy++) {
          newTiles.push({
            x: x + dx,
            y: centerY + dy,
            tilesetId: tileset.id,
            tileIndex: 4,
            layer: 'terrain'
          });
        }
      }
    } else {
      const centerX = x + Math.floor(width / 2);
      for (let dy = 0; dy < height; dy++) {
        for (let dx = -Math.floor(pathWidth / 2); dx <= Math.floor(pathWidth / 2); dx++) {
          newTiles.push({
            x: centerX + dx,
            y: y + dy,
            tilesetId: tileset.id,
            tileIndex: 4,
            layer: 'terrain'
          });
        }
      }
    }
  } else if (params.pattern === "winding_path" || params.pattern === "curved_path") {
    // Curved/winding path (for rivers, winding roads)
    const pathWidth = params.pathWidth || 3;
    const curveIntensity = params.curveIntensity || 0.3;
    
    // Determine start and end based on area dimensions (favor longer dimension)
    const isWide = width > height;
    const start = isWide 
      ? { x, y: y + Math.floor(height / 2) }
      : { x: x + Math.floor(width / 2), y };
    const end = isWide
      ? { x: x + width - 1, y: y + Math.floor(height / 2) }
      : { x: x + Math.floor(width / 2), y: y + height - 1 };
    
    // Generate curved path with 3-5 curve points for natural winding
    const curvePoints = Math.max(3, Math.floor(Math.max(width, height) / 10));
    const pathCurve = generateCurvedPath(start, end, curvePoints, curveIntensity);
    
    // Generate tiles along the curved path
    newTiles.push(...generatePathTiles(pathCurve, pathWidth, tileset.id));
  } else if (params.pattern === "diagonal_path") {
    // Diagonal path from top-left to bottom-right
    const pathWidth = params.pathWidth || 3;
    const pathPoints: Array<{ x: number; y: number }> = [];
    
    const steps = Math.max(width, height);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pathPoints.push({
        x: Math.round(x + t * (width - 1)),
        y: Math.round(y + t * (height - 1))
      });
    }
    
    newTiles.push(...generatePathTiles(pathPoints, pathWidth, tileset.id));
  }

  // Apply auto-tiling to all tiles (new + existing)
  // This calculates correct edge/corner pieces based on neighbors
  const autoTiledTiles = applyAutoTiling(newTiles, tileMap.tiles, tileset.id);

  return {
    success: true,
    message: `Painted ${autoTiledTiles.length} ${params.tilesetName} tiles in ${params.pattern} pattern with auto-tiling`,
    canvasUpdates: { tiles: autoTiledTiles }
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

// Place objects on the canvas
export function executePlaceObject(
  params: {
    objectName: string;
    placement: {
      mode: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      count?: number;
    };
  },
  canvasState: CanvasState,
  tileMap: TileMap,
  availableTilesets: any[]
): ExecutionResult {
  // Find the tileset by name
  const tileset = availableTilesets.find(t => t.name === params.objectName);
  
  if (!tileset) {
    return {
      success: false,
      message: `Object "${params.objectName}" not found. Available objects: ${availableTilesets.filter(t => t.tilesetType === 'multi-tile').map(t => t.name).join(', ')}`
    };
  }

  if (tileset.tilesetType !== 'multi-tile' || !tileset.multiTileConfig) {
    return {
      success: false,
      message: `"${params.objectName}" is not a placeable object`
    };
  }

  const newTiles: Tile[] = [];
  const positions: Array<{ x: number; y: number }> = [];

  // Determine positions based on placement mode
  if (params.placement.mode === 'single') {
    positions.push({ x: params.placement.x, y: params.placement.y });
  } else if (params.placement.mode === 'scatter' || params.placement.mode === 'grid') {
    const count = params.placement.count || 5;
    const width = params.placement.width || 20;
    const height = params.placement.height || 20;
    const startX = params.placement.x;
    const startY = params.placement.y;

    if (params.placement.mode === 'scatter') {
      // Random positions within area
      for (let i = 0; i < count; i++) {
        positions.push({
          x: startX + Math.floor(Math.random() * width),
          y: startY + Math.floor(Math.random() * height)
        });
      }
    } else if (params.placement.mode === 'grid') {
      // Grid layout
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const spacingX = Math.floor(width / cols);
      const spacingY = Math.floor(height / rows);

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
          x: startX + col * spacingX,
          y: startY + row * spacingY
        });
      }
    }
  }

  // Place objects at each position
  for (const pos of positions) {
    // Add all tiles from the multi-tile configuration
    tileset.multiTileConfig.tiles.forEach((tilePos: { x: number; y: number }) => {
      // Validate tile position is within tileset bounds
      if (tilePos.x < 0 || tilePos.x >= tileset.columns || 
          tilePos.y < 0 || tilePos.y >= tileset.rows) {
        console.warn(`Invalid tile position (${tilePos.x}, ${tilePos.y}) for tileset ${tileset.name} (${tileset.columns}x${tileset.rows})`);
        return;
      }
      
      // Calculate tileIndex based on grid position: row * columns + col
      const tileIndex = tilePos.y * tileset.columns + tilePos.x;
      
      newTiles.push({
        x: pos.x + tilePos.x,
        y: pos.y + tilePos.y,
        tilesetId: tileset.id,
        tileIndex: tileIndex,
        layer: 'props'
      });
    });
  }

  return {
    success: true,
    message: `Placed ${positions.length} ${params.objectName}(s) in ${params.placement.mode} mode`,
    canvasUpdates: { tiles: newTiles }
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

// Place sprites on the canvas
export function executePlaceSprites(
  params: {
    spriteType: string;
    count: number;
    layout: string;
    area?: { x: number; y: number; width: number; height: number };
    animation?: string;
    scale?: number;
    rotation?: number;
  },
  canvasState: CanvasState
): ExecutionResult {
  const newSprites: any[] = [];
  
  // Default area if not specified (center of canvas)
  const area = params.area || { x: 200, y: 200, width: 400, height: 400 };
  const animation = params.animation || 'idle';
  const scale = params.scale || 1.0;
  const rotation = params.rotation || 0;

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
    } else if (params.layout === "formation") {
      // Tactical formation - staggered rows
      const cols = Math.ceil(Math.sqrt(params.count));
      const col = i % cols;
      const row = Math.floor(i / cols);
      const stagger = (row % 2) * 20; // Offset every other row
      x = area.x + (col * (area.width / cols)) + (area.width / cols / 2) + stagger;
      y = area.y + (row * (area.height / Math.ceil(params.count / cols))) + 30;
    } else { // line
      x = area.x + (i / (params.count - 1 || 1)) * area.width;
      y = area.y + area.height / 2;
    }

    const sprite = {
      id: uuidv4(),
      spriteDefId: params.spriteType,
      x,
      y,
      scale,
      rotation,
      flipX: false,
      flipY: false,
      currentAnimation: animation,
      animationState: {
        currentFrame: 0,
        frameTime: 0,
        isPlaying: true,
        loop: true
      },
      metadata: {
        createdBy: "ai-agent",
        createdAt: Date.now(),
        locked: false,
        layer: 1
      }
    };

    newSprites.push(sprite);
  }

  return {
    success: true,
    message: `Placed ${params.count} ${params.spriteType} sprite(s) in ${params.layout} layout with ${animation} animation`,
    canvasUpdates: { sprites: newSprites }
  };
}
