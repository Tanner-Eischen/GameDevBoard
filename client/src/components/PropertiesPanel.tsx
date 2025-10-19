import { useCanvasStore } from '@/store/useCanvasStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Trash2, Lock, Unlock } from 'lucide-react';

interface PropertiesPanelProps {
  className?: string;
}

export function PropertiesPanel({ className }: PropertiesPanelProps) {
  const { shapes, selectedIds, updateShape, deleteShapes } = useCanvasStore();

  const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));

  if (selectedShapes.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader>
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a shape to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const shape = selectedShapes[0];
  const multiSelect = selectedShapes.length > 1;

  const handleTransformChange = (key: string, value: number) => {
    selectedShapes.forEach((s) => {
      updateShape(s.id, {
        transform: { ...s.transform, [key]: value },
      });
    });
  };

  const handleStyleChange = (key: string, value: string | number) => {
    selectedShapes.forEach((s) => {
      updateShape(s.id, {
        style: { ...s.style, [key]: value },
      });
    });
  };

  const handleTextChange = (value: string) => {
    selectedShapes.forEach((s) => {
      updateShape(s.id, { text: value });
    });
  };

  const handleDelete = () => {
    deleteShapes(selectedIds);
  };

  const toggleLock = () => {
    selectedShapes.forEach((s) => {
      updateShape(s.id, {
        metadata: { ...s.metadata, locked: !s.metadata.locked },
      });
    });
  };

  const activeGroupId = shape.metadata.groupId;
  const allInSameGroup = activeGroupId && selectedShapes.every((s) => s.metadata.groupId === activeGroupId);

  return (
    <Card className={cn('overflow-auto', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {multiSelect ? `${selectedShapes.length} shapes selected` : shape.type}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLock}
              data-testid="button-lock"
              title={shape.metadata.locked ? 'Unlock' : 'Lock'}
              className="h-7 w-7"
            >
              {shape.metadata.locked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              data-testid="button-delete"
              title="Delete (Del)"
              className="h-7 w-7 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {allInSameGroup && (
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-[11px] text-muted-foreground">
            Group ID: {activeGroupId.slice(0, 8)}
          </div>
        )}

        {/* Transform */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transform
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="x" className="text-xs">
                X
              </Label>
              <Input
                id="x"
                type="number"
                value={Math.round(shape.transform.x)}
                onChange={(e) =>
                  handleTransformChange('x', parseFloat(e.target.value))
                }
                className="h-8 font-mono text-xs"
                data-testid="input-x"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="y" className="text-xs">
                Y
              </Label>
              <Input
                id="y"
                type="number"
                value={Math.round(shape.transform.y)}
                onChange={(e) =>
                  handleTransformChange('y', parseFloat(e.target.value))
                }
                className="h-8 font-mono text-xs"
                data-testid="input-y"
              />
            </div>
          </div>

          {shape.type !== 'line' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="width" className="text-xs">
                  Width
                </Label>
                <Input
                  id="width"
                  type="number"
                  value={Math.round(shape.transform.width)}
                  onChange={(e) =>
                    handleTransformChange('width', parseFloat(e.target.value))
                  }
                  className="h-8 font-mono text-xs"
                  data-testid="input-width"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="height" className="text-xs">
                  Height
                </Label>
                <Input
                  id="height"
                  type="number"
                  value={Math.round(shape.transform.height)}
                  onChange={(e) =>
                    handleTransformChange('height', parseFloat(e.target.value))
                  }
                  className="h-8 font-mono text-xs"
                  data-testid="input-height"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="rotation" className="text-xs">
              Rotation: {Math.round(shape.transform.rotation)}°
            </Label>
            <Slider
              id="rotation"
              value={[shape.transform.rotation]}
              onValueChange={([value]) => handleTransformChange('rotation', value)}
              min={0}
              max={360}
              step={1}
              data-testid="slider-rotation"
            />
          </div>
        </div>

        <Separator />

        {/* Style */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Style
          </Label>

          <div className="space-y-1">
            <Label htmlFor="fill" className="text-xs">
              Fill
            </Label>
            <div className="flex gap-2">
              <Input
                id="fill"
                type="color"
                value={shape.style.fill === 'transparent' ? '#000000' : shape.style.fill}
                onChange={(e) => handleStyleChange('fill', e.target.value)}
                className="h-8 w-12 p-1"
                data-testid="input-fill"
              />
              <Input
                type="text"
                value={shape.style.fill}
                onChange={(e) => handleStyleChange('fill', e.target.value)}
                className="h-8 flex-1 font-mono text-xs"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="stroke" className="text-xs">
              Stroke
            </Label>
            <div className="flex gap-2">
              <Input
                id="stroke"
                type="color"
                value={shape.style.stroke}
                onChange={(e) => handleStyleChange('stroke', e.target.value)}
                className="h-8 w-12 p-1"
                data-testid="input-stroke"
              />
              <Input
                type="text"
                value={shape.style.stroke}
                onChange={(e) => handleStyleChange('stroke', e.target.value)}
                className="h-8 flex-1 font-mono text-xs"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="strokeWidth" className="text-xs">
              Stroke Width: {shape.style.strokeWidth}px
            </Label>
            <Slider
              id="strokeWidth"
              value={[shape.style.strokeWidth]}
              onValueChange={([value]) => handleStyleChange('strokeWidth', value)}
              min={0}
              max={20}
              step={1}
              data-testid="slider-stroke-width"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="opacity" className="text-xs">
              Opacity: {Math.round(shape.style.opacity * 100)}%
            </Label>
            <Slider
              id="opacity"
              value={[shape.style.opacity * 100]}
              onValueChange={([value]) => handleStyleChange('opacity', value / 100)}
              min={0}
              max={100}
              step={1}
              data-testid="slider-opacity"
            />
          </div>
        </div>

        {shape.type === 'text' && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Text
              </Label>
              <Textarea
                value={shape.text ?? ''}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Enter text content"
                className="min-h-[80px] text-sm"
              />
              <div className="space-y-1">
                <Label htmlFor="font-size" className="text-xs">
                  Font Size
                </Label>
                <Input
                  id="font-size"
                  type="number"
                  value={Math.round(shape.style.fontSize ?? 28)}
                  onChange={(e) => handleStyleChange('fontSize', parseFloat(e.target.value))}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
