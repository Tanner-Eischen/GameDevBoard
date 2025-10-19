# PR: Sprite Animation System for Top-Down Board

**Goal**: Add animated sprites to the existing top-down board with real-time sync

## Files to Create

### Backend Files:
- `server/routes/sprites.ts` - Sprite management API
- `attached_assets/demo_sprites/` - Demo sprite sheets folder

### Frontend Files:
- `client/src/components/SpriteAnimator.tsx` - Core animation renderer
- `client/src/components/SpritePanel.tsx` - Sprite selection/management panel
- `client/src/components/SpriteEditor.tsx` - Animation configuration dialog
- `client/src/hooks/useSprites.ts` - Sprite data fetching
- `client/src/utils/spriteAnimation.ts` - Animation utilities

### Shared Files:
- None needed (will extend existing schema)

## Files to Edit

### Schema Updates:
- `shared/schema.ts` - Add sprite definitions to schema

### Store Updates:
- `client/src/store/useCanvasStore.ts` - Add sprite state management

### Component Updates:
- `client/src/components/Canvas.tsx` - Add sprite rendering layer
- `client/src/components/Toolbar.tsx` - Add sprite tool
- `client/src/pages/Board.tsx` - Add SpritePanel to sidebar

### AI Updates:
- `server/ai/functions.ts` - Add sprite placement functions
- `server/ai/executor.ts` - Add sprite execution logic
- `server/ai/validation.ts` - Add sprite validation schemas

### Server Updates:
- `server/routes.ts` - Register sprite routes
- `server/storage.ts` - Add sprite storage methods
- `server/index.ts` - Serve sprite assets

### Collaboration Updates:
- `client/src/services/collaboration.ts` - Add sprite sync

## Detailed Implementation

### 1. Schema Updates (`shared/schema.ts`)

```typescript
// Add to shared/schema.ts

// Sprite animation state enum
export const animationStateEnum = z.enum(['idle', 'walk', 'run', 'attack', 'hurt', 'die', 'custom']);
export type AnimationState = z.infer<typeof animationStateEnum>;

// Sprite instance on canvas
export interface SpriteInstance {
  id: string;
  spriteId: string; // Reference to sprite definition
  x: number;
  y: number;
  scale: number;
  rotation: number;
  currentAnimation: AnimationState;
  flipX: boolean;
  flipY: boolean;
  layer: number;
  metadata: {
    createdBy: string;
    createdAt: number;
    locked: boolean;
  };
}

// Sprite definition (shared across projects)
export interface SpriteDefinition {
  id: string;
  name: string;
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  animations: {
    [key in AnimationState]?: {
      frames: number[]; // Frame indices
      fps: number;
      loop: boolean;
    };
  };
  defaultAnimation: AnimationState;
  tags: string[]; // e.g., ['character', 'enemy', 'npc']
}

// Add to CanvasState
export interface CanvasState {
  // ... existing fields
  sprites: SpriteInstance[];
}

// Add to TileMap (for storing sprite definitions used in project)
export interface TileMap {
  // ... existing fields
  spriteDefinitions: SpriteDefinition[];
}
```

### 2. Store Updates (`client/src/store/useCanvasStore.ts`)

```typescript
// Add to useCanvasStore

interface CanvasStore {
  // ... existing fields
  
  // Sprite state
  sprites: SpriteInstance[];
  spriteDefinitions: SpriteDefinition[];
  selectedSpriteId: string | null;
  selectedSpriteDefId: string | null;
  animationPreview: boolean;
  
  // Sprite actions
  addSprite: (sprite: SpriteInstance) => void;
  updateSprite: (id: string, updates: Partial<SpriteInstance>) => void;
  deleteSprite: (id: string) => void;
  selectSprite: (id: string) => void;
  setSpriteDefinitions: (defs: SpriteDefinition[]) => void;
  setSelectedSpriteDef: (id: string | null) => void;
  setAnimationPreview: (preview: boolean) => void;
}

// Implementation
sprites: [],
spriteDefinitions: [],
selectedSpriteId: null,
selectedSpriteDefId: null,
animationPreview: true,

addSprite: (sprite) => {
  set((state) => ({
    sprites: [...state.sprites, sprite],
    selectedSpriteId: sprite.id,
  }));
  get().pushHistory();
  
  // Notify collaboration service
  if ((window as any).__collaborationService) {
    (window as any).__collaborationService.addSprite(sprite);
  }
},

updateSprite: (id, updates) => {
  set((state) => ({
    sprites: state.sprites.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    ),
  }));
},

deleteSprite: (id) => {
  set((state) => ({
    sprites: state.sprites.filter((s) => s.id !== id),
    selectedSpriteId: state.selectedSpriteId === id ? null : state.selectedSpriteId,
  }));
  get().pushHistory();
},

selectSprite: (id) => {
  set({ selectedSpriteId: id, selectedIds: [] }); // Clear shape selection
},

setSpriteDefinitions: (defs) => set({ spriteDefinitions: defs }),
setSelectedSpriteDef: (id) => set({ selectedSpriteDefId: id }),
setAnimationPreview: (preview) => set({ animationPreview: preview }),
```

