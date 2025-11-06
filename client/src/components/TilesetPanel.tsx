import { useCanvasStore } from '@/store/useCanvasStore';
import { useTilesets } from '@/hooks/useTilesets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Loader2, ImagePlus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { ObjectUploader } from '@/components/ObjectUploader';
import { TileExtractor } from '@/components/TileExtractor';
import { TileMetadataEditor, TileWithMetadata } from '@/components/TileMetadataEditor';
import { TileUploadModal, TileUploadConfig } from '@/components/TileUploadModal';
import { TileExtractionService, ExtractedTile } from '@/services/tileExtraction';
import { ExtractionItem } from '@/types/extractionQueue';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedAutoTilingClient } from '@/utils/enhancedAutoTiling';
import { Badge } from '@/components/ui/badge';
import { DebugTilesPanel } from './DebugTilesPanel';
import { createDebugTilesetPack } from '@/utils/debugTilesets';

// Helper function to create a tileset image from extracted tiles
// Helper function to upload canvas data as a file
const uploadCanvasAsFile = async (canvas: HTMLCanvasElement, filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob from canvas'));
        return;
      }

      try {
        // Get upload parameters
        const token = localStorage.getItem('auth_token');
        const uploadResponse = await fetch('/api/objects/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Failed to get upload parameters: ${uploadResponse.statusText}`);
        }
        
        const uploadData = await uploadResponse.json();
        
        // Upload the blob to the provided URL
        const uploadResult = await fetch(uploadData.uploadURL, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': 'image/png',
          },
        });
        
        if (!uploadResult.ok) {
          throw new Error(`Failed to upload file: ${uploadResult.statusText}`);
        }
        
        // Return the object path instead of upload URL for local storage
        console.log('Raw upload URL returned (full):', uploadData.uploadURL);
        console.log('Upload data object:', JSON.stringify(uploadData, null, 2));
        // Use objectPath if available (for local storage), otherwise use uploadURL
        resolve(uploadData.objectPath || uploadData.uploadURL);
      } catch (error) {
        reject(error);
      }
    }, 'image/png');
  });
};

// Helper function to convert base64 data URL to File object
const base64ToFile = (base64DataUrl: string, filename: string): File => {
  // Extract the base64 data and MIME type
  const arr = base64DataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
};

// Helper function to upload a base64 data URL as a file
const uploadBase64AsFile = async (base64DataUrl: string, filename: string): Promise<string> => {
  const file = base64ToFile(base64DataUrl, filename);
  try {
    // Get upload parameters
    const token = localStorage.getItem('auth_token');
    const uploadResponse = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to get upload parameters: ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();

    // Upload the file blob to the provided URL
    const putResult = await fetch(uploadData.uploadURL, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'image/png',
      },
    });

    if (!putResult.ok) {
      throw new Error(`Failed to upload file: ${putResult.statusText}`);
    }

    // Return the object path if available for local storage serving
    return uploadData.objectPath || uploadData.uploadURL;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

