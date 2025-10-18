import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, RegularPolygon, Star } from 'react-konva';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { Shape } from '@shared/schema';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';

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
    selectedTileset,
    selectedTileIndex,
    addTile,
    removeTile,
    currentUser,
  } = useCanvasStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);

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

  const snapToGridIfEnabled = (pos: { x: number; y: number }) => {
    if (!snapToGrid) return pos;
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize,
    };
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const snappedPos = snapToGridIfEnabled({
      x: (pos.x - pan.x) / zoom,
      y: (pos.y - pan.y) / zoom,
    });

    // Handle tile tools
    if (tool === 'tile-paint' && selectedTileset) {
      const gridX = Math.floor(snappedPos.x / gridSize);
      const gridY = Math.floor(snappedPos.y / gridSize);
      addTile({
        x: gridX,
        y: gridY,
        tilesetId: selectedTileset.id,
        tileIndex: selectedTileIndex,
      });
      return;
    }

    if (tool === 'tile-erase') {
      const gridX = Math.floor(snappedPos.x / gridSize);
      const gridY = Math.floor(snappedPos.y / gridSize);
      removeTile(gridX, gridY);
      return;
    }

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

    if (!isDrawing || !currentShape) return;

    const snappedPos = snapToGridIfEnabled(canvasPos);
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
    return tiles.map((tile, index) => {
      const tileset = selectedTileset; // TODO: Look up by tilesetId
      if (!tileset) return null;

      const tileX = (tile.tileIndex % tileset.columns) * tileset.tileSize;
      const tileY = Math.floor(tile.tileIndex / tileset.columns) * tileset.tileSize;

      return (
        <Rect
          key={`tile-${index}`}
          x={tile.x * gridSize}
          y={tile.y * gridSize}
          width={gridSize}
          height={gridSize}
          fill="#6366f1"
          opacity={0.5}
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
