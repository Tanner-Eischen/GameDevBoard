import { useCanvasStore } from '@/store/useCanvasStore';
import { useTilesets } from '@/hooks/useTilesets';
import { useTilesetPacks } from '@/hooks/useTilesetPacks';
import type { Tileset } from '@shared/schema';
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
import { TileExtractor } from '@/components/TileExtractor';
import { TileMetadataEditor, TileWithMetadata } from '@/components/TileMetadataEditor';
import { TileUploadModal, TileUploadConfig } from '@/components/TileUploadModal';
import { TileExtractionService, ExtractedTile } from '@/services/tileExtraction';
import { ExtractionItem } from '@/types/extractionQueue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DebugTilesPanel } from './DebugTilesPanel';
import { createDebugTilesetPack } from '@/utils/debugTilesets';
import type { UploadResult } from '@uppy/core';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type UploadStep = 'initial' | 'image-selected' | 'tile-extraction' | 'metadata-editing' | 'uploading' | 'enhanced-upload';

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
  const [uploadStep, setUploadStep] = useState<UploadStep>('initial');
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
  const [libraryTab, setLibraryTab] = useState<'single' | 'auto'>('single');

  // Auto-load debug tilesets on mount (only once)
  useEffect(() => {
    const currentTilesets = useCanvasStore.getState().tilesets;
    const debugTilesets = createDebugTilesetPack();
    
    // Check if debug tilesets are already loaded by checking for any debug tileset name
    const debugTilesetNames = debugTilesets.map(dt => dt.name);
    const hasDebugTilesets = currentTilesets.some(t => 
      debugTilesetNames.includes(t.name)
    );
    
    // Always add debug tilesets if they're not present (even if no other tilesets exist)
    if (!hasDebugTilesets) {
      // Add debug tilesets to the store
      const updatedTilesets = [...currentTilesets, ...debugTilesets];
      setTilesets(updatedTilesets);
    }
  }, [setTilesets]); // Only depend on setTilesets

  useEffect(() => {
    if (tilesets) {
      setTilesets(tilesets.map(t => ({ ...t, tags: t.tags || [] })));
    }
  }, [tilesets, setTilesets]);

  const resetUploadState = () => {
    setUploadStep('initial');
    setTilesetName('');
    setUploadedImageUrl(null);
    setUploading(false);
    setSelectedTiles([]);
    setTilesetType('multi-tile');
  };

  const handleGetUploadParameters = async (file: File) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get upload parameters: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
      objectPath: data.objectPath,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (!result.successful || result.successful.length === 0) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload tileset image(s)',
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
      const multiTileConfig = tilesetType === 'multi-tile' ? { tiles: selectedTiles } : null;

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

      const updateRes = await apiRequest('PUT', `/api/tilesets/${newTileset.id}/image`, {
        imageURL: uploadedImageUrl,
      });
      const updatedTileset = await updateRes.json();

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
    <Card className="h-100% overflow-y-hidden bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex overflow-y-hidden items-center justify-between">
          <CardTitle className="text-sm text-gray-100">Tilesets</CardTitle>
          <div className="flex items-center gap-2">
            {!showUpload && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowUpload(true);
                }}
                data-testid="button-upload-tileset-header"
                className="text-xs px-2 py-1 h-7 text-gray-300 hover:text-white hover:bg-gray-700 border-gray-600"
              >
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowUpload(!showUpload);
              }}
              data-testid="button-toggle-upload"
              className="h-7 w-7 text-gray-300 hover:text-white hover:bg-gray-700"
              title={showUpload ? "Hide upload form" : "Show upload form"}
            >
              <Plus className={cn("h-4 w-4 transition-transform", showUpload && "rotate-45")} />
            </Button>
          </div>
        </div>
        {showUpload && (
          <div className="mt-2 p-2 bg-blue-900/20 border border-blue-700/30 rounded-md">
            <p className="text-xs text-blue-300 mb-1">Upload New Tileset</p>
            <p className="text-xs text-gray-400">Select an image to create a new tileset</p>
          </div>
        )}
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

        {!showUpload && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !tilesets || tilesets.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  <ImagePlus className="h-12 w-12 mx-auto text-gray-500 mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    No tilesets uploaded yet
                  </p>
                  <p className="text-xs text-gray-500">
                    Upload your first tileset to get started
                  </p>
                </div>
                <Button
                  size="default"
                  variant="default"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowUpload(true);
                  }}
                  data-testid="button-upload-first-tileset"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First Tileset
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Tabs value={libraryTab} onValueChange={(v) => setLibraryTab(v as 'single' | 'auto')}>
                  <TabsList>
                    <TabsTrigger value="single">Single / Regular</TabsTrigger>
                    <TabsTrigger value="auto">3x3 Auto-tiling</TabsTrigger>
                  </TabsList>

                  <TabsContent value="single">
                    {(tilesets || [])
                      .filter((t: any) => t.tilesetType !== 'auto-tiling')
                      .map((tileset: any) => (
                        <div key={tileset.id} className="space-y-2">
                          <Button
                            variant={selectedTileset?.id === tileset.id ? 'default' : 'outline'}
                            className="w-full justify-start"
                            onClick={() => {
                              setSelectedTileset(tileset);
                              if (selectedTileset?.id !== tileset.id) {
                                setSelectedTileIndex(0);
                              }
                            }}
                            data-testid={`button-tileset-${tileset.id}`}
                          >
                            {tileset.name}
                          </Button>

                          {selectedTileset?.id === tileset.id && (
                            tileset.tilesetType === 'multi-tile' ? (
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
                                  onClick={() => {
                                    setSelectedTileset(tileset);
                                    setSelectedTileIndex(0);
                                  }}
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
                              <div className="grid grid-cols-3 gap-1 p-2 bg-muted/30 rounded-md">
                                {Array.from({ length: tileset.rows * tileset.columns }).map((_, index) => {
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
                                      onClick={() => {
                                        setSelectedTileset(tileset);
                                        setSelectedTileIndex(index);
                                      }}
                                      data-testid={`button-tile-${index}`}
                                    >
                                      {tileset.imageUrl && (
                                        <div
                                          className="w-full h-full"
                                          style={{
                                            backgroundImage: `url(${tileset.imageUrl})`,
                                            backgroundPosition: `-${x}px -${y}px`,
                                            backgroundSize: 'auto',
                                            backgroundRepeat: 'no-repeat',
                                            imageRendering: 'pixelated',
                                          }}
                                        />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      ))}
                  </TabsContent>

                  <TabsContent value="auto">
                    {(tilesets || [])
                      .filter((t: any) => t.tilesetType === 'auto-tiling')
                      .map((tileset: any) => (
                        <div key={tileset.id} className="space-y-2">
                          <Button
                            variant={selectedTileset?.id === tileset.id ? 'default' : 'outline'}
                            className="w-full justify-start"
                            onClick={() => {
                              setSelectedTileset(tileset);
                              if (selectedTileset?.id !== tileset.id) {
                                setSelectedTileIndex(0);
                              }
                            }}
                            data-testid={`button-tileset-${tileset.id}`}
                          >
                            {tileset.name}
                          </Button>

                          {selectedTileset?.id === tileset.id && (
                            <div className="grid grid-cols-3 gap-1 p-2 bg-muted/30 rounded-md">
                              {Array.from({ length: tileset.rows * tileset.columns }).map((_, index) => {
                                const col = index % tileset.columns;
                                const row = Math.floor(index / tileset.columns);
                                const tileSize = tileset.tileSize;
                                const spacing = tileset.spacing || 0;
                                const x = col * (tileSize + spacing);
                                const y = row * (tileSize + spacing);

                                let individualImageUrl = tileset.imageUrl;
                                let useBackgroundPosition = true;
                                if (tileset.tags) {
                                  const tag = tileset.tags.find((t: string) => t.startsWith('tile-urls:'));
                                  if (tag) {
                                    try {
                                      const urls = JSON.parse(tag.replace('tile-urls:', '')) as string[];
                                      if (Array.isArray(urls) && urls[index]) {
                                        individualImageUrl = urls[index];
                                        useBackgroundPosition = false;
                                      }
                                    } catch (e) {
                                      console.warn('Failed to parse tile URLs from tags:', e);
                                    }
                                  }
                                }

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
                                    onClick={() => {
                                      setSelectedTileset(tileset);
                                      setSelectedTileIndex(index);
                                    }}
                                    data-testid={`button-tile-${index}`}
                                  >
                                    {individualImageUrl ? (
                                      useBackgroundPosition ? (
                                        <div
                                          className="w-full h-full"
                                          style={{
                                            backgroundImage: `url(${individualImageUrl})`,
                                            backgroundPosition: `-${x}px -${y}px`,
                                            backgroundSize: 'auto',
                                            backgroundRepeat: 'no-repeat',
                                            imageRendering: 'pixelated',
                                          }}
                                          onError={(e) => {
                                            console.error(`Failed to load tileset image: ${individualImageUrl}`);
                                          }}
                                        />
                                      ) : (
                                        <img
                                          src={individualImageUrl}
                                          alt={`Tile ${index}`}
                                          className="w-full h-full object-contain"
                                          style={{
                                            imageRendering: 'pixelated',
                                          }}
                                          onError={(e) => {
                                            console.error(`Failed to load tile image: ${individualImageUrl}`, {
                                              url: individualImageUrl,
                                              index,
                                              tileset: tileset.name
                                            });
                                          }}
                                        />
                                      )
                                    ) : (
                                      <div className="w-full h-full bg-gray-800 flex items-center justify-center text-[8px] text-gray-500">
                                        ?
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </>
        )}

        {!showUpload && (
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

            <div className="pt-4 border-t">
              <DebugTilesPanel />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}