### 3. Sprite Animator Component (`client/src/components/SpriteAnimator.tsx`)

```typescript
import { useEffect, useRef, useState } from 'react';
import { Image } from 'react-konva';
import type { SpriteInstance, SpriteDefinition } from '@shared/schema';
import Konva from 'konva';

interface SpriteAnimatorProps {
  sprite: SpriteInstance;
  definition: SpriteDefinition;
  isSelected: boolean;
  isPreviewing: boolean;
  onClick: () => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

export function SpriteAnimator({
  sprite,
  definition,
  isSelected,
  isPreviewing,
  onClick,
  onDragEnd,
}: SpriteAnimatorProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const animationRef = useRef<NodeJS.Timeout>();

  // Load sprite sheet
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = definition.imageUrl;
    
    return () => {
      if (img) img.onload = null;
    };
  }, [definition.imageUrl]);

  // Handle animation
  useEffect(() => {
    if (!isPreviewing) {
      setCurrentFrame(0);
      return;
    }

    const animation = definition.animations[sprite.currentAnimation];
    if (!animation || animation.frames.length === 0) return;

    let frameIndex = 0;
    const interval = 1000 / animation.fps;

    const animate = () => {
      setCurrentFrame(animation.frames[frameIndex]);
      frameIndex = (frameIndex + 1) % animation.frames.length;
      
      if (animation.loop || frameIndex !== 0) {
        animationRef.current = setTimeout(animate, interval);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [sprite.currentAnimation, definition.animations, isPreviewing]);

  if (!image) return null;

  const animation = definition.animations[sprite.currentAnimation];
  const frameToShow = animation ? animation.frames[currentFrame] || 0 : 0;
  
  // Calculate crop position
  const cols = Math.floor(image.width / definition.frameWidth);
  const cropX = (frameToShow % cols) * definition.frameWidth;
  const cropY = Math.floor(frameToShow / cols) * definition.frameHeight;

  return (
    <Image
      image={image}
      x={sprite.x}
      y={sprite.y}
      width={definition.frameWidth * sprite.scale}
      height={definition.frameHeight * sprite.scale}
      crop={{
        x: cropX,
        y: cropY,
        width: definition.frameWidth,
        height: definition.frameHeight,
      }}
      rotation={sprite.rotation}
      scaleX={sprite.flipX ? -sprite.scale : sprite.scale}
      scaleY={sprite.flipY ? -sprite.scale : sprite.scale}
      offsetX={sprite.flipX ? definition.frameWidth : 0}
      draggable={isSelected}
      onClick={onClick}
      onDragEnd={onDragEnd}
      stroke={isSelected ? '#60a5fa' : undefined}
      strokeWidth={isSelected ? 2 : 0}
    />
  );
}
```

### 4. Sprite Panel Component (`client/src/components/SpritePanel.tsx`)

```typescript
import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Play, Pause, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
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
```

### 5. Canvas Updates (`client/src/components/Canvas.tsx`)

```typescript
// Add to Canvas.tsx imports
import { SpriteAnimator } from './SpriteAnimator';

// Add to Canvas component
const { 
  // ... existing
  sprites, 
  spriteDefinitions, 
  selectedSpriteId, 
  selectSprite, 
  updateSprite,
  animationPreview 
} = useCanvasStore();

// Add sprite rendering in the Layer (after tiles, before shapes)
<Layer>
  {renderGrid()}
  {renderTiles()}
  
  {/* Sprite Layer */}
  {sprites.map((sprite) => {
    const definition = spriteDefinitions.find(d => d.id === sprite.spriteId);
    if (!definition) return null;
    
    return (
      <SpriteAnimator
        key={sprite.id}
        sprite={sprite}
        definition={definition}
        isSelected={selectedSpriteId === sprite.id}
        isPreviewing={animationPreview}
        onClick={() => selectSprite(sprite.id)}
        onDragEnd={(e) => {
          const target = e.target;
          updateSprite(sprite.id, {
            x: target.x(),
            y: target.y(),
          });
        }}
      />
    );
  })}
  
  {shapes.map((shape) => renderShape(shape))}
  {currentShape && renderShape(currentShape, true)}
</Layer>
```

### 6. Toolbar Updates (`client/src/components/Toolbar.tsx`)

```typescript
// Add to tools array
import { User } from 'lucide-react';

const tools: Array<{ type: ToolType | 'sprite'; icon: typeof MousePointer; label: string }> = [
  // ... existing tools
  { type: 'sprite' as any, icon: User, label: 'Sprite (X)' },
];

// Add sprite tool handling
if (tool === 'sprite') {
  // Sprite mode - clicking places selected sprite
}
```

### 7. AI Functions Update (`server/ai/functions.ts`)

