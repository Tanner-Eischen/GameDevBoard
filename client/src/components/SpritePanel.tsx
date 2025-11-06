import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useSprites, useCreateSprite } from '@/hooks/useSprites';
import { ObjectUploader } from '@/components/ObjectUploader';
import { SpritePreview } from '@/components/SpritePreview';
import { Play, Pause, Plus, Upload, Loader2, ImagePlus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';

export function SpritePanel() {
  const {
    spriteDefinitions,
    selectedSpriteDefId,
    setSelectedSpriteDef,
    animationPreview,
    setAnimationPreview,
  } = useCanvasStore();

  const { data: sprites = [], isLoading } = useSprites();
  const createSprite = useCreateSprite();
  const { toast } = useToast();

  const [showUpload, setShowUpload] = useState(false);
  const [spriteName, setSpriteName] = useState('');
  const [frameWidth, setFrameWidth] = useState(32);
  const [frameHeight, setFrameHeight] = useState(32);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadComplete = async (files: any[]) => {
    if (!files || files.length === 0) {
      toast({
        title: "Upload failed",
        description: "No files were uploaded successfully",
        variant: "destructive",
      });
      return;
    }

    const file = files[0];
    const imageUrl = file?.response?.body?.imageUrl || file?.response?.body?.url || file?.uploadURL || file?.meta?.uploadURL;

    if (!imageUrl) {
      toast({
        title: "Upload failed",
        description: "Could not get image URL from upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Load image to get dimensions
      const img = new Image();
      const loadPromise = new Promise<HTMLImageElement>((resolve: (img: HTMLImageElement) => void, reject: (reason?: any) => void) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      const loadedImg: HTMLImageElement = await loadPromise;
  
      // Calculate total frames assuming grid layout
      const rows = Math.floor(loadedImg.height / frameHeight);
      const cols = Math.floor(loadedImg.width / frameWidth);
      const totalFrames = rows * cols;
  
      if (totalFrames === 0) {
        throw new Error('Invalid frame dimensions - no frames detected');
      }
  
      // Create the sprite in the database
      const spriteData = {
        name: spriteName || 'New Sprite',
        imageUrl,
        frameWidth,
        frameHeight,
        totalFrames,
        category: 'character',
        tags: [],
        metadata: {
          uploadedAt: new Date().toISOString(),
        },
      };
  
      await createSprite.mutateAsync(spriteData);
  
      toast({
        title: "Sprite uploaded successfully",
        description: `${spriteName || 'New Sprite'} has been added to your sprites`,
      });
  
      // Reset form
      setSpriteName('');
      setFrameWidth(32);
      setFrameHeight(32);
      setShowUpload(false);
  
      // Invalidate queries to refresh the sprite list
      queryClient.invalidateQueries({ queryKey: ['/api/sprites'] });
  
    } catch (error) {
      console.error('Failed to create sprite:', error);
      toast({
        title: "Failed to create sprite",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGetUploadParameters = async () => {
    try {
      const data = await apiRequest('POST', '/api/objects/upload');
      // Map server response to ObjectUploader expectations
      return {
        url: data.uploadURL,
        objectPath: data.objectPath,
      };
    } catch (error) {
      console.error('Failed to get upload parameters:', error);
      throw error;
    }
  };

  // Combine database sprites with local sprite definitions
  const allSprites = [
    ...spriteDefinitions,
    ...(Array.isArray(sprites) ? sprites : []).map(sprite => ({
      id: sprite.id,
      name: sprite.name,
      imageUrl: sprite.imageUrl,
      frameWidth: sprite.frameWidth,
      frameHeight: sprite.frameHeight,
      animations: {},
      defaultAnimation: 'idle',
      tags: sprite.tags || [],
    }))
  ];

  return (
    <Card className="h-full overflow-y-auto bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between text-gray-100">
          Sprites
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnimationPreview(!animationPreview)}
              className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
            >
              {animationPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
              className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {showUpload && (
          <div className="p-3 border border-gray-600 rounded-lg bg-gray-750 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200">New Sprite</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUpload(false)}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
                aria-label="Close uploader"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprite-name" className="text-gray-300">Sprite Name</Label>
              <Input
                id="sprite-name"
                value={spriteName}
                onChange={(e) => setSpriteName(e.target.value)}
                placeholder="Enter sprite name"
                className="bg-gray-700 border-gray-600 text-gray-100"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="frame-width" className="text-gray-300">Frame Width</Label>
                <Input
                  id="frame-width"
                  type="number"
                  value={frameWidth}
                  onChange={(e) => setFrameWidth(Number(e.target.value))}
                  min="1"
                  className="bg-gray-700 border-gray-600 text-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frame-height" className="text-gray-300">Frame Height</Label>
                <Input
                  id="frame-height"
                  type="number"
                  value={frameHeight}
                  onChange={(e) => setFrameHeight(Number(e.target.value))}
                  min="1"
                  className="bg-gray-700 border-gray-600 text-gray-100"
                />
              </div>
            </div>

            <ObjectUploader
              onUploadComplete={handleUploadComplete}
              onGetUploadParameters={handleGetUploadParameters}
              allowedFileTypes={['image/*']}
              maxFileSize={10 * 1024 * 1024} // 10MB
              disabled={isUploading}
            >
              <Button 
                variant="outline" 
                className="w-full border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Upload Sprite
                  </>
                )}
              </Button>
            </ObjectUploader>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto">
            {allSprites.map((sprite) => (
              <div
                key={sprite.id}
                className={cn(
                  "p-2 border rounded cursor-pointer transition-colors",
                  selectedSpriteDefId === sprite.id
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                )}
                onClick={() => setSelectedSpriteDef(sprite.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                    <SpritePreview
                      imageUrl={sprite.imageUrl}
                      frameWidth={sprite.frameWidth}
                      frameHeight={sprite.frameHeight}
                      animations={sprite.animations}
                      defaultAnimation={sprite.defaultAnimation}
                      isAnimating={animationPreview}
                      size={32}
                      className="rounded"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-100 truncate">{sprite.name}</div>
                    <div className="text-xs text-gray-400">
                      {sprite.frameWidth}x{sprite.frameHeight}
                      {sprite.tags && sprite.tags.length > 0 && (
                        <span className="ml-2 text-gray-500">
                          {sprite.tags.slice(0, 2).join(', ')}
                          {sprite.tags.length > 2 && '...'}
                        </span>
                      )}
                    </div>
                  </div>
                  {animationPreview && Object.keys(sprite.animations || {}).length > 0 && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            {allSprites.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sprites available</p>
                <p className="text-xs">Upload a sprite to get started</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}