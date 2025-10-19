import { useCanvasStore } from '@/store/useCanvasStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, Trash2, MapPin, Square, Layers2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export function LayersPanel() {
  const { 
    shapes, 
    selectedIds, 
    selectShape, 
    deleteShapes, 
    updateShape,
    tiles,
    removeTile,
    tilesets,
    sprites,
    selectSprite,
    selectedSpriteId,
    deleteSprite,
    updateSprite,
    spriteDefinitions,
    setPan,
    zoom,
  } = useCanvasStore();

  // Group tiles by tileset for better organization
  const tileGroups = useMemo(() => {
    const groups = new Map<string, typeof tiles>();
    tiles.forEach(tile => {
      const tileset = tilesets.find(t => t.id === tile.tilesetId);
      const key = tileset ? `${tileset.name} (${tile.layer})` : `Unknown (${tile.layer})`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tile);
    });
    return groups;
  }, [tiles, tilesets]);

  const sortedShapes = [...shapes].reverse();

  const handleVisibilityToggle = (id: string, locked: boolean) => {
    updateShape(id, {
      metadata: { ...shapes.find((s) => s.id === id)?.metadata!, locked: !locked },
    });
  };

  const handleSpriteVisibilityToggle = (id: string) => {
    const sprite = sprites.find(s => s.id === id);
    if (sprite) {
      updateSprite(id, {
        metadata: { ...sprite.metadata, locked: !sprite.metadata.locked },
      });
    }
  };

  const snapToObject = (x: number, y: number) => {
    // Calculate viewport center
    const canvasContainer = document.querySelector('.bg-canvas');
    const viewportWidth = canvasContainer ? canvasContainer.clientWidth : 800;
    const viewportHeight = canvasContainer ? canvasContainer.clientHeight : 600;
    
    // Center the object in viewport
    const newPanX = viewportWidth / 2 - x * zoom;
    const newPanY = viewportHeight / 2 - y * zoom;
    
    setPan({ x: newPanX, y: newPanY });
  };

  const snapToTileGroup = (groupTiles: typeof tiles) => {
    if (groupTiles.length === 0) return;
    
    // Calculate average position of tiles in group
    const avgX = groupTiles.reduce((sum, t) => sum + t.x, 0) / groupTiles.length;
    const avgY = groupTiles.reduce((sum, t) => sum + t.y, 0) / groupTiles.length;
    
    snapToObject(avgX * 16, avgY * 16); // Assuming grid size 16
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Layers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-2">
        <ScrollArea className="h-[calc(100%-2rem)]">
          {/* Shapes Section */}
          {sortedShapes.length > 0 && (
            <div className="space-y-1 mb-3">
              <div className="flex items-center gap-2 px-2 py-1">
                <Square className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Shapes ({sortedShapes.length})</span>
              </div>
              {sortedShapes.map((shape) => {
                const isSelected = selectedIds.includes(shape.id);
                const isLocked = shape.metadata.locked;

                return (
                  <div
                    key={shape.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer',
                      isSelected && 'bg-accent'
                    )}
                    onClick={() => selectShape(shape.id, false)}
                    data-testid={`layer-shape-${shape.id}`}
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
                          snapToObject(shape.transform.x, shape.transform.y);
                        }}
                        className="h-6 w-6"
                        data-testid={`button-snap-shape-${shape.id}`}
                      >
                        <MapPin className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVisibilityToggle(shape.id, isLocked);
                        }}
                        className="h-6 w-6"
                        data-testid={`button-layer-visibility-${shape.id}`}
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
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sprites Section */}
          {sprites.length > 0 && (
            <div className="space-y-1 mb-3">
              <div className="flex items-center gap-2 px-2 py-1">
                <Sparkles className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Sprites ({sprites.length})</span>
              </div>
              {sprites.map((sprite) => {
                const spriteDef = spriteDefinitions.find(d => d.id === sprite.spriteId);
                const isSelected = selectedSpriteId === sprite.id;
                const isLocked = sprite.metadata.locked;

                return (
                  <div
                    key={sprite.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer',
                      isSelected && 'bg-accent'
                    )}
                    onClick={() => selectSprite(sprite.id)}
                    data-testid={`layer-sprite-${sprite.id}`}
                  >
                    <div className="w-4 h-4 rounded border border-border flex-shrink-0 bg-primary/20 flex items-center justify-center">
                      <Sparkles className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-sm flex-1 truncate">
                      {spriteDef?.name || 'Unknown Sprite'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          snapToObject(sprite.x, sprite.y);
                        }}
                        className="h-6 w-6"
                        data-testid={`button-snap-sprite-${sprite.id}`}
                      >
                        <MapPin className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpriteVisibilityToggle(sprite.id);
                        }}
                        className="h-6 w-6"
                        data-testid={`button-sprite-visibility-${sprite.id}`}
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
                          deleteSprite(sprite.id);
                        }}
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        data-testid={`button-sprite-delete-${sprite.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tiles Section */}
          {tileGroups.size > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1">
                <Layers2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Tiles ({tiles.length})</span>
              </div>
              {Array.from(tileGroups.entries()).map(([groupName, groupTiles]) => (
                <div
                  key={groupName}
                  className="flex items-center gap-2 p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => snapToTileGroup(groupTiles)}
                  data-testid={`layer-tile-group-${groupName}`}
                >
                  <div className="w-4 h-4 rounded border border-border flex-shrink-0 bg-accent/30" />
                  <span className="text-sm flex-1 truncate">
                    {groupName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {groupTiles.length}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      snapToTileGroup(groupTiles);
                    }}
                    className="h-6 w-6"
                    data-testid={`button-snap-tile-group-${groupName}`}
                  >
                    <MapPin className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {shapes.length === 0 && sprites.length === 0 && tiles.length === 0 && (
            <p className="text-sm text-muted-foreground p-2 text-center">
              No objects on canvas yet
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