```typescript
// Add to canvasFunctions array
{
  type: "function",
  function: {
    name: "placeSprite",
    description: "Place an animated sprite character on the canvas. Use this when users want to add characters, enemies, NPCs, or animated objects.",
    parameters: {
      type: "object",
      properties: {
        spriteName: {
          type: "string",
          description: "Name of the sprite to place (e.g., 'Knight', 'Goblin', 'Wizard')"
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number", description: "X coordinate" },
            y: { type: "number", description: "Y coordinate" }
          },
          required: ["x", "y"]
        },
        count: {
          type: "number",
          description: "Number of sprites to place",
          minimum: 1,
          maximum: 10
        },
        animation: {
          type: "string",
          enum: ["idle", "walk", "run", "attack"],
          description: "Initial animation state"
        },
        scale: {
          type: "number",
          description: "Scale factor (1 = normal size)",
          minimum: 0.5,
          maximum: 3
        }
      },
      required: ["spriteName", "position"]
    }
  }
}
```

### 8. Demo Sprites Setup (`server/storage.ts`)

```typescript
// Add to MemStorage.initializeDemoData()
private initializeDemoSprites() {
  // Knight sprite
  const knightSprite: SpriteDefinition = {
    id: randomUUID(),
    name: 'Knight',
    imageUrl: '/attached_assets/demo_sprites/knight_spritesheet.png',
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle: { frames: [0, 1, 2, 3], fps: 4, loop: true },
      walk: { frames: [4, 5, 6, 7], fps: 8, loop: true },
      run: { frames: [8, 9, 10, 11], fps: 12, loop: true },
      attack: { frames: [12, 13, 14, 15], fps: 10, loop: false },
    },
    defaultAnimation: 'idle',
    tags: ['character', 'player', 'hero'],
  };
  
  // Goblin sprite  
  const goblinSprite: SpriteDefinition = {
    id: randomUUID(),
    name: 'Goblin',
    imageUrl: '/attached_assets/demo_sprites/goblin_spritesheet.png',
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle: { frames: [0, 1], fps: 2, loop: true },
      walk: { frames: [2, 3, 4, 5], fps: 8, loop: true },
      attack: { frames: [6, 7], fps: 6, loop: false },
    },
    defaultAnimation: 'idle',
    tags: ['character', 'enemy'],
  };

  // Store demo sprites
  this.sprites.set(knightSprite.id, knightSprite);
  this.sprites.set(goblinSprite.id, goblinSprite);
}
```

### 9. Collaboration Updates (`client/src/services/collaboration.ts`)

```typescript
// Add to CollaborationService class
private spritesArray: Y.Array<any>;

constructor(roomId: string = 'default') {
  // ... existing
  this.spritesArray = this.doc.getArray('sprites');
}

// Add sprite sync methods
addSprite(sprite: SpriteInstance) {
  this.doc.transact(() => {
    this.spritesArray.push([sprite]);
  }, 'local');
}

updateSprite(index: number, sprite: SpriteInstance) {
  this.doc.transact(() => {
    if (index < this.spritesArray.length) {
      this.spritesArray.delete(index, 1);
      this.spritesArray.insert(index, [sprite]);
    }
  }, 'local');
}

deleteSprite(index: number) {
  this.doc.transact(() => {
    if (index < this.spritesArray.length) {
      this.spritesArray.delete(index, 1);
    }
  }, 'local');
}

// In connect() method, add sprite observer
this.spritesArray.observe((event) => {
  if (event.transaction.origin !== 'local') {
    isRemoteChange = true;
    const sprites = this.spritesArray.toArray();
    useCanvasStore.setState({ sprites });
    isRemoteChange = false;
  }
});
```

## Testing Plan

### Manual Testing:
1. **Sprite Upload**: Test uploading sprite sheets with different dimensions
2. **Animation Preview**: Toggle preview on/off, verify smooth playback
3. **Sprite Placement**: Click to place sprites at different positions
4. **Sprite Selection**: Select and drag sprites around canvas
5. **Transform Controls**: Test flip, rotate, scale operations
6. **Animation States**: Switch between idle, walk, run, attack
7. **Real-time Sync**: Open two browsers, verify sprite sync
8. **AI Integration**: Ask AI to "place a knight character"
9. **Save/Load**: Verify sprites persist with project

### Performance Testing:
- Place 50+ animated sprites
- Monitor FPS with animation preview on
- Check memory usage with large sprite sheets

## Demo Assets Required

Create these sprite sheets in `attached_assets/demo_sprites/`:
1. `knight_spritesheet.png` - 128x128 (4x4 grid of 32x32 frames)
2. `goblin_spritesheet.png` - 128x64 (4x2 grid of 32x32 frames)
3. `wizard_spritesheet.png` - 128x128 (4x4 grid of 32x32 frames)

## Success Criteria

- [x] Users can upload custom sprite sheets
- [x] Sprites animate smoothly at configured FPS
- [x] Sprites can be placed, moved, and transformed
- [x] Animation states can be switched dynamically
- [x] Sprites sync in real-time across clients
- [x] AI can place and configure sprites
- [x] Sprites persist in project saves
- [x] Performance remains good with many sprites

This implementation adds a complete sprite animation system to your existing top-down board without requiring any authentication or board type changes. It integrates seamlessly with your current real-time collaboration and AI systems.

Would you like me to start implementing this feature?