const createTilesetImageFromTiles = async (
  extractedTiles: ExtractedTile[],
  tilesetData: { columns: number; rows: number; tileSize: number }
): Promise<string> => {
  console.log('Creating tileset image from tiles...');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not create canvas context');

  // Calculate canvas size based on tileset layout
  const canvasWidth = tilesetData.columns * tilesetData.tileSize;
  const canvasHeight = tilesetData.rows * tilesetData.tileSize;
  
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Clear canvas with transparent background
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw each extracted tile onto the canvas
  for (let i = 0; i < extractedTiles.length; i++) {
    const tile = extractedTiles[i];
    const col = i % tilesetData.columns;
    const row = Math.floor(i / tilesetData.columns);
    
    const destX = col * tilesetData.tileSize;
    const destY = row * tilesetData.tileSize;

    // Create image from tile data
    const tileImg = new Image();
    await new Promise<void>((resolve, reject) => {
      tileImg.onload = () => resolve();
      tileImg.onerror = reject;
      tileImg.src = tile.imageData;
    });

    // Draw the tile onto the canvas
    ctx.drawImage(tileImg, destX, destY, tilesetData.tileSize, tilesetData.tileSize);
  }

  // Upload the canvas as a file and return the URL
  const filename = `tileset-${Date.now()}.png`;
  console.log('About to upload canvas as file:', filename);
  const uploadedUrl = await uploadCanvasAsFile(canvas, filename);
  console.log('Uploaded canvas URL:', uploadedUrl);
  console.log('Returning URL from createTilesetImageFromTiles:', uploadedUrl);
  return uploadedUrl;
};
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
  const [showUpload, setShowUpload] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('initial');
  const [tilesetName, setTilesetName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [extractedTiles, setExtractedTiles] = useState<ExtractedTile[]>([]);
  const [tilesWithMetadata, setTilesWithMetadata] = useState<TileWithMetadata[]>([]);
  const [showEnhancedModal, setShowEnhancedModal] = useState(false);
  const [tilesetType, setTilesetType] = useState<'regular' | 'auto-tiling'>('regular');
  const [enhancedMode, setEnhancedMode] = useState(true);
  
  // Check enhanced autotiling status
  useEffect(() => {
    const client = EnhancedAutoTilingClient.getInstance();
    setEnhancedMode(client.isEnhancedMode());
  }, []);

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
  const { toast } = useToast();
  const [libraryTab, setLibraryTab] = useState<'single' | 'auto'>('single');

  useEffect(() => {
    if (tilesets) {
      setTilesets(tilesets);
    }
  }, [tilesets, setTilesets]);

  const resetUploadState = () => {
    setUploadStep('initial');
    setTilesetName('');
    setUploadedImageUrl('');
    setUploadedImageFile(null);
    setExtractedTiles([]);
    setTilesWithMetadata([]);
    setUploading(false);
    setShowEnhancedModal(false);
    setTilesetType('regular');
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
      objectPath: data.objectPath, // Include objectPath for proper image serving
    };
  };

  const handleMultipleImageUpload = async (files: any[]) => {
    setUploading(true);
    
    try {
      // Create one auto-tiling tileset with 9 individual tiles
      // Store the 9 image URLs in the tags field as a JSON string for now
      // This allows us to keep the images separate while having one tileset
      
      // Determine tile size from the first uploaded image
      const firstImg = new Image();
      await new Promise<void>((resolve, reject) => {
        firstImg.onload = () => resolve();
        firstImg.onerror = reject;
        firstImg.src = files[0].uploadURL;
      });
      
      const tileSize = Math.max(firstImg.width, firstImg.height);
      
      // Store all 9 image URLs in the tags field
      const imageUrls = files.slice(0, 9).map(file => file.uploadURL);
      const tags = [
        'auto-tiling',
        'multi-image',
        `tile-urls:${JSON.stringify(imageUrls)}`
      ];

      const tilesetData = {
        name: tilesetName || 'Auto-Tiling Tileset',
        description: 'Auto-tiling tileset with 9 individual selectable tiles',
        tileSize: tileSize,
        spacing: 0,
        imageUrl: files[0].uploadURL, // Use first image as primary (for compatibility)
        columns: 3,
        rows: 3,
        tags: tags,
        tilesetType: 'auto-tiling',
      };
      
      console.log('Creating auto-tiling tileset with 9 separate images:', tilesetData);
      const newTileset = await apiRequest('POST', '/api/tilesets', tilesetData);
      console.log('Created tileset:', newTileset);

      // Update tileset with the actual image URL
      await apiRequest('PUT', `/api/tilesets/${newTileset.id}/image`, {
        imageURL: files[0].uploadURL,
      });

      toast({
        title: 'Success',
        description: `Created auto-tiling tileset "${tilesetName || 'Auto-Tiling Tileset'}" with 9 individual tiles`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/tilesets'] });
      setShowUpload(false);
      resetUploadState();
    } catch (error) {
      console.error('Error creating auto-tiling tileset:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create auto-tiling tileset',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImageUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    console.log('handleImageUploadComplete called with result:', result);
    console.log('Current tilesetType:', tilesetType);
    
    if (!result.successful || result.successful.length === 0) {
      console.log('Upload failed: no successful files');
      toast({
        title: 'Upload failed',
        description: 'Failed to upload tileset image(s)',
        variant: 'destructive',
      });
      return;
    }

    console.log('Successful files count:', result.successful.length);

    // Handle files based on selected tileset type
    if (tilesetType === 'auto-tiling') {
      console.log('Processing auto-tiling upload');
      
      if (result.successful.length === 9) {
        console.log('Processing 9 separate images for auto-tiling');
        // Create 3x3 auto-tiling tileset directly from 9 separate images
        await handleMultipleImageUpload(result.successful);
        return;
      } else if (result.successful.length === 1) {
        console.log('Processing single image for tile extraction in auto-tiling mode');
        // Single image for tile extraction - show the extraction modal
        const file = result.successful[0];
        console.log('First file:', file);
        const uploadURL = file.uploadURL;
        console.log('Upload URL:', uploadURL);

        if (!uploadURL) {
          console.log('Upload URL not found in file object');
          toast({
            title: 'Upload failed',
            description: 'Upload URL not found',
            variant: 'destructive',
          });
          return;
        }

        console.log('Setting modal state for tile extraction - uploadedImageUrl:', uploadURL);
        console.log('Setting modal state for tile extraction - uploadedImageFile:', file.data);
        
        // Store both URL and file for enhanced modal (tile extraction)
        setUploadedImageUrl(uploadURL);
        setUploadedImageFile(file.data as File);
        console.log('About to set showEnhancedModal to true for tile extraction');
        setShowEnhancedModal(true);
        console.log('showEnhancedModal set to true for tile extraction');
        return;
      } else {
        console.log('Invalid file count for auto-tiling:', result.successful.length);
        toast({
          title: 'Invalid file count',
          description: 'Auto-tiling requires either 1 image for extraction or exactly 9 images for direct upload',
          variant: 'destructive',
        });
        return;
      }
    }

    console.log('Processing single file upload');
    // Handle single file upload (existing logic)
    const file = result.successful[0];
    console.log('First file:', file);
    const uploadURL = file.uploadURL;
    console.log('Upload URL:', uploadURL);

    if (!uploadURL) {
      console.log('Upload URL not found in file object');
      toast({
        title: 'Upload failed',
        description: 'Upload URL not found',
        variant: 'destructive',
      });
      return;
    }

    console.log('Setting modal state - uploadedImageUrl:', uploadURL);
    console.log('Setting modal state - uploadedImageFile:', file.data);
    
    // Store both URL and file for enhanced modal
    setUploadedImageUrl(uploadURL);
    setUploadedImageFile(file.data as File);
    console.log('About to set showEnhancedModal to true');
    setShowEnhancedModal(true);
    console.log('showEnhancedModal set to true');
  };

  const handleEnhancedUploadConfirm = async (config: TileUploadConfig) => {
    setShowEnhancedModal(false);
    setUploading(true);

    try {
      // Load the image for extraction
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = uploadedImageUrl;
      });

      // Extract tiles using the new service
      const extractionService = new TileExtractionService();
      
      let createdTilesets: any[] = [];

      if (config.extractionItems && config.extractionItems.length > 0) {
        // Handle multiple extractions - create separate tileset for each extraction item
        for (const extractionItem of config.extractionItems) {
          const extractedTiles = await extractionService.extractFromExtractionItem(img, extractionItem);
          
          if (extractedTiles.length > 0) {
            const result = extractionService.convertExtractionItemsToTilesetFormat([extractionItem], extractedTiles);
            
            // Check if this is a 3x3 auto-tiling grid
            const isAutoTiling = (
              result.tilesetData.columns === 3 &&
              result.tilesetData.rows === 3 &&
              extractedTiles.length === 9
            ) || result.tilesetData.tilesetType === 'auto-tiling';
            
            let tilesetImageUrl: string;
            let tags: string[] = [];
            
            if (isAutoTiling) {
              // For 3x3 auto-tiling, upload each tile individually and store URLs in tags
              console.log('Creating auto-tiling tileset with individual tiles');
              
              const individualTileUrls: string[] = [];
              
              // Upload each extracted tile as a separate image
              for (let i = 0; i < extractedTiles.length; i++) {
                const tile = extractedTiles[i];
                console.log(`Uploading tile ${i + 1}/${extractedTiles.length}: ${tile.imageData.substring(0, 50)}...`);
                
                // Use the helper function to upload base64 data directly
                const tileUrl = await uploadBase64AsFile(tile.imageData, `${extractionItem.name || 'tile'}-${i}.png`);
                individualTileUrls.push(tileUrl);
                console.log(`Tile ${i + 1} uploaded successfully: ${tileUrl}`);
              }
              
              // Use first tile as main image URL
              tilesetImageUrl = individualTileUrls[0];
              
              // Store all tile URLs in tags
              tags = [
                'auto-tiling',
                'grid-extracted',
                `tile-urls:${JSON.stringify(individualTileUrls)}`
              ];
              
              console.log(`Uploaded ${individualTileUrls.length} individual tiles for auto-tiling tileset`);
            } else {
              // For other types, use the old method (recombine into single image)
              tilesetImageUrl = await createTilesetImageFromTiles(extractedTiles, result.tilesetData);
            }
            
            console.log('Tileset image URL for API:', tilesetImageUrl);
            
            // Create individual tileset for this extraction
            const newTileset = await apiRequest('POST', '/api/tilesets', {
              name: extractionItem.name || `${tilesetName || 'Untitled'} - ${extractionItem.type}`,
              description: `Extracted from ${extractionItem.name || 'extraction'} (${extractionItem.type})`,
              tileSize: result.tilesetData.tileSize,
              spacing: result.tilesetData.spacing,
              imageUrl: tilesetImageUrl,
              columns: result.tilesetData.columns,
              rows: result.tilesetData.rows,
              tags: tags,
              tilesetType: result.tilesetData.tilesetType,
            });

            // Update tileset with the new image URL
            await apiRequest('PUT', `/api/tilesets/${newTileset.id}/image`, {
              imageURL: tilesetImageUrl,
            });

            createdTilesets.push(newTileset);
          }
        }
      } else {
        // Handle single extraction (legacy support)
        const extractionResult = await extractionService.extractTiles(img, config);
        const result = extractionService.convertToTilesetFormat(extractionResult);
        
        // Check if this is a 3x3 auto-tiling grid
        const isAutoTiling = (
          result.tilesetData.columns === 3 &&
          result.tilesetData.rows === 3 &&
          extractionResult.tiles.length === 9
        ) || result.tilesetData.tilesetType === 'auto-tiling';
        
        let tilesetImageUrl: string;
        let tags: string[] = [];
        
        if (isAutoTiling) {
          // For 3x3 auto-tiling, upload each tile individually and store URLs in tags
          console.log('Creating auto-tiling tileset with individual tiles (legacy path)');
          
          const individualTileUrls: string[] = [];
          
          // Upload each extracted tile as a separate image
          for (let i = 0; i < extractionResult.tiles.length; i++) {
            const tile = extractionResult.tiles[i];
            console.log(`Uploading legacy tile ${i + 1}/${extractionResult.tiles.length}: ${tile.imageData.substring(0, 50)}...`);
            
            // Use the helper function to upload base64 data directly
            const tileUrl = await uploadBase64AsFile(tile.imageData, `${tilesetName || 'tile'}-${i}.png`);
            individualTileUrls.push(tileUrl);
            console.log(`Legacy tile ${i + 1} uploaded successfully: ${tileUrl}`);
          }
          
          // Use first tile as main image URL
          tilesetImageUrl = individualTileUrls[0];
          
          // Store all tile URLs in tags
          tags = [
            'auto-tiling',
            'grid-extracted',
            `tile-urls:${JSON.stringify(individualTileUrls)}`
          ];
          
          console.log(`Uploaded ${individualTileUrls.length} individual tiles for auto-tiling tileset (legacy)`);
        } else {
          // For other types, use the old method (recombine into single image)
          tilesetImageUrl = await createTilesetImageFromTiles(extractionResult.tiles, result.tilesetData);
        }
        
        // Create tileset in database
        const newTileset = await apiRequest('POST', '/api/tilesets', {
          name: tilesetName || 'Untitled Tileset',
          description: '',
          tileSize: result.tilesetData.tileSize,
          spacing: result.tilesetData.spacing,
          imageUrl: tilesetImageUrl,
          columns: result.tilesetData.columns,
          rows: result.tilesetData.rows,
          tags: tags,
          tilesetType: result.tilesetData.tilesetType,
        });

        // Update tileset with the actual image URL
        await apiRequest('PUT', `/api/tilesets/${newTileset.id}/image`, {
          imageURL: tilesetImageUrl,
        });

        createdTilesets.push(newTileset);
      }

      const totalTiles = createdTilesets.reduce((sum, tileset) => sum + (tileset.tiles?.length || 0), 0);
      
      toast({
        title: 'Success',
        description: `Created ${createdTilesets.length} tileset${createdTilesets.length > 1 ? 's' : ''} with ${totalTiles} total tiles`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/tilesets'] });
      setShowUpload(false);
      resetUploadState();
    } catch (error) {
      console.error('Error creating enhanced tileset:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create tileset',
        variant: 'destructive',
      });
      setShowEnhancedModal(true); // Show modal again for retry
    } finally {
      setUploading(false);
    }
  };

  const handleEnhancedUploadCancel = () => {
    setShowEnhancedModal(false);
    resetUploadState();
  };

  const handleTilesExtracted = (tiles: ExtractedTile[]) => {
    setExtractedTiles(tiles);
    setUploadStep('metadata-editing');
  };

  const handleMetadataComplete = async (tilesWithMeta: TileWithMetadata[]) => {
    setTilesWithMetadata(tilesWithMeta);
    setUploadStep('uploading');
    setUploading(true);

    try {
      // Create tileset in database
      const newTileset = await apiRequest('POST', '/api/tilesets', {
        name: tilesetName || 'Untitled Tileset',
        description: '',
        tileSize: tilesWithMeta[0]?.width || 16,
        spacing: 0, // Will be calculated from extraction
        imageUrl: uploadedImageUrl,
        columns: Math.max(...tilesWithMeta.map(t => Math.floor(t.x / t.width))) + 1,
        rows: Math.max(...tilesWithMeta.map(t => Math.floor(t.y / t.height))) + 1,
        tags: [],
      });

      // Update tileset with the actual image URL
      const updatedTileset = await apiRequest('PUT', `/api/tilesets/${newTileset.id}/image`, {
        imageURL: uploadedImageUrl,
      });

      // TODO: Store individual tile metadata in database
      // This would require extending the API to handle tile metadata

      toast({
        title: 'Success',
        description: `Tileset "${tilesetName}" uploaded successfully with ${tilesWithMeta.length} tiles`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/tilesets'] });
      setShowUpload(false);
      resetUploadState();
    } catch (error) {
      console.error('Error creating tileset:', error);
      toast({
        title: 'Error',
        description: 'Failed to create tileset',
        variant: 'destructive',
      });
      setUploadStep('metadata-editing');
    } finally {
      setUploading(false);
    }
  };

  const handleBackToImageSelection = () => {
    setUploadStep('image-selected');
  };

  const handleBackToTileExtraction = () => {
    setUploadStep('tile-extraction');
  };

  const handleCancelUpload = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setShowUpload(false);
    resetUploadState();
  };

  const renderUploadContent = () => {
    switch (uploadStep) {
      case 'initial':
      case 'image-selected':
        return (
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
              <div className="flex items-center justify-between">
                <Label className="text-xs">Tileset Type</Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="tileset-type-switch" className="text-xs text-gray-400">
                    {tilesetType === 'regular' ? 'Regular' : '3x3 Auto-tiling'}
                  </Label>
                  <Switch
                    id="tileset-type-switch"
                    checked={tilesetType === 'auto-tiling'}
                    onCheckedChange={(checked) => setTilesetType(checked ? 'auto-tiling' : 'regular')}
                    disabled={uploading}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {tilesetType === 'regular' ? 'Tileset Image' : 'Tile Images (9 required)'}
              </Label>
              <ObjectUploader
                maxNumberOfFiles={tilesetType === 'regular' ? 1 : 9}
                maxFileSize={10485760}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleImageUploadComplete}
                buttonClassName="w-full"
              >
                <ImagePlus className="h-3 w-3 mr-2" />
                {tilesetType === 'regular' ? 'Select Image' : 'Select 9 Images'}
              </ObjectUploader>
              <p className="text-xs text-gray-400">
                {tilesetType === 'regular' 
                  ? 'Upload a single tileset image' 
                  : 'Upload exactly 9 individual tile images for 3x3 auto-tiling grid'
                }
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelUpload}
                data-testid="button-cancel-upload"
                disabled={uploading}
                type="button"
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'tile-extraction':
        return (
          <TileExtractor
            imageUrl={uploadedImageUrl}
            onTilesExtracted={handleTilesExtracted}
            onBack={handleBackToImageSelection}
          />
        );

      case 'metadata-editing':
        return (
          <TileMetadataEditor
            tiles={extractedTiles}
            onMetadataComplete={handleMetadataComplete}
            onBack={handleBackToTileExtraction}
          />
        );

      case 'uploading':
        return (
          <div className="space-y-3 p-3 bg-muted/30 rounded-md text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm text-gray-300">Creating tileset...</p>
            <p className="text-xs text-gray-400">
              Processing {tilesWithMetadata.length} tiles
            </p>
          </div>
        );

      default:
        return null;
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
        {showUpload && renderUploadContent()}

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

                  {/* Single / Regular tilesets tab */}
                  <TabsContent value="single">
                    {(tilesets || [])
                      .filter((t: Tileset) => t.tilesetType !== 'auto-tiling')
                      .map((tileset: Tileset) => (
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

                  {/* 3x3 Auto-tiling tab */}
                  <TabsContent value="auto">
                    {(tilesets || [])
                      .filter((t: Tileset) => t.tilesetType === 'auto-tiling')
                      .map((tileset: Tileset) => (
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
                                  const tag = tileset.tags.find(t => t.startsWith('tile-urls:'));
                                  if (tag) {
                                    try {
                                      const urls = JSON.parse(tag.replace('tile-urls:', ''));
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
                                        // Sprite sheet - use background positioning
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
                                        // Individual image
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

            {/* Enhanced Autotiling Status */}
            {!enhancedMode && (
              <div className="pt-4 border-t">
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="text-xs text-yellow-800 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Using fallback autotiling mode</span>
                  </div>
                </div>
              </div>
            )}

            {/* Debug Panel - Development Only */}
            <div className="pt-4 border-t">
              <DebugTilesPanel />
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Enhanced Upload Modal - Only render when open */}
      {showEnhancedModal && (
        <TileUploadModal
          isOpen={showEnhancedModal}
          onClose={handleEnhancedUploadCancel}
          onConfirm={handleEnhancedUploadConfirm}
          imageFile={uploadedImageFile}
          imageUrl={uploadedImageUrl}
        />
      )}
    </Card>
  );
}
