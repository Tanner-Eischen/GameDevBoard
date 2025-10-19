import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Shape types for canvas
export const shapeTypeEnum = z.enum(['rectangle', 'circle', 'polygon', 'star', 'line', 'text']);
export type ShapeType = z.infer<typeof shapeTypeEnum>;

export const toolTypeEnum = z.enum(['select', 'rectangle', 'circle', 'polygon', 'star', 'line', 'text', 'pan', 'tile-paint', 'tile-erase', 'sprite']);
export type ToolType = z.infer<typeof toolTypeEnum>;

// Sprite animation state enum
export const animationStateEnum = z.enum(['idle', 'walk', 'run', 'attack', 'hurt', 'die', 'custom']);
export type AnimationState = z.infer<typeof animationStateEnum>;

// Transform interface
export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// Shape style interface
export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

// Shape interface
export interface Shape {
  id: string;
  type: ShapeType;
  transform: Transform;
  style: ShapeStyle;
  text?: string;
  metadata: {
    createdBy: string;
    createdAt: number;
    locked: boolean;
    layer: number;
    groupId?: string;
  };
  points?: number[]; // For polygon, star, line
}

// Tile layer enum
export const tileLayerEnum = z.enum(['terrain', 'props']);
export type TileLayer = z.infer<typeof tileLayerEnum>;

// Tile interface
export interface Tile {
  x: number;
  y: number;
  tilesetId: string;
  tileIndex: number;
  layer: TileLayer; // 'terrain' for grass/dirt/water, 'props' for trees/flowers
}

// Sprite instance on canvas
export interface SpriteInstance {
  id: string;
  spriteId: string; // Reference to sprite definition
  x: number;
  y: number;
  scale: number;
  rotation: number;
  currentAnimation: AnimationState;
  flipX: boolean;
  flipY: boolean;
  layer: number;
  metadata: {
    createdBy: string;
    createdAt: number;
    locked: boolean;
  };
}

// Sprite definition (shared across projects)
export interface SpriteDefinition {
  id: string;
  name: string;
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  animations: {
    [key in AnimationState]?: {
      frames: number[]; // Frame indices
      fps: number;
      loop: boolean;
    };
  };
  defaultAnimation: AnimationState;
  tags: string[]; // e.g., ['character', 'enemy', 'npc']
}

// TileMap interface
export interface TileMap {
  gridSize: number;
  tiles: Tile[];
  spriteDefinitions: SpriteDefinition[];
}

// User presence interface
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string[];
  tool: ToolType;
}

// Tileset type enum
export const tilesetTypeEnum = z.enum(['auto-tiling', 'multi-tile', 'variant_grid']);
export type TilesetType = z.infer<typeof tilesetTypeEnum>;

// Multi-tile configuration for objects like trees
export interface MultiTileConfig {
  tiles: Array<{ x: number; y: number }>; // Grid positions of tiles that make up the object
}

// Tileset interface
export interface Tileset {
  id: string;
  name: string;
  tileSize: number;
  spacing: number; // Spacing between tiles in pixels
  imageUrl: string;
  columns: number;
  rows: number;
  tilesetType: TilesetType; // 'auto-tiling' for 3x3 grids with neighbor-based tiling, 'multi-tile' for objects like trees, 'variant_grid' for manual tile variant selection
  multiTileConfig: MultiTileConfig | null; // Only used for multi-tile objects
}

// Canvas state interface
export interface CanvasState {
  shapes: Shape[];
  sprites: SpriteInstance[];
  selectedIds: string[];
  tool: ToolType;
  zoom: number;
  pan: { x: number; y: number };
  gridSize: number;
  gridVisible: boolean;
  snapToGrid: boolean;
}

// Project schema
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  canvasState: jsonb("canvas_state").notNull().$type<CanvasState>(),
  tileMap: jsonb("tile_map").notNull().$type<TileMap>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Tileset Pack schema
export const tilesetPacks = pgTable("tileset_packs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTilesetPackSchema = createInsertSchema(tilesetPacks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTilesetPack = z.infer<typeof insertTilesetPackSchema>;
export type TilesetPack = typeof tilesetPacks.$inferSelect;

// Tileset schema
export const tilesets = pgTable("tilesets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tileSize: integer("tile_size").notNull().default(32),
  spacing: integer("spacing").notNull().default(0),
  imageUrl: text("image_url").notNull(),
  columns: integer("columns").notNull(),
  rows: integer("rows").notNull(),
  tilesetType: text("tileset_type").notNull().default('auto-tiling').$type<TilesetType>(),
  multiTileConfig: jsonb("multi_tile_config").$type<MultiTileConfig | null>(),
  packId: varchar("pack_id"), // Optional reference to tileset pack
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTilesetSchema = createInsertSchema(tilesets).omit({
  id: true,
  createdAt: true,
});

export type InsertTileset = z.infer<typeof insertTilesetSchema>;
export type TilesetData = typeof tilesets.$inferSelect;

// Session storage table for Replit Auth
// Reference: blueprint:javascript_log_in_with_replit
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
// Reference: blueprint:javascript_log_in_with_replit
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
