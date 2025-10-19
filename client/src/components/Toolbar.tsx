import { useCanvasStore } from '@/store/useCanvasStore';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  MousePointer,
  Square,
  Circle,
  Hexagon,
  Star,
  Minus,
  Hand,
  Paintbrush,
  Eraser,
  Undo,
  Redo,
  Grid3x3,
  ZoomIn,
  ZoomOut,
  User,
} from 'lucide-react';
import type { ToolType } from '@shared/schema';

const tools: Array<{ type: ToolType | 'sprite'; icon: typeof MousePointer; label: string }> = [
  { type: 'select', icon: MousePointer, label: 'Select (V)' },
  { type: 'pan', icon: Hand, label: 'Pan (H)' },
  { type: 'rectangle', icon: Square, label: 'Rectangle (R)' },
  { type: 'circle', icon: Circle, label: 'Circle (C)' },
  { type: 'polygon', icon: Hexagon, label: 'Polygon (P)' },
  { type: 'star', icon: Star, label: 'Star (S)' },
  { type: 'line', icon: Minus, label: 'Line (L)' },
  { type: 'tile-paint', icon: Paintbrush, label: 'Paint Tile (T)' },
  { type: 'tile-erase', icon: Eraser, label: 'Erase Tile (E)' },
  { type: 'sprite' as any, icon: User, label: 'Sprite (X)' },
];

export function Toolbar() {
  const {
    tool,
    setTool,
    zoom,
    setZoom,
    zoomToCenter,
    undo,
    redo,
    historyIndex,
    history,
    gridVisible,
    setGridVisible,
    snapToGrid,
    setSnapToGrid,
  } = useCanvasStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  // Get viewport dimensions for zooming to center
  const handleZoom = (newZoom: number) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    zoomToCenter(newZoom, viewportWidth, viewportHeight);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-card border-b border-card-border">
      {/* History Controls */}
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={undo}
          disabled={!canUndo}
          data-testid="button-undo"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={redo}
          disabled={!canRedo}
          data-testid="button-redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Tool Selection */}
      <div className="flex items-center gap-1">
        {tools.map(({ type, icon: Icon, label }) => (
          <Button
            key={type}
            size="icon"
            variant={tool === type ? 'default' : 'ghost'}
            onClick={() => setTool(type)}
            data-testid={`button-tool-${type}`}
            title={label}
            className="toggle-elevate"
            data-active={tool === type}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* View Controls */}
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleZoom(zoom * 1.2)}
          data-testid="button-zoom-in"
          title="Zoom In (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-sm font-mono text-muted-foreground min-w-[4rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleZoom(zoom / 1.2)}
          data-testid="button-zoom-out"
          title="Zoom Out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => handleZoom(1)}
          data-testid="button-zoom-reset"
          title="Reset Zoom (0)"
          className="text-xs"
        >
          1:1
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Grid Controls */}
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant={gridVisible ? 'default' : 'ghost'}
          onClick={() => setGridVisible(!gridVisible)}
          data-testid="button-grid-toggle"
          title="Toggle Grid (G)"
          className="toggle-elevate"
          data-active={gridVisible}
        >
          <Grid3x3 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={snapToGrid ? 'default' : 'ghost'}
          onClick={() => setSnapToGrid(!snapToGrid)}
          data-testid="button-snap-toggle"
          title="Snap to Grid (Shift+G)"
          className="toggle-elevate text-xs"
          data-active={snapToGrid}
        >
          Snap
        </Button>
      </div>
    </div>
  );
}
