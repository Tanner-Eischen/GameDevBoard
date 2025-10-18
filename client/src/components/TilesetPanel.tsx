import { useCanvasStore } from '@/store/useCanvasStore';
import { useTilesets } from '@/hooks/useTilesets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

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

  useEffect(() => {
    if (tilesets) {
      setTilesets(tilesets);
    }
  }, [tilesets, setTilesets]);

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
            <Label htmlFor="tileset-name" className="text-xs">
              Tileset Name
            </Label>
            <Input
              id="tileset-name"
              placeholder="My Tileset"
              className="h-8"
              data-testid="input-tileset-name"
            />
            <Label htmlFor="tileset-file" className="text-xs">
              Image File
            </Label>
            <Input
              id="tileset-file"
              type="file"
              accept="image/*"
              className="h-8"
              data-testid="input-tileset-file"
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" data-testid="button-upload-tileset">
                <Upload className="h-3 w-3 mr-2" />
                Upload
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowUpload(false)}
                data-testid="button-cancel-upload"
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
                  <div className="grid grid-cols-4 gap-1 p-2 bg-muted/30 rounded-md">
                    {Array.from({ length: tileset.rows * tileset.columns }).map(
                      (_, index) => (
                        <button
                          key={index}
                          className={cn(
                            'aspect-square border-2 rounded hover-elevate active-elevate-2',
                            selectedTileIndex === index
                              ? 'border-primary'
                              : 'border-transparent'
                          )}
                          onClick={() => setSelectedTileIndex(index)}
                          data-testid={`button-tile-${index}`}
                          style={{
                            backgroundColor: '#6366f1',
                            opacity: selectedTileIndex === index ? 1 : 0.5,
                          }}
                        />
                      )
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
