import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Plus } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import type { SpriteDefinition, AnimationState } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

interface SpriteEditorProps {
  onClose: () => void;
}

export function SpriteEditor({ onClose }: SpriteEditorProps) {
  const { spriteDefinitions, setSpriteDefinitions } = useCanvasStore();
  const [formData, setFormData] = useState({
    name: '',
    frameWidth: 32,
    frameHeight: 32,
    imageFile: null as File | null,
    tags: [] as string[],
    newTag: '',
  });
  const [animations, setAnimations] = useState<{
    [key in AnimationState]?: {
      frames: number[];
      fps: number;
      loop: boolean;
    };
  }>({
    idle: { frames: [0, 1, 2, 3], fps: 4, loop: true },
    walk: { frames: [4, 5, 6, 7], fps: 8, loop: true },
  });
  const [defaultAnimation, setDefaultAnimation] = useState<AnimationState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, imageFile: file }));
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const addTag = () => {
    if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, prev.newTag.trim()],
        newTag: '',
      }));
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const updateAnimation = (state: AnimationState, field: string, value: any) => {
    setAnimations(prev => ({
      ...prev,
      [state]: {
        ...prev[state],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.imageFile) return;

    try {
      // Create FormData for file upload
      const uploadData = new FormData();
      uploadData.append('sprite', formData.imageFile);
      uploadData.append('name', formData.name);

      // Upload sprite sheet
      const response = await fetch('/api/sprites/upload', {
        method: 'POST',
        body: uploadData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const { imageUrl } = await response.json();

      // Create sprite definition
      const newSprite: SpriteDefinition = {
        id: uuidv4(),
        name: formData.name,
        imageUrl,
        frameWidth: formData.frameWidth,
        frameHeight: formData.frameHeight,
        animations,
        advancedAnimations: [], // Initialize empty advanced animations
        timelines: [], // Initialize empty timelines
        defaultAnimation,
        tags: formData.tags,
        category: 'custom', // Default category for user-created sprites
        metadata: {
          version: '1.0.0',
          description: `Custom sprite: ${formData.name}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Update store
      setSpriteDefinitions([...spriteDefinitions, newSprite]);
      onClose();
    } catch (error) {
      console.error('Failed to create sprite:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sprite</DialogTitle>
          <DialogDescription>
            Upload a sprite sheet and configure animations for your game characters
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Sprite Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Knight, Goblin, etc."
              />
            </div>
            <div>
              <Label htmlFor="file">Sprite Sheet</Label>
              <Input
                id="file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Frame Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="frameWidth">Frame Width (px)</Label>
              <Input
                id="frameWidth"
                type="number"
                value={formData.frameWidth}
                onChange={(e) => setFormData(prev => ({ ...prev, frameWidth: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="frameHeight">Frame Height (px)</Label>
              <Input
                id="frameHeight"
                type="number"
                value={formData.frameHeight}
                onChange={(e) => setFormData(prev => ({ ...prev, frameHeight: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <Card>
              <CardContent className="p-4">
                <Label>Preview</Label>
                <div className="mt-2 border rounded p-2 bg-gray-50">
                  <img 
                    src={previewUrl} 
                    alt="Sprite preview" 
                    className="max-w-full h-auto"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={formData.newTag}
                onChange={(e) => setFormData(prev => ({ ...prev, newTag: e.target.value }))}
                placeholder="character, enemy, npc..."
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
              />
              <Button onClick={addTag} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {formData.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Animations */}
          <div>
            <Label>Animations</Label>
            <div className="space-y-3 mt-2">
              {Object.entries(animations).map(([state, config]) => (
                <Card key={state}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="capitalize">{state}</Label>
                      <div className="flex items-center gap-2">
                        <label className="text-xs">
                          Default:
                          <input
                            type="radio"
                            name="defaultAnimation"
                            checked={defaultAnimation === state}
                            onChange={() => setDefaultAnimation(state as AnimationState)}
                            className="ml-1"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <Label className="text-xs">Frames (comma-separated)</Label>
                        <Input
                          value={config?.frames.join(', ') || ''}
                          onChange={(e) => {
                            const frames = e.target.value.split(',').map(f => parseInt(f.trim())).filter(f => !isNaN(f));
                            updateAnimation(state as AnimationState, 'frames', frames);
                          }}
                          placeholder="0, 1, 2, 3"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">FPS</Label>
                        <Input
                          type="number"
                          value={config?.fps || 4}
                          onChange={(e) => updateAnimation(state as AnimationState, 'fps', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={config?.loop || false}
                            onChange={(e) => updateAnimation(state as AnimationState, 'loop', e.target.checked)}
                            className="mr-1"
                          />
                          Loop
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.imageFile}
            >
              Create Sprite
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}