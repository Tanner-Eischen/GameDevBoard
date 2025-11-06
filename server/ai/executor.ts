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
    sprites?: any[];
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
  // Guard against undefined or null tilesets
  if (!tilesets || !Array.isArray(tilesets)) {
    return {
      success: false,
      message: 'Tilesets not available. Please ensure tilesets are loaded.'
    };
  }

  // Map "Water Terrain" to "Lake" (they are equivalent)
  const normalizedTilesetName = params.tilesetName === "Water Terrain" ? "Lake" : params.tilesetName;
  
  const tileset = tilesets.find(t => t.name === normalizedTilesetName);
  
  if (!tileset) {
    const availableTilesets = tilesets.map(t => t.name).slice(0, 20).join(', ');
    const moreText = tilesets.length > 20 ? ` (and ${tilesets.length - 20} more)` : '';
    return {
      success: false,
      message: `Tileset "${params.tilesetName}" not found. Available tilesets: ${availableTilesets}${moreText}`
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
  // Guard against undefined or null tilesets
  if (!availableTilesets || !Array.isArray(availableTilesets)) {
    return {
      success: false,
      message: 'Tilesets not available. Please ensure tilesets are loaded.'
    };
  }

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
  // Guard against undefined/null inputs
  if (!canvasState) {
    return {
      success: false,
      message: 'Canvas state is not available'
    };
  }
  
  if (!tileMap) {
    return {
      success: false,
      message: 'Tile map is not available'
    };
  }

  // Validate target parameter
  const validTargets = ['all', 'shapes', 'tiles'];
  if (!params.target || !validTargets.includes(params.target)) {
    return {
      success: false,
      message: `Invalid target "${params.target}". Valid targets are: ${validTargets.join(', ')}`
    };
  }

  // Calculate what will be cleared (with safe array access)
  let itemCount = 0;
  if (params.target === "all") {
    itemCount = (canvasState.shapes?.length || 0) + (tileMap.tiles?.length || 0);
  } else if (params.target === "shapes") {
    itemCount = canvasState.shapes?.length || 0;
  } else if (params.target === "tiles") {
    itemCount = tileMap.tiles?.length || 0;
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
    message: `Cleared ${params.target} from canvas (${itemCount} items)`,
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

// NEW PR6 ENHANCED EXECUTOR FUNCTIONS

// Create a single sprite with advanced animation and physics
export function executeCreateSprite(
  params: {
    spriteType: string;
    position: { x: number; y: number };
    animation?: string;
    physics?: {
      mass?: number;
      friction?: number;
      restitution?: number;
      collision?: boolean;
    };
    scale?: number;
    rotation?: number;
  },
  canvasState: CanvasState
): ExecutionResult {
  const animation = params.animation || 'idle';
  const scale = params.scale || 1.0;
  const rotation = params.rotation || 0;
  const physics = params.physics || {};

  // Create sprite with enhanced properties
  const sprite = {
    id: uuidv4(),
    spriteDefId: params.spriteType,
    x: params.position.x,
    y: params.position.y,
    scale,
    rotation,
    flipX: false,
    flipY: false,
    currentAnimation: animation,
    animationState: {
      currentFrame: 0,
      frameTime: 0,
      isPlaying: true,
      loop: animation !== 'jump' && animation !== 'attack' && animation !== 'hurt' && animation !== 'die'
    },
    physics: {
      enabled: physics.collision !== false,
      mass: physics.mass || 1.0,
      friction: physics.friction || 0.5,
      restitution: physics.restitution || 0.0,
      collision: physics.collision !== false,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 }
    },
    metadata: {
      createdBy: "ai-agent",
      createdAt: Date.now(),
      locked: false,
      layer: 1,
      enhanced: true
    }
  };

  return {
    success: true,
    message: `Created ${params.spriteType} sprite at (${params.position.x}, ${params.position.y}) with ${animation} animation and physics integration`,
    canvasUpdates: { sprites: [sprite] }
  };
}

// Configure physics properties for tiles
export function executeSetPhysics(
  params: {
    tileCoordinates: Array<{ x: number; y: number }>;
    materialType: string;
    friction?: number;
    restitution?: number;
    collisionType: string;
  },
  canvasState: CanvasState,
  tileMap: TileMap
): ExecutionResult {
  const physicsEntities: any[] = [];
  
  // Material type defaults
  const materialDefaults = {
    solid: { friction: 0.7, restitution: 0.0 },
    platform: { friction: 0.6, restitution: 0.0 },
    bouncy: { friction: 0.3, restitution: 0.8 },
    slippery: { friction: 0.1, restitution: 0.0 },
    hazard: { friction: 0.5, restitution: 0.0 }
  };

  const defaults = materialDefaults[params.materialType as keyof typeof materialDefaults] || materialDefaults.solid;
  const friction = params.friction !== undefined ? params.friction : defaults.friction;
  const restitution = params.restitution !== undefined ? params.restitution : defaults.restitution;

  // Create physics entities for each tile coordinate
  for (const coord of params.tileCoordinates) {
    const physicsEntity = {
      id: uuidv4(),
      tileX: coord.x,
      tileY: coord.y,
      materialType: params.materialType,
      collisionType: params.collisionType,
      friction,
      restitution,
      isDamaging: params.materialType === 'hazard',
      isOneWay: params.collisionType === 'platform',
      isTrigger: params.collisionType === 'trigger',
      metadata: {
        createdBy: "ai-agent",
        createdAt: Date.now()
      }
    };

    physicsEntities.push(physicsEntity);
  }

  return {
    success: true,
    message: `Configured physics for ${params.tileCoordinates.length} tiles with ${params.materialType} material and ${params.collisionType} collision`,
    canvasUpdates: { physicsEntities }
  };
}

// Generate complete platformer terrain and level layout
export function executePlatformerTerrain(
  params: {
    difficulty: string;
    theme: string;
    size: string;
    features?: string[];
    enemyDensity?: number;
  },
  canvasState: CanvasState,
  tileMap: TileMap,
  tilesets: Array<{ id: string; name: string }>
): ExecutionResult {
  const newTiles: Tile[] = [];
  const newSprites: any[] = [];
  const physicsEntities: any[] = [];
  
  // Size configurations
  const sizeConfigs = {
    small: { width: 30, height: 20 },
    medium: { width: 50, height: 30 },
    large: { width: 80, height: 40 },
    massive: { width: 120, height: 60 }
  };

  const { width, height } = sizeConfigs[params.size as keyof typeof sizeConfigs] || sizeConfigs.medium;
  
  // Theme-based tileset selection
  const themeMapping = {
    forest: "Grass Terrain",
    cave: "Dirt Terrain", 
    castle: "Dirt Terrain",
    sky: "Grass Terrain"
  };

  // Guard against undefined or null tilesets
  if (!tilesets || !Array.isArray(tilesets)) {
    return {
      success: false,
      message: 'Tilesets not available. Please ensure tilesets are loaded.'
    };
  }

  const terrainTileset = tilesets.find(t => t.name === themeMapping[params.theme as keyof typeof themeMapping]);
  if (!terrainTileset) {
    return {
      success: false,
      message: `Could not find appropriate tileset for ${params.theme} theme`
    };
  }

  // Generate base terrain (ground level)
  const groundLevel = Math.floor(height * 0.7); // Ground at 70% down
  
  // Create ground
  for (let x = 0; x < width; x++) {
    for (let y = groundLevel; y < height; y++) {
      newTiles.push({
        x,
        y,
        tilesetId: terrainTileset.id,
        tileIndex: 4,
        layer: 'terrain'
      });
      
      // Add physics to ground tiles
      if (y === groundLevel) {
        physicsEntities.push({
          id: uuidv4(),
          tileX: x,
          tileY: y,
          materialType: 'solid',
          collisionType: 'solid',
          friction: 0.7,
          restitution: 0.0,
          metadata: { createdBy: "ai-agent", createdAt: Date.now() }
        });
      }
    }
  }

  // Generate platforms based on difficulty
  const platformCount = {
    easy: Math.floor(width / 8),
    medium: Math.floor(width / 6),
    hard: Math.floor(width / 4),
    expert: Math.floor(width / 3)
  }[params.difficulty] || 5;

  for (let i = 0; i < platformCount; i++) {
    const platformX = Math.floor((i + 1) * (width / (platformCount + 1)));
    const platformY = Math.floor(groundLevel - Math.random() * (groundLevel / 2) - 3);
    const platformWidth = Math.floor(3 + Math.random() * 4); // 3-6 tiles wide

    for (let x = platformX; x < platformX + platformWidth && x < width; x++) {
      newTiles.push({
        x,
        y: platformY,
        tilesetId: terrainTileset.id,
        tileIndex: 4,
        layer: 'terrain'
      });

      // Add platform physics (one-way collision)
      physicsEntities.push({
        id: uuidv4(),
        tileX: x,
        tileY: platformY,
        materialType: 'platform',
        collisionType: 'platform',
        friction: 0.6,
        restitution: 0.0,
        isOneWay: true,
        metadata: { createdBy: "ai-agent", createdAt: Date.now() }
      });
    }
  }

  // Add hazards if requested
  if (params.features?.includes('hazards')) {
    const hazardCount = {
      easy: 2,
      medium: 4,
      hard: 6,
      expert: 8
    }[params.difficulty] || 3;

    for (let i = 0; i < hazardCount; i++) {
      const hazardX = Math.floor(Math.random() * (width - 2)) + 1;
      const hazardY = groundLevel - 1;

      // Create hazard tile (using different tile index for visual distinction)
      newTiles.push({
        x: hazardX,
        y: hazardY,
        tilesetId: terrainTileset.id,
        tileIndex: 8, // Different tile for hazards
        layer: 'terrain'
      });

      // Add hazard physics
      physicsEntities.push({
        id: uuidv4(),
        tileX: hazardX,
        tileY: hazardY,
        materialType: 'hazard',
        collisionType: 'trigger',
        friction: 0.5,
        restitution: 0.0,
        isDamaging: true,
        metadata: { createdBy: "ai-agent", createdAt: Date.now() }
      });
    }
  }

  // Add enemies based on density
  const enemyDensity = params.enemyDensity || 0.3;
  const enemyCount = Math.floor(width * enemyDensity / 10);
  
  for (let i = 0; i < enemyCount; i++) {
    const enemyX = Math.floor(Math.random() * (width - 4)) + 2;
    const enemyY = groundLevel - 2; // Place above ground

    newSprites.push({
      id: uuidv4(),
      spriteDefId: 'enemy-goblin',
      x: enemyX * 32, // Convert to pixels
      y: enemyY * 32,
      scale: 1.0,
      rotation: 0,
      flipX: false,
      flipY: false,
      currentAnimation: 'idle',
      animationState: {
        currentFrame: 0,
        frameTime: 0,
        isPlaying: true,
        loop: true
      },
      physics: {
        enabled: true,
        mass: 0.8,
        friction: 0.5,
        restitution: 0.0,
        collision: true,
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 }
      },
      metadata: {
        createdBy: "ai-agent",
        createdAt: Date.now(),
        locked: false,
        layer: 1,
        aiControlled: true
      }
    });
  }

  // Apply auto-tiling to terrain
  const autoTiledTiles = applyAutoTiling(newTiles, tileMap.tiles, terrainTileset.id);

  return {
    success: true,
    message: `Generated ${params.difficulty} ${params.theme} platformer level (${params.size}) with ${autoTiledTiles.length} terrain tiles, ${physicsEntities.length} physics entities, and ${newSprites.length} enemies`,
    canvasUpdates: { 
      tiles: autoTiledTiles,
      sprites: newSprites,
      physicsEntities
    }
  };
}

// Control sprite animations and state machine transitions
export function executeAnimateSprite(
  params: {
    spriteId: string;
    animation: string;
    loop?: boolean;
    transitionConditions?: Array<{
      trigger: string;
      targetAnimation: string;
      delay?: number;
      variable?: string;
      value?: string;
    }>;
  },
  canvasState: CanvasState
): ExecutionResult {
  const targetSprites: any[] = [];
  const loop = params.loop !== undefined ? params.loop : 
    !['jump', 'attack', 'hurt', 'die'].includes(params.animation);

  // Find target sprites
  if (params.spriteId === 'all') {
    // Apply to all sprites
    canvasState.sprites?.forEach(sprite => {
      const updatedSprite = {
        ...sprite,
        currentAnimation: params.animation,
        animationState: {
          ...sprite.animationState,
          currentFrame: 0,
          frameTime: 0,
          isPlaying: true,
          loop
        }
      };

      // Add state machine transitions if specified
      if (params.transitionConditions) {
        updatedSprite.stateMachine = {
          currentState: params.animation,
          transitions: params.transitionConditions.map(condition => ({
            from: params.animation,
            to: condition.targetAnimation,
            trigger: condition.trigger,
            delay: condition.delay,
            variable: condition.variable,
            value: condition.value
          }))
        };
      }

      targetSprites.push(updatedSprite);
    });
  } else {
    // Apply to specific sprite
    const sprite = canvasState.sprites?.find(s => s.id === params.spriteId);
    if (sprite) {
      const updatedSprite = {
        ...sprite,
        currentAnimation: params.animation,
        animationState: {
          ...sprite.animationState,
          currentFrame: 0,
          frameTime: 0,
          isPlaying: true,
          loop
        }
      };

      // Add state machine transitions if specified
      if (params.transitionConditions) {
        updatedSprite.stateMachine = {
          currentState: params.animation,
          transitions: params.transitionConditions.map(condition => ({
            from: params.animation,
            to: condition.targetAnimation,
            trigger: condition.trigger,
            delay: condition.delay,
            variable: condition.variable,
            value: condition.value
          }))
        };
      }

      targetSprites.push(updatedSprite);
    }
  }

  if (targetSprites.length === 0) {
    return {
      success: false,
      message: `No sprites found with ID "${params.spriteId}"`
    };
  }

  const transitionInfo = params.transitionConditions ? 
    ` with ${params.transitionConditions.length} state transitions` : '';

  return {
    success: true,
    message: `Updated ${targetSprites.length} sprite(s) to ${params.animation} animation (loop: ${loop})${transitionInfo}`,
    canvasUpdates: { sprites: targetSprites }
  };
}
