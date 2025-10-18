import { useCanvasStore } from '@/store/useCanvasStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LayersPanel() {
  const { shapes, selectedIds, selectShape, deleteShapes, updateShape } =
    useCanvasStore();

  const sortedShapes = [...shapes].reverse();

  const handleVisibilityToggle = (id: string, locked: boolean) => {
    updateShape(id, {
      metadata: { ...shapes.find((s) => s.id === id)?.metadata!, locked: !locked },
    });
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Layers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 p-2">
        {sortedShapes.length === 0 ? (
          <p className="text-sm text-muted-foreground p-2">No shapes yet</p>
        ) : (
          sortedShapes.map((shape) => {
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
          })
        )}
      </CardContent>
    </Card>
  );
}
