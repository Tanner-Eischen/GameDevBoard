import { useCanvasStore } from '@/store/useCanvasStore';
import { useTilesets } from '@/hooks/useTilesets';
import { useTilesetPacks } from '@/hooks/useTilesetPacks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Upload, Plus, Loader2, ImagePlus, ChevronDown, ChevronUp } from 'lucide-react';
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
    brushSize,
    setSelectedTileset,
    setSelectedTileIndex,
    setTilesets,
    setBrushSize,
    gridSize,
  } = useCanvasStore();

  const { data: tilesets, isLoading } = useTilesets();
  const { data: packs } = useTilesetPacks();
  const [showUpload, setShowUpload] = useState(false);
  const [tilesetName, setTilesetName] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [tilesetType, setTilesetType] = useState<'auto-tiling' | 'multi-tile' | 'variant_grid'>('multi-tile');
  const [tileSize, setTileSize] = useState(16);
  const [spacing, setSpacing] = useState(1);
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(3);
  const [selectedTiles, setSelectedTiles] = useState<Array<{ x: number; y: number }>>([]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
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

    try {
      const file = result.successful[0];
      const uploadURL = file.uploadURL;

      if (!uploadURL) {
        throw new Error('Upload URL not found');
      }

      // Store the uploaded URL and show configuration UI
      setUploadedImageUrl(uploadURL);

      toast({
        title: 'Image uploaded',
        description: 'Now configure your tileset below',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTileset = async () => {
    if (!uploadedImageUrl) {
      toast({
        title: 'Error',
        description: 'Please upload an image first',
        variant: 'destructive',
      });
      return;
    }

    if (tilesetType === 'multi-tile' && selectedTiles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one tile for the multi-tile object',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Prepare multi-tile config if needed
      const multiTileConfig = tilesetType === 'multi-tile' ? { tiles: selectedTiles } : null;

      // Create tileset in database with placeholder URL first
      const createRes = await apiRequest('POST', '/api/tilesets', {
        name: tilesetName || 'Untitled Tileset',
        tileSize,
        spacing,
        imageUrl: 'pending',
        columns,
        rows,
        packId: selectedPackId || null,
        tilesetType,
        multiTileConfig,
      });
      const newTileset = await createRes.json();

      // Update tileset with normalized object path
      const updateRes = await apiRequest('PUT', `/api/tilesets/${newTileset.id}/image`, {
        imageURL: uploadedImageUrl,
      });
      const updatedTileset = await updateRes.json();

      // Load image to verify
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
        description: 'Tileset created successfully',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/tilesets'] });
      
      // Reset form
      setShowUpload(false);
      setTilesetName('');
      setSelectedPackId('');
      setUploadedImageUrl(null);
      setSelectedTiles([]);
      setTilesetType('multi-tile');
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                Tilesets
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUpload(!showUpload);
                }}
                data-testid="button-add-tileset"
                className="h-7 w-7"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
        {showUpload && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-md">
            <div className="space-y-1.5">
              <Label htmlFor="tileset-name" className="text-xs">
                Tileset Name
              </Label>
              <Input
                id="tileset-name"
                placeholder="My Waterfall"
                value={tilesetName}
                onChange={(e) => setTilesetName(e.target.value)}
                data-testid="input-tileset-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type-select" className="text-xs">
                Tileset Type
              </Label>
              <Select value={tilesetType} onValueChange={(val: any) => setTilesetType(val)}>
                <SelectTrigger id="type-select" data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multi-tile">Multi-Tile Object (trees, waterfalls, bridges)</SelectItem>
                  <SelectItem value="auto-tiling">Auto-Tiling Terrain (grass, dirt, water)</SelectItem>
                  <SelectItem value="variant_grid">Variant Grid (manual selection)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pack-select" className="text-xs">
                Tileset Pack (optional)
              </Label>
              <Select value={selectedPackId || 'none'} onValueChange={(val) => setSelectedPackId(val === 'none' ? '' : val)}>
                <SelectTrigger id="pack-select" data-testid="select-pack">
                  <SelectValue placeholder="No pack" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No pack</SelectItem>
                  {packs?.map((pack) => (
                    <SelectItem key={pack.id} value={pack.id}>
                      {pack.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!uploadedImageUrl && (
              <div className="space-y-1.5">
                <Label className="text-xs">1. Upload Image</Label>
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
            )}

            {uploadedImageUrl && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">2. Configure Dimensions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="tile-size" className="text-xs text-muted-foreground">
                        Tile Size (px)
                      </Label>
                      <Input
                        id="tile-size"
                        type="number"
                        value={tileSize}
                        onChange={(e) => setTileSize(parseInt(e.target.value) || 16)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="spacing" className="text-xs text-muted-foreground">
                        Spacing (px)
                      </Label>
                      <Input
                        id="spacing"
                        type="number"
                        value={spacing}
                        onChange={(e) => setSpacing(parseInt(e.target.value) || 0)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="columns" className="text-xs text-muted-foreground">
                        Columns
                      </Label>
                      <Input
                        id="columns"
                        type="number"
                        value={columns}
                        onChange={(e) => setColumns(parseInt(e.target.value) || 1)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rows" className="text-xs text-muted-foreground">
                        Rows
                      </Label>
                      <Input
                        id="rows"
                        type="number"
                        value={rows}
                        onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                {tilesetType === 'multi-tile' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">3. Select Tiles (click tiles to select)</Label>
                    <p className="text-xs text-muted-foreground">Selected: {selectedTiles.length} tile{selectedTiles.length !== 1 ? 's' : ''}</p>
                    <div 
                      className="grid gap-0.5 border rounded-md p-2 bg-background"
                      style={{ 
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        maxHeight: '200px',
                        overflow: 'auto'
                      }}
                    >
                      {Array.from({ length: rows * columns }).map((_, index) => {
                        const x = index % columns;
                        const y = Math.floor(index / columns);
                        const isSelected = selectedTiles.some(t => t.x === x && t.y === y);
                        return (
                          <button
                            key={`${x}-${y}`}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTiles(selectedTiles.filter(t => !(t.x === x && t.y === y)));
                              } else {
                                setSelectedTiles([...selectedTiles, { x, y }]);
                              }
                            }}
                            className={cn(
                              "aspect-square border rounded flex items-center justify-center text-xs transition-colors",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted hover-elevate"
                            )}
                            data-testid={`tile-${x}-${y}`}
                          >
                            {x},{y}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateTileset}
                    disabled={uploading || (tilesetType === 'multi-tile' && selectedTiles.length === 0)}
                    className="flex-1"
                    data-testid="button-create-tileset"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Tileset'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadedImageUrl(null);
                      setSelectedTiles([]);
                    }}
                    data-testid="button-reset-upload"
                  >
                    Reset
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
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
                  tileset.tilesetType === 'multi-tile' ? (
                    // Display multi-tile objects as a single complete unit
                    <div className="p-2 bg-muted/30 rounded-md flex justify-center">
                      <button
                        className={cn(
                          'border-2 rounded hover-elevate active-elevate-2 overflow-hidden bg-muted',
                          selectedTileIndex === 0
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-border'
                        )}
                        style={{
                          width: `${tileset.columns * tileset.tileSize}px`,
                          height: `${tileset.rows * tileset.tileSize}px`,
                        }}
                        onClick={() => setSelectedTileIndex(0)}
                        data-testid="button-multi-tile-object"
                      >
                        {tileset.imageUrl && (
                          <div
                            className="w-full h-full"
                            style={{
                              backgroundImage: `url(${tileset.imageUrl})`,
                              backgroundSize: 'contain',
                              backgroundRepeat: 'no-repeat',
                              imageRendering: 'pixelated',
                            }}
                          />
                        )}
                      </button>
                    </div>
                  ) : (
                    // Display auto-tiling tilesets as a 3x3 grid
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
                                'border-2 rounded hover-elevate active-elevate-2 overflow-hidden bg-muted',
                                selectedTileIndex === index
                                  ? 'border-primary ring-2 ring-primary/20'
                                  : 'border-border'
                              )}
                              style={{
                                width: `${tileSize}px`,
                                height: `${tileSize}px`,
                              }}
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
                                  }}
                                />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 space-y-3 border-t border-border">
          <div className="pt-3 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Grid Size:</span>
              <span className="font-mono">{gridSize}px</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Brush Size</Label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { width: 1, height: 1, label: '1×1' },
                { width: 2, height: 2, label: '2×2' },
                { width: 3, height: 3, label: '3×3' },
                { width: 2, height: 1, label: '2×1' },
                { width: 1, height: 2, label: '1×2' },
                { width: 2, height: 3, label: '2×3' },
              ].map((size) => (
                <Button
                  key={`${size.width}x${size.height}`}
                  size="sm"
                  variant={
                    brushSize.width === size.width && brushSize.height === size.height
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() => setBrushSize({ width: size.width, height: size.height })}
                  data-testid={`button-brush-${size.width}x${size.height}`}
                  className="text-xs h-7"
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
