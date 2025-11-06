import { useCanvasStore } from '@/store/useCanvasStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Trash2, Grid3X3, Shapes, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayerVisibility } from '@/contexts/LayerVisibilityContext';

export function LayersPanel() {
  const { 
    shapes, 
    selectedIds, 
    selectShape, 
    deleteShapes, 
    updateShape,
    tiles,
    removeTile,
    useGodotRendering,
    setUseGodotRendering,
    setGodotProjectConfig
  } = useCanvasStore();

  const { layerVisibility, toggleLayerVisibility } = useLayerVisibility();

  const sortedShapes = [...shapes].reverse();
  
  // Group tiles by layer
  const terrainTiles = tiles.filter(tile => tile.layer === 'terrain');
  const propsTiles = tiles.filter(tile => tile.layer === 'props');

  const handleVisibilityToggle = (id: string, locked: boolean) => {
    updateShape(id, {
      metadata: { ...shapes.find((s) => s.id === id)?.metadata!, locked: !locked },
    });
  };

  const clearTileLayer = (layer: 'terrain' | 'props') => {
    // Remove all tiles from the specified layer
    const tilesToRemove = tiles.filter(tile => tile.layer === layer);
    tilesToRemove.forEach(tile => {
      removeTile(tile.x, tile.y, tile.layer);
    });
  };

  const clearAllShapes = () => {
    const allShapeIds = shapes.map(shape => shape.id);
    deleteShapes(allShapeIds);
  };

  const handleGodotToggle = (enabled: boolean) => {
    setUseGodotRendering(enabled);
    if (enabled) {
      setGodotProjectConfig({
        projectPath: '/godot-projects/tilemap-editor/',
        executable: 'index.wasm', // User exported as index.wasm
        canvasSize: {
          width: 800,
          height: 600
        }
      });
    } else {
      setGodotProjectConfig(null);
    }
  };

  return (
    <Card className="h-full overflow-y-hidden bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-gray-100">
          <Grid3X3 className="h-4 w-4" />
          Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-2">
        
        {/* Tile Layers Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Grid3X3 className="h-3 w-3" />
            TILE LAYERS
          </div>
          
          {/* Props Layer */}
          <div className="space-y-1">
            <div
              className={cn(
                'flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer',
                !layerVisibility.props && 'opacity-50'
              )}
            >
              <div className="w-4 h-4 rounded border border-border flex-shrink-0 bg-green-500/20" />
              <span className="text-sm flex-1">Props Layer ({propsTiles.length} tiles)</span>
              <div className="flex gap-1">
                <Button
                   size="icon"
                   variant="ghost"
                   onClick={() => toggleLayerVisibility('props')}
                   className="h-6 w-6"
                   title={layerVisibility.props ? 'Hide props layer' : 'Show props layer'}
                 >
                   {layerVisibility.props ? (
                     <Eye className="h-3 w-3" />
                   ) : (
                     <EyeOff className="h-3 w-3" />
                   )}
                 </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => clearTileLayer('props')}
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  title="Clear all props tiles"
                  disabled={propsTiles.length === 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Terrain Layer */}
          <div className="space-y-1">
            <div
              className={cn(
                'flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer',
                !layerVisibility.terrain && 'opacity-50'
              )}
            >
              <div className="w-4 h-4 rounded border border-border flex-shrink-0 bg-amber-500/20" />
              <span className="text-sm flex-1">Terrain Layer ({terrainTiles.length} tiles)</span>
              <div className="flex gap-1">
                <Button
                   size="icon"
                   variant="ghost"
                   onClick={() => toggleLayerVisibility('terrain')}
                   className="h-6 w-6"
                   title={layerVisibility.terrain ? 'Hide terrain layer' : 'Show terrain layer'}
                 >
                   {layerVisibility.terrain ? (
                     <Eye className="h-3 w-3" />
                   ) : (
                     <EyeOff className="h-3 w-3" />
                   )}
                 </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => clearTileLayer('terrain')}
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  title="Clear all terrain tiles"
                  disabled={terrainTiles.length === 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Shape Layers Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Shapes className="h-3 w-3" />
              SHAPE LAYERS ({sortedShapes.length})
            </div>
            {sortedShapes.length > 0 && (
              <Button
                 size="icon"
                 variant="ghost"
                 onClick={() => toggleLayerVisibility('shapes')}
                 className="h-5 w-5"
                 title={layerVisibility.shapes ? 'Hide all shapes' : 'Show all shapes'}
               >
                 {layerVisibility.shapes ? (
                   <Eye className="h-3 w-3" />
                 ) : (
                   <EyeOff className="h-3 w-3" />
                 )}
               </Button>
            )}
          </div>
          
          {sortedShapes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No shapes yet</p>
          ) : (
            <div className="space-y-1">
              {sortedShapes.map((shape) => {
                const isSelected = selectedIds.includes(shape.id);
                const isLocked = shape.metadata.locked;
                const isVisible = layerVisibility.shapes && !isLocked;

                return (
                  <div
                    key={shape.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer',
                      isSelected && 'bg-accent',
                      !isVisible && 'opacity-50'
                    )}
                    onClick={() => selectShape(shape.id, false)}
                    data-testid={`layer-${shape.id}`}
                  >
                    <div
                      className="w-4 h-4 rounded border border-border flex-shrink-0"
                      style={{ backgroundColor: shape.style.fill }}
                    />
                    <span className="text-sm flex-1 truncate capitalize">
                      {shape.type}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVisibilityToggle(shape.id, isLocked);
                        }}
                        className="h-6 w-6"
                        data-testid={`button-layer-visibility-${shape.id}`}
                        title={isLocked ? 'Show shape' : 'Hide shape'}
                      >
                        {isLocked ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteShapes([shape.id]);
                        }}
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        data-testid={`button-layer-delete-${shape.id}`}
                        title="Delete shape"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {/* Clear all shapes button */}
              {sortedShapes.length > 0 && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearAllShapes}
                    className="w-full text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Clear All Shapes
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Godot Integration Section */}
        <div className="space-y-2 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Gamepad2 className="h-3 w-3" />
            GODOT INTEGRATION
          </div>
          
          <div className="flex items-center justify-between p-2 rounded-md hover-elevate">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-cyan-400" />
              <Label htmlFor="godot-toggle" className="text-sm cursor-pointer">
                Godot Layer
              </Label>
            </div>
            <Switch
              id="godot-toggle"
              checked={useGodotRendering}
              onCheckedChange={handleGodotToggle}
            />
          </div>
          
          {useGodotRendering && (
            <p className="text-xs text-slate-400 px-2">
              Godot HTML5 export overlay is active
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
