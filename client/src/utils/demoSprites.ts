import type { SpriteDefinition } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

// Demo knight sprite definition based on the provided sprite sheet
export const knightSpriteDefinition: SpriteDefinition = {
  id: 'knight-demo',
  name: 'Knight',
  imageUrl: '/sprites/knight-sprite-sheet.png',
  frameWidth: 32,
  frameHeight: 32,
  animations: {
    idle: {
      frames: [0, 1, 2, 3],
      frameRate: 8,
      loop: true,
    },
    walk: {
      frames: [8, 9, 10, 11, 12, 13, 14, 15],
      frameRate: 12,
      loop: true,
    },
    run: {
      frames: [16, 17, 18, 19, 20, 21, 22, 23],
      frameRate: 16,
      loop: true,
    },
    attack: {
      frames: [24, 25, 26, 27, 28, 29, 30, 31],
      frameRate: 14,
      loop: false,
    },
    hurt: {
      frames: [32, 33],
      frameRate: 6,
      loop: false,
    },
    die: {
      frames: [34, 35, 36, 37, 38, 39],
      frameRate: 8,
      loop: false,
    },
  },
};

// Function to initialize demo sprites in the store
export const initializeDemoSprites = () => {
  return [knightSpriteDefinition];
};