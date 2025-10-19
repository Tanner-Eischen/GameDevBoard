import { ObjectStorageService } from '../server/objectStorage.js';
import { storage } from '../server/storage.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function uploadImage(localPath: string, remoteName: string): Promise<string> {
  const objectStorageService = new ObjectStorageService();
  
  // Read the file
  const fileBuffer = fs.readFileSync(localPath);
  
  // Get upload URL
  const uploadURL = await objectStorageService.getObjectEntityUploadURL();
  
  // Upload to object storage
  const response = await fetch(uploadURL, {
    method: 'PUT',
    body: fileBuffer,
    headers: {
      'Content-Type': 'image/png',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to upload ${remoteName}: ${response.statusText}`);
  }
  
  // Normalize the path
  const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
  console.log(`Uploaded ${remoteName} to ${objectPath}`);
  
  return objectPath;
}

async function main() {
  try {
    const assetsDir = path.resolve(__dirname, '../attached_assets');
    
    // Upload and create tent tileset
    console.log('Uploading tent tileset...');
    const tentImagePath = await uploadImage(
      path.join(assetsDir, 'tent_32x32.png'),
      'tent_32x32.png'
    );
    
    const tentTileset = await storage.createTileset({
      name: 'Tent',
      tileSize: 16,
      spacing: 0,
      imageUrl: tentImagePath,
      columns: 2,
      rows: 2,
      tilesetType: 'multi-tile',
      multiTileConfig: {
        tiles: [
          { x: 0, y: 0 }, // top-left
          { x: 1, y: 0 }, // top-right
          { x: 0, y: 1 }, // bottom-left
          { x: 1, y: 1 }, // bottom-right
        ]
      }
    });
    console.log('Created tent tileset:', tentTileset.id);
    
    // Upload and create campfire variant 1
    console.log('Uploading campfire variant 1...');
    const campfire1ImagePath = await uploadImage(
      path.join(assetsDir, 'campfire_17x16_variant1.png'),
      'campfire_variant1.png'
    );
    
    const campfire1Tileset = await storage.createTileset({
      name: 'Campfire 1',
      tileSize: 16,
      spacing: 1, // There's a 1px border
      imageUrl: campfire1ImagePath,
      columns: 1,
      rows: 1,
      tilesetType: 'multi-tile',
      multiTileConfig: {
        tiles: [{ x: 0, y: 0 }]
      }
    });
    console.log('Created campfire 1 tileset:', campfire1Tileset.id);
    
    // Upload and create campfire variant 2
    console.log('Uploading campfire variant 2...');
    const campfire2ImagePath = await uploadImage(
      path.join(assetsDir, 'campfire_17x16_variant2.png'),
      'campfire_variant2.png'
    );
    
    const campfire2Tileset = await storage.createTileset({
      name: 'Campfire 2',
      tileSize: 16,
      spacing: 1,
      imageUrl: campfire2ImagePath,
      columns: 1,
      rows: 1,
      tilesetType: 'multi-tile',
      multiTileConfig: {
        tiles: [{ x: 0, y: 0 }]
      }
    });
    console.log('Created campfire 2 tileset:', campfire2Tileset.id);
    
    console.log('\n✅ All new tilesets created successfully!');
    console.log(`- Tent: ${tentTileset.id}`);
    console.log(`- Campfire 1: ${campfire1Tileset.id}`);
    console.log(`- Campfire 2: ${campfire2Tileset.id}`);
    
  } catch (error) {
    console.error('Error adding new tilesets:', error);
    process.exit(1);
  }
}

main();
