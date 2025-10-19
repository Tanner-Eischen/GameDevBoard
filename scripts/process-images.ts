import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processTent() {
  // Tent is 33x33 with 4 cells (2x2 grid) and 1px spacing
  // Each cell is 16x16, so merged tent should be 32x32
  const inputPath = path.resolve(__dirname, '../attached_assets/tent_33x33_1760877541279.png');
  const outputPath = path.resolve(__dirname, '../attached_assets/tent_32x32.png');
  
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  console.log('Tent metadata:', metadata);
  
  // Extract the 4 cells and merge them without spacing
  // Top-left: 0,0 to 16,16
  // Top-right: 17,0 to 33,16 (skip 1px spacing at x=16)
  // Bottom-left: 0,17 to 16,33 (skip 1px spacing at y=16)
  // Bottom-right: 17,17 to 33,33
  
  const cellSize = 16;
  const spacing = 1;
  
  // Extract each cell
  const topLeft = await sharp(inputPath)
    .extract({ left: 0, top: 0, width: cellSize, height: cellSize })
    .toBuffer();
  
  const topRight = await sharp(inputPath)
    .extract({ left: cellSize + spacing, top: 0, width: cellSize, height: cellSize })
    .toBuffer();
  
  const bottomLeft = await sharp(inputPath)
    .extract({ left: 0, top: cellSize + spacing, width: cellSize, height: cellSize })
    .toBuffer();
  
  const bottomRight = await sharp(inputPath)
    .extract({ left: cellSize + spacing, top: cellSize + spacing, width: cellSize, height: cellSize })
    .toBuffer();
  
  // Composite them into a 32x32 image
  await sharp({
    create: {
      width: cellSize * 2,
      height: cellSize * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite([
    { input: topLeft, top: 0, left: 0 },
    { input: topRight, top: 0, left: cellSize },
    { input: bottomLeft, top: cellSize, left: 0 },
    { input: bottomRight, top: cellSize, left: cellSize }
  ])
  .png()
  .toFile(outputPath);
  
  console.log('Tent processed:', outputPath);
  return outputPath;
}

async function processCampfire() {
  // Campfire is 34x16, split into two 17x16 variants
  const inputPath = path.resolve(__dirname, '../attached_assets/campfire_34x16_1760877541279.png');
  const output1Path = path.resolve(__dirname, '../attached_assets/campfire_17x16_variant1.png');
  const output2Path = path.resolve(__dirname, '../attached_assets/campfire_17x16_variant2.png');
  
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  console.log('Campfire metadata:', metadata);
  
  // Split into two halves
  await sharp(inputPath)
    .extract({ left: 0, top: 0, width: 17, height: 16 })
    .toFile(output1Path);
  
  await sharp(inputPath)
    .extract({ left: 17, top: 0, width: 17, height: 16 })
    .toFile(output2Path);
  
  console.log('Campfire variants processed:', output1Path, output2Path);
  return [output1Path, output2Path];
}

async function main() {
  try {
    await processTent();
    await processCampfire();
    console.log('All images processed successfully!');
  } catch (error) {
    console.error('Error processing images:', error);
    process.exit(1);
  }
}

main();
