import { useRef, useEffect, useState } from 'react';
import { Stage } from 'react-konva';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { Shape, Tile } from '@shared/schema';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { getTilesToUpdate, getNeighborConfig, calculateAutoTileIndex } from '@/utils/autoTiling';
import { getEnhancedTilesToUpdate, getCompatibleTilesToUpdate, debugAutoTiling } from '@/utils/enhancedAutoTiling';
import { getCollaborationService } from '@/services/collaboration';
import { useLayerVisibility } from '@/contexts/LayerVisibilityContext';
import { CanvasRenderer } from './Canvas/CanvasRenderer';
import { useCanvasEvents } from '../hooks/useCanvasEvents';
import { GodotCanvas } from './GodotCanvas';
import type { GodotProjectConfig } from '../types/godot';

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const { layerVisibility } = useLayerVisibility();

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
    selectMultipleShapes,
    selectShapesInArea,
    transformSelectedShapes,
    removeShape,
    tiles,
    tilesets,
    selectedTileset,
    selectedTileIndex,
    brushSize,
    addTile,
    addTiles,
    removeTile,
    currentUser,
    sprites,
    spriteDefinitions,
    selectedSpriteDefId,
    selectedSpriteId,
    animationPreview,
    addSprite,
    selectSprite,
    updateSprite,
    users,
    useGodotRendering,
    godotProjectConfig,
  } = useCanvasStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [lastPaintedGrid, setLastPaintedGrid] = useState<{ x: number; y: number } | null>(null);
  const [tilesetImages, setTilesetImages] = useState<Map<string, HTMLImageElement>>(new Map());
  // Optional per-index images for tilesets that store individual tile URLs (tile-urls tag)
  const [tilesetIndexImages, setTilesetIndexImages] = useState<Map<string, HTMLImageElement[]>>(new Map());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      setStageSize({ width, height });
    };

    // Initial measurement
    updateSize();

    // Observe container size changes (panel toggle, layout changes)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        setStageSize({ width: Math.floor(width), height: Math.floor(height) });
      });
      resizeObserver.observe(containerRef.current);
    }

    // Fallback: window resize
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  // Load tileset images when tilesets change
  useEffect(() => {
    const loadImages = async () => {
      const imageMap = new Map<string, HTMLImageElement>();
      const indexImageMap = new Map<string, HTMLImageElement[]>();
      
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
            console.error(`Failed to load tileset image: ${tileset.imageUrl} (tileset: ${tileset.name})`);
          });
          
          if (img.complete && img.naturalWidth > 0) {
            imageMap.set(tileset.id, img);
          }
        } else if (tilesetImages.has(tileset.id)) {
          // Keep existing loaded image
          imageMap.set(tileset.id, tilesetImages.get(tileset.id)!);
        }

        // Load individual per-index images if tileset includes tile-urls tag
        // This supports 3x3 auto-tiling uploads with separate images
        const tileUrlsTag = tileset.tags?.find(tag => tag.startsWith('tile-urls:'));
        if (tileUrlsTag) {
          try {
            const urls = JSON.parse(tileUrlsTag.replace('tile-urls:', '')) as string[];
            if (Array.isArray(urls) && urls.length > 0) {
              const images: HTMLImageElement[] = [];
              for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                const idxImg = new window.Image();
                idxImg.crossOrigin = 'anonymous';
                await new Promise<void>((resolve, reject) => {
                  idxImg.onload = () => resolve();
                  idxImg.onerror = () => reject();
                  idxImg.src = url;
                }).catch(() => {
                  console.error(`Failed to load per-index image ${i} for tileset ${tileset.name}: ${url}`);
                });
                images[i] = idxImg;
              }
              if (images.length > 0) {
                indexImageMap.set(tileset.id, images);
              }
            }
          } catch (e) {
            console.warn('Failed to parse tile-urls tag for tileset', tileset.name, e);
          }
        } else if (tilesetIndexImages.has(tileset.id)) {
          // Keep existing per-index images if no changes
          indexImageMap.set(tileset.id, tilesetIndexImages.get(tileset.id)!);
        }
      }
      
      setTilesetImages(imageMap);
      setTilesetIndexImages(indexImageMap);
    };
    
    loadImages();
  }, [tilesets]);

  // Keyboard event handlers for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected shapes
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        selectedIds.forEach(id => removeShape(id));
        clearSelection();
        e.preventDefault();
      }
      
      // Select all shapes (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && tool === 'select') {
        const allShapeIds = shapes.map(shape => shape.id);
        selectMultipleShapes(allShapeIds);
        e.preventDefault();
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        clearSelection();
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, shapes, tool, removeShape, clearSelection, selectMultipleShapes]);

  const snapToGridIfEnabled = (pos: { x: number; y: number }) => {
    if (!snapToGrid) return pos;
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize,
    };
  };

  const eraseTilesAtPosition = (gridX: number, gridY: number) => {
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
      // Find which tile in the config this is by matching tileIndex
      const tileIndexToFind = tileToRemove.tileIndex;
      const configTile = tileset.multiTileConfig.tiles.find((tilePos) => {
        const calculatedIndex = tilePos.y * tileset.columns + tilePos.x;
        return calculatedIndex === tileIndexToFind;
      });
      
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

    // Enhanced auto-tiling for removal
    if (tileset?.tilesetType === 'auto-tiling' && useCanvasStore.getState().enhancedAutotilingEnabled) {
      try {
        const currentTiles = useCanvasStore.getState().tiles;
        
        // Use enhanced autotiling for removal (synchronous client-side calculation)
        const updates = getEnhancedTilesToUpdate(
          gridX,
          gridY,
          tileToRemove.tilesetId,
          currentTiles,
          'remove',
          tileToRemove.layer as 'terrain' | 'props'
        );

        // Remove the original tile
        removeTile(gridX, gridY, tileToRemove.layer);

        // Apply enhanced updates for neighbors (if terrain layer)
        if (tileToRemove.layer === 'terrain') {
          const tilesToUpdate = updates.filter(update => 
            !(update.x === gridX && update.y === gridY)
          );
          
          const tilesToAdd = tilesToUpdate.map((update) => ({
            x: update.x,
            y: update.y,
            tilesetId: update.tilesetId,
            tileIndex: update.tileIndex,
            layer: 'terrain' as const,
          }));
          
          addTiles(tilesToAdd);
        }
        
        return;
      } catch (error) {
        console.warn('Enhanced erase failed, using fallback:', error);
        
        // Fallback to existing erase logic
        const tilesAfterRemoval = tiles.filter(
          (t) => !(t.x === gridX && t.y === gridY)
        );
        const tilesToUpdate = getCompatibleTilesToUpdate(
          gridX,
          gridY,
          tileToRemove.tilesetId,
          tilesAfterRemoval,
          false,
          tileToRemove.layer as 'terrain' | 'props'
        );
        removeTile(gridX, gridY, tileToRemove.layer);
        if (tileToRemove.layer === 'terrain') {
          tilesToUpdate.forEach((update) => {
            addTile({
              x: update.x,
              y: update.y,
              tilesetId: update.tilesetId,
              tileIndex: update.tileIndex,
              layer: 'terrain',
            });
          });
        }
      }
      return;
    }

    // Fallback: Simple removal for other types or if enhanced failed
    const tilesAfterRemoval = tiles.filter(
      (t) => !(t.x === gridX && t.y === gridY)
    );
    const tilesToUpdate = getTilesToUpdate(
      gridX,
      gridY,
      tileToRemove.tilesetId,
      tilesAfterRemoval,
      false,
      tileToRemove.layer
    );
    removeTile(gridX, gridY, tileToRemove.layer);
    if (tileToRemove.layer === 'terrain') {
      tilesToUpdate.forEach((update) => {
        addTile({
          x: update.x,
          y: update.y,
          tilesetId: update.tilesetId,
          tileIndex: update.tileIndex,
          layer: 'terrain',
        });
      });
    }
  };

  const paintTilesAtPosition = (gridX: number, gridY: number) => {
    if (!selectedTileset || selectedTileIndex === undefined) return;

    const isAutoBrush = tool === 'auto-tile-paint';

    // Handle multi-tile objects (trees, etc.) always on props
    if (selectedTileset.tilesetType === 'multi-tile' && selectedTileset.multiTileConfig) {
      const allTilesToAdd: Tile[] = [];
      selectedTileset.multiTileConfig.tiles.forEach((tilePos) => {
        const tileIndex = tilePos.y * selectedTileset.columns + tilePos.x;
        allTilesToAdd.push({
          x: gridX + tilePos.x,
          y: gridY + tilePos.y,
          tilesetId: selectedTileset.id,
          tileIndex: tileIndex,
          layer: 'props' as const,
        });
      });
      addTiles(allTilesToAdd);
      return;
    }

    // Variant grid brush placement when brush size > 1
    if (
      selectedTileset.tilesetType === 'variant_grid' &&
      (brushSize.width > 1 || brushSize.height > 1) &&
      selectedTileset.variantGridConfig
    ) {
      const allTilesToAdd: Tile[] = [];
      for (let dx = 0; dx < brushSize.width; dx++) {
        for (let dy = 0; dy < brushSize.height; dy++) {
          const x = gridX + dx;
          const y = gridY + dy;
          const variantX = dx % selectedTileset.variantGridConfig.width;
          const variantY = dy % selectedTileset.variantGridConfig.height;
          const variantIndex = variantY * selectedTileset.variantGridConfig.width + variantX;
          const tileIndex = selectedTileIndex + variantIndex;
          allTilesToAdd.push({ x, y, tilesetId: selectedTileset.id, tileIndex, layer: 'terrain' as const });
        }
      }
      addTiles(allTilesToAdd);
      return;
    }

    // Manual single-tile brush (default) — no auto-tiling updates
    if (!isAutoBrush || selectedTileset.tilesetType !== 'auto-tiling') {
      const tilesToAdd: Tile[] = [];
      for (let dy = 0; dy < brushSize.height; dy++) {
        for (let dx = 0; dx < brushSize.width; dx++) {
          tilesToAdd.push({
            x: gridX + dx,
            y: gridY + dy,
            tilesetId: selectedTileset.id,
            tileIndex: selectedTileIndex,
            layer: 'terrain',
          });
        }
      }
      addTiles(tilesToAdd);
      return;
    }

    // Enhanced auto-tiling for terrain
    const currentTiles = useCanvasStore.getState().tiles;
    const enhancedAutotilingEnabled = useCanvasStore.getState().enhancedAutotilingEnabled;
    const debugMode = process.env.NODE_ENV === 'development';
    
    // Try enhanced autotiling first (if enabled), fallback to existing logic
    if (enhancedAutotilingEnabled) {
      const allUpdates = new Map<string, Tile>();

      try {
        // Process each brush position with enhanced autotiling
        for (let dy = 0; dy < brushSize.height; dy++) {
          for (let dx = 0; dx < brushSize.width; dx++) {
            const tileX = gridX + dx;
            const tileY = gridY + dy;

            // Debug logging if in development
            if (debugMode) {
              debugAutoTiling(tileX, tileY, selectedTileset.id, currentTiles, 'terrain');
            }

            // Use enhanced autotiling system (synchronous client-side calculation)
            const updates = getEnhancedTilesToUpdate(
              tileX,
              tileY,
              selectedTileset.id,
              currentTiles,
              'add',
              'terrain'
            );

            // Collect all updates, deduplicating by position
            updates.forEach(update => {
              const key = `${update.x},${update.y},${update.tilesetId}`;
              allUpdates.set(key, {
                x: update.x,
                y: update.y,
                tilesetId: update.tilesetId,
                tileIndex: update.tileIndex,
                layer: 'terrain' as const,
              });
            });
          }
        }

        // Apply all updates at once
        addTiles(Array.from(allUpdates.values()));
        
      } catch (error) {
        console.warn('Enhanced autotiling failed, using fallback:', error);
        
        // Fallback to existing autotiling logic
        const tilesToAdd: Tile[] = [];
        for (let dy = 0; dy < brushSize.height; dy++) {
          for (let dx = 0; dx < brushSize.width; dx++) {
            tilesToAdd.push({
              x: gridX + dx,
              y: gridY + dy,
              tilesetId: selectedTileset.id,
              tileIndex: 4, // Default center tile
              layer: 'terrain',
            });
          }
        }

        // Use existing autotiling logic
        const autoTiledTiles = new Map<string, Tile>();
        for (let dy = 0; dy < brushSize.height; dy++) {
          for (let dx = 0; dx < brushSize.width; dx++) {
            const tileX = gridX + dx;
            const tileY = gridY + dy;

            const updates = getCompatibleTilesToUpdate(
              tileX,
              tileY,
              selectedTileset.id,
              [...currentTiles, ...tilesToAdd],
              true,
              'terrain'
            );

            updates.forEach((update) => {
              const key = `${update.x},${update.y},${update.tilesetId}`;
              autoTiledTiles.set(key, {
                x: update.x,
                y: update.y,
                tilesetId: update.tilesetId,
                tileIndex: update.tileIndex,
                layer: 'terrain',
              });
            });
          }
        }

        addTiles(Array.from(autoTiledTiles.values()));
      }
      
      return;
    }
    
    // Fallback to existing autotiling logic
    const tilesToAdd: Tile[] = [];
    for (let dy = 0; dy < brushSize.height; dy++) {
      for (let dx = 0; dx < brushSize.width; dx++) {
        tilesToAdd.push({
          x: gridX + dx,
          y: gridY + dy,
          tilesetId: selectedTileset.id,
          tileIndex: selectedTileIndex,
          layer: 'terrain',
        });
      }
    }

    const simulatedTiles = [...currentTiles];
    tilesToAdd.forEach((newTile) => {
      const existingIndex = simulatedTiles.findIndex(
        (t) => t.x === newTile.x && t.y === newTile.y && t.layer === newTile.layer
      );
      if (existingIndex >= 0) simulatedTiles[existingIndex] = newTile;
      else simulatedTiles.push(newTile);
    });
    
    // Compute final index for each painted tile based on simulated neighbors
    const finalTiles: Tile[] = tilesToAdd.map((tile) => {
      const neighbors = getNeighborConfig(tile.x, tile.y, tile.tilesetId, simulatedTiles, 'terrain');
      const tileIndex = calculateAutoTileIndex(neighbors);
      return { ...tile, tileIndex };
    });

    addTiles(finalTiles);
  };

  const handleShapeClick = (shapeId: string, multiSelect: boolean) => {
    if (multiSelect) {
      const currentSelection = [...selectedIds];
      if (currentSelection.includes(shapeId)) {
        // Remove from selection
        selectMultipleShapes(currentSelection.filter(id => id !== shapeId));
      } else {
        // Add to selection
        selectMultipleShapes([...currentSelection, shapeId]);
      }
    } else {
      // Single select
      selectShape(shapeId, false);
    }
  };

  const handleShapeDragEnd = (shapeId: string, position: { x: number; y: number }) => {
    const existing = shapes.find(s => s.id === shapeId);
    if (!existing) return;
    const newTransform = {
      ...existing.transform,
      x: position.x,
      y: position.y,
    };
    updateShape(shapeId, { transform: newTransform });
  };

  const handleSpriteClick = (spriteId: string) => {
    selectSprite(spriteId);
  };

  const handleSpriteDragEnd = (spriteId: string, position: { x: number; y: number }) => {
    updateSprite(spriteId, {
      x: position.x,
      y: position.y,
    });
  };

  // Use the extracted canvas events hook
  const {
    stageRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleStageDragEnd,
  } = useCanvasEvents({
    tool,
    zoom,
    pan,
    gridSize,
    gridSnap: snapToGrid,
    selectedIds,
    selectedTileset,
    selectedTileIndex,
    selectedSpriteDefId,
    shapes,
    tiles,
    sprites,
    spriteDefinitions,
    currentUser,
    setCurrentShape,
    setIsDrawing,
    setIsSelecting,
    setSelectionStart,
    setSelectionEnd,
    setIsPainting,
    setLastPaintedGrid,
    addShape,
    addSprite,
    addTiles,
    clearSelection,
    selectShape,
    selectMultipleShapes,
    updateShape,
    snapToGridIfEnabled,
    paintTilesAtPosition,
    eraseTilesAtPosition,
  });

  return (
    <div ref={containerRef} className="w-full h-full bg-canvas relative">
      {/* Konva Stage - Main canvas rendering */}
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
        <CanvasRenderer
          // Grid props
          gridVisible={gridVisible}
          gridSize={gridSize}
          zoom={zoom}
          pan={pan}
          stageSize={stageSize}
          
          // Tile props
          tiles={tiles}
          tilesets={tilesets}
          tilesetImages={tilesetImages}
          tilesetIndexImages={tilesetIndexImages}
          layerVisibility={layerVisibility}
          
          // Shape props
          shapes={shapes}
          selectedIds={selectedIds}
          currentShape={currentShape}
          tool={tool}
          
          // Sprite props
          sprites={sprites}
          spriteDefinitions={spriteDefinitions}
          selectedSpriteId={selectedSpriteId}
          animationPreview={animationPreview}
          
          // Selection props
          isSelecting={isSelecting}
          selectionStart={selectionStart}
          selectionEnd={selectionEnd}
          
          // User presence props
          users={users}
          currentUser={currentUser}
          
          // Event handlers
          onShapeClick={handleShapeClick}
          onShapeDragEnd={handleShapeDragEnd}
          onSpriteClick={handleSpriteClick}
          onSpriteDragEnd={handleSpriteDragEnd}
          onShapeTransform={updateShape}
          onMultiTransform={transformSelectedShapes}
        />
      </Stage>
      
      {/* Godot Canvas Layer - Overlay for Godot rendering */}
      {useGodotRendering && godotProjectConfig && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <GodotCanvas
            projectConfig={godotProjectConfig}
            width={stageSize.width}
            height={stageSize.height}
            className="pointer-events-auto"
            autoResize={false}
            onReady={() => {
              console.log('[Canvas] Godot layer is ready');
            }}
            onMessage={(message) => {
              console.log('[Canvas] Message from Godot:', message);
              // Handle Godot messages here
            }}
            onError={(error) => {
              console.error('[Canvas] Godot error:', error);
            }}
          />
        </div>
      )}
    </div>
  );
}
