import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, Plus, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpriteEditor } from './SpriteEditor';
import { v4 as uuidv4 } from 'uuid';
import type { SpriteInstance } from '@shared/schema';

export function SpritePanel() {
  const {
    spriteDefinitions,
    selectedSpriteDefId,
    selectedSpriteId,
    sprites,
    animationPreview,
    setSelectedSpriteDef,
    setAnimationPreview,
    addSprite,
    updateSprite,
  } = useCanvasStore();

  const [showEditor, setShowEditor] = useState(false);
  const selectedSprite = sprites.find(s => s.id === selectedSpriteId);
  const selectedDef = spriteDefinitions.find(d => d.id === selectedSpriteDefId);

  const handleAddSprite = () => {
    if (!selectedDef) return;

    const newSprite: SpriteInstance = {
      id: uuidv4(),
      spriteId: selectedDef.id,
      x: 200,
      y: 200,
      scale: 1,
      rotation: 0,
      currentAnimation: selectedDef.defaultAnimation,
      flipX: false,
      flipY: false,
      layer: 1,
      metadata: {
        createdBy: 'local',
        createdAt: Date.now(),
        locked: false,
      },
    };

    addSprite(newSprite);
  };

  const handleAnimationChange = (animation: string) => {
    if (!selectedSprite) return;
    updateSprite(selectedSprite.id, { currentAnimation: animation as any });
  };

  const handleFlipX = () => {
    if (!selectedSprite) return;
    updateSprite(selectedSprite.id, { flipX: !selectedSprite.flipX });
  };

  const handleFlipY = () => {
    if (!selectedSprite) return;
    updateSprite(selectedSprite.id, { flipY: !selectedSprite.flipY });
  };

  const handleRotate = () => {
    if (!selectedSprite) return;
    updateSprite(selectedSprite.id, { 
      rotation: (selectedSprite.rotation + 90) % 360 
    });
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Sprites</CardTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowEditor(true)}
            className="h-7 w-7"
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Animation Preview Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="preview" className="text-xs">Preview Animations</Label>
          <Switch
            id="preview"
            checked={animationPreview}
            onCheckedChange={setAnimationPreview}
          />
        </div>

        {/* Sprite Library */}
        <div className="space-y-2">
          <Label className="text-xs">Sprite Library</Label>
          <ScrollArea className="h-32 border rounded-md p-2">
            <div className="grid grid-cols-3 gap-2">
              {spriteDefinitions.map((def) => (
                <button
                  key={def.id}
                  className={cn(
                    "p-2 border rounded hover:bg-accent",
                    selectedSpriteDefId === def.id && "bg-accent border-primary"
                  )}
                  onClick={() => setSelectedSpriteDef(def.id)}
                >
                  <div className="text-xs truncate">{def.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {def.frameWidth}x{def.frameHeight}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          {selectedDef && (
            <Button 
              size="sm" 
              onClick={handleAddSprite}
              className="w-full"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add to Canvas
            </Button>
          )}
        </div>

        {/* Selected Sprite Controls */}
        {selectedSprite && (
          <div className="space-y-3 pt-3 border-t">
            <Label className="text-xs">Selected Sprite</Label>
            
            {/* Animation State */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Animation</Label>
              <select
                className="w-full p-1 text-xs border rounded"
                value={selectedSprite.currentAnimation}
                onChange={(e) => handleAnimationChange(e.target.value)}
              >
                {selectedDef && Object.keys(selectedDef.animations).map((anim) => (
                  <option key={anim} value={anim}>{anim}</option>
                ))}
              </select>
            </div>

            {/* Transform Controls */}
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                onClick={handleFlipX}
                className="h-7 w-7"
                title="Flip Horizontal"
              >
                <FlipHorizontal className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={handleFlipY}
                className="h-7 w-7"
                title="Flip Vertical"
              >
                <FlipVertical className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={handleRotate}
                className="h-7 w-7"
                title="Rotate 90°"
              >
                <RotateCw className="h-3 w-3" />
              </Button>
            </div>

            {/* Scale Control */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Scale: {selectedSprite.scale.toFixed(1)}x
              </Label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={selectedSprite.scale}
                onChange={(e) => updateSprite(selectedSprite.id, { 
                  scale: parseFloat(e.target.value) 
                })}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Sprite Editor Dialog */}
        {showEditor && (
          <SpriteEditor onClose={() => setShowEditor(false)} />
        )}
      </CardContent>
    </Card>
  );
}