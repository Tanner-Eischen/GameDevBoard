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
      fps: 8,
      loop: true,
    },
    walk: {
      frames: [8, 9, 10, 11, 12, 13, 14, 15],
      fps: 12,
      loop: true,
    },
    run: {
      frames: [16, 17, 18, 19, 20, 21, 22, 23],
      fps: 16,
      loop: true,
    },
    attack: {
      frames: [24, 25, 26, 27, 28, 29, 30, 31],
      fps: 14,
      loop: false,
    },
    hurt: {
      frames: [32, 33],
      fps: 6,
      loop: false,
    },
    die: {
      frames: [34, 35, 36, 37, 38, 39],
      fps: 8,
      loop: false,
    },
  },
  defaultAnimation: 'idle',
  tags: ['character', 'player', 'knight'],
};

// Swordsman sprite - idle animation (12 frames down direction, row 0)
export const swordsmanIdleDefinition: SpriteDefinition = {
  id: 'swordsman-idle',
  name: 'Swordsman (Idle)',
  imageUrl: '/sprites/swordsman-idle.png',
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    idle: {
      frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Row 0 (down direction)
      fps: 10,
      loop: true,
    },
  },
  defaultAnimation: 'idle',
  tags: ['character', 'swordsman', 'warrior'],
};

// Swordsman sprite - walk animation (6 frames down direction, row 0)
export const swordsmanWalkDefinition: SpriteDefinition = {
  id: 'swordsman-walk',
  name: 'Swordsman (Walk)',
  imageUrl: '/sprites/swordsman-walk.png',
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    walk: {
      frames: [0, 1, 2, 3, 4, 5], // Row 0 (down direction)
      fps: 10,
      loop: true,
    },
  },
  defaultAnimation: 'walk',
  tags: ['character', 'swordsman', 'warrior'],
};

// Swordsman sprite - attack animation (8 frames down direction, row 0)
export const swordsmanAttackDefinition: SpriteDefinition = {
  id: 'swordsman-attack',
  name: 'Swordsman (Attack)',
  imageUrl: '/sprites/swordsman-attack.png',
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    attack: {
      frames: [0, 1, 2, 3, 4, 5, 6, 7], // Row 0 (down direction)
      fps: 12,
      loop: false,
    },
  },
  defaultAnimation: 'attack',
  tags: ['character', 'swordsman', 'warrior'],
};

// Function to initialize demo sprites in the store
export const initializeDemoSprites = () => {
  return [
    knightSpriteDefinition,
    swordsmanIdleDefinition,
    swordsmanWalkDefinition,
    swordsmanAttackDefinition,
  ];
};