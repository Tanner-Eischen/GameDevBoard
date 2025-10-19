import { useCanvasStore } from '@/store/useCanvasStore';
import { useTilesets } from '@/hooks/useTilesets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Loader2, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ObjectUploader } from '@/components/ObjectUploader';
import type { UploadResult } from '@uppy/core';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function TilesetPanel() {
  const {
    selectedTileset,
    selectedTileIndex,
    setSelectedTileset,
    setSelectedTileIndex,
    setTilesets,
    gridSize,
  } = useCanvasStore();

  const { data: tilesets, isLoading } = useTilesets();
  const [showUpload, setShowUpload] = useState(false);
  const [tilesetName, setTilesetName] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (tilesets) {
      setTilesets(tilesets);
    }
  }, [tilesets, setTilesets]);

  const handleGetUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
    });
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (!result.successful || result.successful.length === 0) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload tileset image',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const file = result.successful[0];
      const uploadURL = file.uploadURL;

      if (!uploadURL) {
        throw new Error('Upload URL not found');
      }

      // For 3x3 tileset with 1px spacing: 50x50 image
      // Each tile is 16x16, with 1px spacing between them
      const tileSize = 16;
      const spacing = 1;
      const columns = 3;
      const rows = 3;

      // Create tileset in database with placeholder URL first
      const createRes = await apiRequest('POST', '/api/tilesets', {
        name: tilesetName || 'Untitled Tileset',
        tileSize,
        spacing,
        imageUrl: 'pending',
        columns,
        rows,
      });
      const newTileset = await createRes.json();

      // Update tileset with normalized object path
      const updateRes = await apiRequest('PUT', `/api/tilesets/${newTileset.id}/image`, {
        imageURL: uploadURL,
      });
      const updatedTileset = await updateRes.json();

      // Now we can use the normalized path to parse the image
      if (updatedTileset.imageUrl) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = updatedTileset.imageUrl;
        });
      }

      toast({
        title: 'Success',
        description: 'Tileset uploaded successfully',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/tilesets'] });
      setShowUpload(false);
      setTilesetName('');
    } catch (error) {
      console.error('Error creating tileset:', error);
      toast({
        title: 'Error',
        description: 'Failed to create tileset',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Tilesets</CardTitle>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowUpload(!showUpload)}
            data-testid="button-add-tileset"
            className="h-7 w-7"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUpload && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-md">
            <div className="space-y-1.5">
              <Label htmlFor="tileset-name" className="text-xs">
                Tileset Name
              </Label>
              <Input
                id="tileset-name"
                placeholder="My Tileset"
                className="h-8"
                data-testid="input-tileset-name"
                value={tilesetName}
                onChange={(e) => setTilesetName(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">3x3 Tileset Image (48x48)</Label>
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10485760}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="w-full"
              >
                <ImagePlus className="h-3 w-3 mr-2" />
                Select Image
              </ObjectUploader>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowUpload(false);
                  setTilesetName('');
                }}
                data-testid="button-cancel-upload"
                disabled={uploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !tilesets || tilesets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              No tilesets uploaded yet
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUpload(true)}
              data-testid="button-upload-first-tileset"
            >
              <Upload className="h-3 w-3 mr-2" />
              Upload Tileset
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {tilesets.map((tileset) => (
              <div key={tileset.id} className="space-y-2">
                <Button
                  variant={selectedTileset?.id === tileset.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setSelectedTileset(tileset)}
                  data-testid={`button-tileset-${tileset.id}`}
                >
                  {tileset.name}
                </Button>

                {selectedTileset?.id === tileset.id && (
                  <div className="grid grid-cols-3 gap-1 p-2 bg-muted/30 rounded-md">
                    {Array.from({ length: tileset.rows * tileset.columns }).map(
                      (_, index) => {
                        const col = index % tileset.columns;
                        const row = Math.floor(index / tileset.columns);
                        const tileSize = tileset.tileSize;
                        const spacing = tileset.spacing || 0;
                        const x = col * (tileSize + spacing);
                        const y = row * (tileSize + spacing);

                        return (
                          <button
                            key={index}
                            className={cn(
                              'aspect-square border-2 rounded hover-elevate active-elevate-2 overflow-hidden bg-muted',
                              selectedTileIndex === index
                                ? 'border-primary ring-2 ring-primary/20'
                                : 'border-border'
                            )}
                            onClick={() => setSelectedTileIndex(index)}
                            data-testid={`button-tile-${index}`}
                          >
                            {tileset.imageUrl && (
                              <div
                                className="w-full h-full"
                                style={{
                                  backgroundImage: `url(${tileset.imageUrl})`,
                                  backgroundPosition: `-${x}px -${y}px`,
                                  backgroundRepeat: 'no-repeat',
                                  imageRendering: 'pixelated',
                                  transform: 'scale(1.5)',
                                }}
                              />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Grid Size:</span>
            <span className="font-mono">{gridSize}px</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
