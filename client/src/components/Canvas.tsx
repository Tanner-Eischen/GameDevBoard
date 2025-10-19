import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, RegularPolygon, Star, Image } from 'react-konva';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { Shape, Tile } from '@shared/schema';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { getTilesToUpdate } from '@/utils/autoTiling';

export function Canvas() {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    shapes,
    selectedIds,
    tool,
    zoom,
    pan,
    gridSize,
    gridVisible,
    snapToGrid,
    addShape,
    updateShape,
    selectShape,
    clearSelection,
    tiles,
    tilesets,
    selectedTileset,
    selectedTileIndex,
    brushSize,
    addTile,
    addTiles,
    removeTile,
    currentUser,
  } = useCanvasStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [lastPaintedGrid, setLastPaintedGrid] = useState<{ x: number; y: number } | null>(null);
  const [tilesetImages, setTilesetImages] = useState<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load tileset images when tilesets change
  useEffect(() => {
    const loadImages = async () => {
      const imageMap = new Map<string, HTMLImageElement>();
      
      for (const tileset of tilesets) {
        if (tileset.imageUrl && !tilesetImages.has(tileset.id)) {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          
          // Wait for image to load
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = tileset.imageUrl;
          }).catch(() => {
            console.error(`Failed to load tileset image: ${tileset.name}`);
          });
          
          if (img.complete && img.naturalWidth > 0) {
            imageMap.set(tileset.id, img);
          }
        } else if (tilesetImages.has(tileset.id)) {
          // Keep existing loaded image
          imageMap.set(tileset.id, tilesetImages.get(tileset.id)!);
        }
      }
      
      setTilesetImages(imageMap);
    };
    
    loadImages();
  }, [tilesets]);

  const snapToGridIfEnabled = (pos: { x: number; y: number }) => {
    if (!snapToGrid) return pos;
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize,
    };
  };

  const paintTilesAtPosition = (gridX: number, gridY: number) => {
    if (!selectedTileset) return;

    // Handle multi-tile objects (trees, etc.) - these go on the 'props' layer
    if (selectedTileset.tilesetType === 'multi-tile' && selectedTileset.multiTileConfig) {
      const tilesToAdd: Tile[] = [];
      
      // Place all tiles from the multi-tile configuration
      selectedTileset.multiTileConfig.tiles.forEach((tilePos) => {
        // Calculate tileIndex based on grid position: row * columns + col
        const tileIndex = tilePos.y * selectedTileset.columns + tilePos.x;
        
        tilesToAdd.push({
          x: gridX + tilePos.x,
          y: gridY + tilePos.y,
          tilesetId: selectedTileset.id,
          tileIndex: tileIndex,
          layer: 'props', // Props layer for trees, flowers, etc.
        });
      });
      
      // Add all tiles as a complete unit (no auto-tiling for multi-tile objects)
      addTiles(tilesToAdd);
      return;
    }

    // Handle auto-tiling tilesets (grass, dirt, water) - these go on the 'terrain' layer
    // Collect all tiles to be added/updated
    const tilesToAdd: Tile[] = [];

    // First, add all brush tiles with selected index
    for (let dy = 0; dy < brushSize.height; dy++) {
      for (let dx = 0; dx < brushSize.width; dx++) {
        tilesToAdd.push({
          x: gridX + dx,
          y: gridY + dy,
          tilesetId: selectedTileset.id,
          tileIndex: selectedTileIndex,
          layer: 'terrain', // Terrain layer for grass, dirt, water
        });
      }
    }

    // Simulate updated tiles array for auto-tiling calculation
    // Only consider terrain-layer tiles for auto-tiling neighbor detection
    const currentTiles = useCanvasStore.getState().tiles;
    const terrainTiles = currentTiles.filter(t => t.layer === 'terrain');
    const tileMap = new Map(terrainTiles.map(t => [`${t.x},${t.y}`, t]));
    tilesToAdd.forEach(tile => {
      tileMap.set(`${tile.x},${tile.y}`, tile);
    });
    const simulatedTiles = Array.from(tileMap.values());

    // Collect all tiles that need auto-tiling updates (using Map to avoid duplicates)
    const autoTiledTiles = new Map<string, Tile>();

    // Calculate auto-tiling for each painted tile and its neighbors
    for (let dy = 0; dy < brushSize.height; dy++) {
      for (let dx = 0; dx < brushSize.width; dx++) {
        const tileX = gridX + dx;
        const tileY = gridY + dy;

        const updates = getTilesToUpdate(
          tileX,
          tileY,
          selectedTileset.id,
          simulatedTiles,
          true,
          'terrain' // explicitly pass layer for clarity
        );

        updates.forEach((update) => {
          const key = `${update.x},${update.y},${update.tilesetId}`;
          autoTiledTiles.set(key, {
            x: update.x,
            y: update.y,
            tilesetId: update.tilesetId, // Use tilesetId from update (supports cross-tileset updates)
            tileIndex: update.tileIndex,
            layer: 'terrain', // Auto-tiled tiles are terrain
          });
        });
      }
    }

    // Merge original brush tiles with auto-tiled results
    // Start with all the auto-tiled updates
    const finalTiles = new Map(autoTiledTiles);
    
    // Ensure all original brush tiles are included (in case auto-tiling didn't cover them)
    tilesToAdd.forEach(tile => {
      const key = `${tile.x},${tile.y},${tile.tilesetId}`;
      if (!finalTiles.has(key)) {
        finalTiles.set(key, tile);
      }
    });

    // Batch all tile additions into a single operation
    addTiles(Array.from(finalTiles.values()));
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const snappedPos = snapToGridIfEnabled({
      x: (pos.x - pan.x) / zoom,
      y: (pos.y - pan.y) / zoom,
    });

    // Handle tile tools - allow painting over existing tiles and shapes
    if (tool === 'tile-paint' && selectedTileset) {
      const gridX = Math.floor(snappedPos.x / gridSize);
      const gridY = Math.floor(snappedPos.y / gridSize);
      
      setIsPainting(true);
      setLastPaintedGrid({ x: gridX, y: gridY });
      paintTilesAtPosition(gridX, gridY);
      return;
    }

    if (tool === 'tile-erase') {
      const gridX = Math.floor(snappedPos.x / gridSize);
      const gridY = Math.floor(snappedPos.y / gridSize);
      
      // Find tiles at this position, prioritize props layer
      const tilesAtPosition = tiles.filter((t) => t.x === gridX && t.y === gridY);
      if (tilesAtPosition.length === 0) return;
      
      // Erase from props layer first, then terrain
      const tileToRemove = tilesAtPosition.find((t) => t.layer === 'props') || tilesAtPosition[0];
      
      if (!tileToRemove) return;

      // Get the tileset to check if it's a multi-tile object
      const tileset = tilesets?.find(ts => ts.id === tileToRemove.tilesetId);

      // Handle multi-tile objects (trees, etc.)
      if (tileset?.tilesetType === 'multi-tile' && tileset.multiTileConfig) {
        // Find the root position of this multi-tile object
        // We need to determine which tile in the configuration this is
        const configTile = tileset.multiTileConfig.tiles[tileToRemove.tileIndex];
        if (!configTile) {
          removeTile(gridX, gridY);
          return;
        }

        // Calculate the base position (where the object was placed)
        const baseX = gridX - configTile.x;
        const baseY = gridY - configTile.y;

        // Remove all tiles belonging to this multi-tile object (from props layer)
        tileset.multiTileConfig.tiles.forEach((tilePos) => {
          removeTile(baseX + tilePos.x, baseY + tilePos.y, 'props');
        });

        return;
      }

      // Handle auto-tiling tilesets (existing logic)
      // Calculate what tiles array will look like after removal
      const tilesAfterRemoval = tiles.filter(
        (t) => !(t.x === gridX && t.y === gridY)
      );

      // Calculate auto-tiling for surrounding tiles based on the state after removal
      const tilesToUpdate = getTilesToUpdate(
        gridX,
        gridY,
        tileToRemove.tilesetId,
        tilesAfterRemoval,
        false, // don't include self since we're removing it
        tileToRemove.layer // pass layer explicitly since tile will be gone from array
      );

      // Remove the tile from its layer
      removeTile(gridX, gridY, tileToRemove.layer);

      // Then update all affected neighbor tiles with correct auto-tiling indices (only for terrain layer)
      if (tileToRemove.layer === 'terrain') {
        tilesToUpdate.forEach((update) => {
          addTile({
            x: update.x,
            y: update.y,
            tilesetId: update.tilesetId, // Use tilesetId from update (supports cross-tileset updates)
            tileIndex: update.tileIndex,
            layer: 'terrain', // Auto-tiled neighbors are terrain
          });
        });
      }

      return;
    }

    // For shape tools, only respond to clicks on empty canvas
    if (e.target !== e.target.getStage()) return;

    if (tool === 'select') {
      clearSelection();
      return;
    }

    if (tool === 'pan') return;

    // Create new shape
    const newShape: Shape = {
      id: uuidv4(),
      type: tool === 'rectangle' ? 'rectangle' :
            tool === 'circle' ? 'circle' :
            tool === 'polygon' ? 'polygon' :
            tool === 'star' ? 'star' :
            'line',
      transform: {
        x: snappedPos.x,
        y: snappedPos.y,
        width: 0,
        height: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      style: {
        fill: tool === 'line' ? 'transparent' : '#3b82f6',
        stroke: '#3b82f6',
        strokeWidth: 2,
        opacity: 1,
      },
      metadata: {
        createdBy: currentUser?.id || 'local',
        createdAt: Date.now(),
        locked: false,
        layer: 0,
      },
      points: tool === 'line' ? [0, 0, 0, 0] : undefined,
    };

    setCurrentShape(newShape);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const canvasPos = {
      x: (pos.x - pan.x) / zoom,
      y: (pos.y - pan.y) / zoom,
    };

    const snappedPos = snapToGridIfEnabled(canvasPos);

    // Handle continuous tile painting while dragging
    if (isPainting && tool === 'tile-paint' && selectedTileset) {
      const gridX = Math.floor(snappedPos.x / gridSize);
      const gridY = Math.floor(snappedPos.y / gridSize);

      // Collect all grid cells to paint (deduplicated via Set)
      const cellsToPaint = new Set<string>();

      // Fill in all grid cells between last painted position and current position
      if (lastPaintedGrid) {
        const dx = gridX - lastPaintedGrid.x;
        const dy = gridY - lastPaintedGrid.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        if (steps > 0) {
          // Interpolate between last and current position to fill gaps
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const interpX = Math.floor(lastPaintedGrid.x + dx * t);
            const interpY = Math.floor(lastPaintedGrid.y + dy * t);
            cellsToPaint.add(`${interpX},${interpY}`);
          }
        }
      } else {
        // First paint
        cellsToPaint.add(`${gridX},${gridY}`);
      }
      
      // Paint all unique cells
      cellsToPaint.forEach(cell => {
        const [x, y] = cell.split(',').map(Number);
        paintTilesAtPosition(x, y);
      });
      
      setLastPaintedGrid({ x: gridX, y: gridY });
      return;
    }

    if (!isDrawing || !currentShape) return;

    const width = snappedPos.x - currentShape.transform.x;
    const height = snappedPos.y - currentShape.transform.y;

    if (currentShape.type === 'line' && currentShape.points) {
      setCurrentShape({
        ...currentShape,
        points: [0, 0, width, height],
      });
    } else {
      setCurrentShape({
        ...currentShape,
        transform: {
          ...currentShape.transform,
          width: Math.abs(width),
          height: Math.abs(height),
          x: width < 0 ? snappedPos.x : currentShape.transform.x,
          y: height < 0 ? snappedPos.y : currentShape.transform.y,
        },
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentShape) {
      // Only add shape if it has some size
      const hasSize = currentShape.type === 'line'
        ? currentShape.points && (Math.abs(currentShape.points[2]) > 5 || Math.abs(currentShape.points[3]) > 5)
        : currentShape.transform.width > 5 || currentShape.transform.height > 5;

      if (hasSize) {
        addShape(currentShape);
      }
    }
    
    // Reset painting state
    setIsPainting(false);
    setLastPaintedGrid(null);
    setIsDrawing(false);
    setCurrentShape(null);
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = zoom;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    useCanvasStore.setState({ zoom: newScale });
  };

  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target as Konva.Stage;
    useCanvasStore.setState({ 
      pan: { x: stage.x(), y: stage.y() } 
    });
  };

  const renderShape = (shape: Shape, isTemp = false) => {
    const isSelected = selectedIds.includes(shape.id);
    const commonProps = {
      key: shape.id,
      x: shape.transform.x,
      y: shape.transform.y,
      fill: shape.style.fill,
      stroke: isSelected ? '#60a5fa' : shape.style.stroke,
      strokeWidth: isSelected ? shape.style.strokeWidth + 1 : shape.style.strokeWidth,
      opacity: shape.style.opacity,
      rotation: shape.transform.rotation,
      scaleX: shape.transform.scaleX,
      scaleY: shape.transform.scaleY,
      draggable: !isTemp && tool === 'select',
      onClick: () => !isTemp && selectShape(shape.id, false),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const target = e.target;
        updateShape(shape.id, {
          transform: {
            ...shape.transform,
            x: target.x(),
            y: target.y(),
          },
        });
      },
    };

    switch (shape.type) {
      case 'rectangle':
        return (
          <Rect
            {...commonProps}
            width={shape.transform.width}
            height={shape.transform.height}
          />
        );
      case 'circle':
        return (
          <Circle
            {...commonProps}
            radius={Math.max(shape.transform.width, shape.transform.height) / 2}
          />
        );
      case 'polygon':
        return (
          <RegularPolygon
            {...commonProps}
            sides={6}
            radius={Math.max(shape.transform.width, shape.transform.height) / 2}
          />
        );
      case 'star':
        return (
          <Star
            {...commonProps}
            numPoints={5}
            innerRadius={Math.max(shape.transform.width, shape.transform.height) / 4}
            outerRadius={Math.max(shape.transform.width, shape.transform.height) / 2}
          />
        );
      case 'line':
        return (
          <Line
            {...commonProps}
            points={shape.points || [0, 0, 100, 100]}
          />
        );
      default:
        return null;
    }
  };

  const renderGrid = () => {
    if (!gridVisible) return null;

    const lines: JSX.Element[] = [];
    const padding = 2000;
    const startX = Math.floor((-pan.x / zoom - padding) / gridSize) * gridSize;
    const endX = Math.ceil((-pan.x / zoom + stageSize.width / zoom + padding) / gridSize) * gridSize;
    const startY = Math.floor((-pan.y / zoom - padding) / gridSize) * gridSize;
    const endY = Math.ceil((-pan.y / zoom + stageSize.height / zoom + padding) / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, startY, x, endY]}
          stroke="hsl(var(--canvas-grid))"
          strokeWidth={0.5 / zoom}
          listening={false}
        />
      );
    }

    for (let y = startY; y <= endY; y += gridSize) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[startX, y, endX, y]}
          stroke="hsl(var(--canvas-grid))"
          strokeWidth={0.5 / zoom}
          listening={false}
        />
      );
    }

    return lines;
  };

  const renderTiles = () => {
    // Sort tiles by layer: terrain first, then props on top
    const sortedTiles = [...tiles].sort((a, b) => {
      if (a.layer === 'terrain' && b.layer === 'props') return -1;
      if (a.layer === 'props' && b.layer === 'terrain') return 1;
      return 0;
    });

    return sortedTiles.map((tile, index) => {
      // Look up the tileset by tilesetId
      const tileset = tilesets.find((ts) => ts.id === tile.tilesetId);
      if (!tileset) return null;

      // Get the loaded image for this tileset
      const image = tilesetImages.get(tileset.id);
      if (!image) {
        // Fallback to colored rectangle while image is loading
        return (
          <Rect
            key={`tile-${index}`}
            x={tile.x * gridSize}
            y={tile.y * gridSize}
            width={gridSize}
            height={gridSize}
            fill="#6366f1"
            opacity={0.3}
            listening={false}
          />
        );
      }

      // Calculate the position in the tileset image accounting for spacing
      // For a 3x3 grid with spacing, each tile starts at: col * (tileSize + spacing)
      const col = tile.tileIndex % tileset.columns;
      const row = Math.floor(tile.tileIndex / tileset.columns);
      const spacing = tileset.spacing || 0;
      const tileX = col * (tileset.tileSize + spacing);
      const tileY = row * (tileset.tileSize + spacing);

      return (
        <Image
          key={`tile-${index}`}
          image={image}
          x={tile.x * gridSize}
          y={tile.y * gridSize}
          width={gridSize}
          height={gridSize}
          crop={{
            x: tileX,
            y: tileY,
            width: tileset.tileSize,
            height: tileset.tileSize,
          }}
          listening={false}
        />
      );
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-canvas">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        draggable={tool === 'pan'}
      >
        <Layer>
          {renderGrid()}
          {renderTiles()}
          {shapes.map((shape) => renderShape(shape))}
          {currentShape && renderShape(currentShape, true)}
        </Layer>
      </Stage>
    </div>
  );
}
