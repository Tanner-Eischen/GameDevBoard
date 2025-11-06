import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, boolean, timestamp, real, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Shape types for canvas
export const shapeTypeEnum = z.enum(['rectangle', 'circle', 'polygon', 'star', 'line']);
export type ShapeType = z.infer<typeof shapeTypeEnum>;

export const toolTypeEnum = z.enum(['select', 'rectangle', 'circle', 'polygon', 'star', 'line', 'pan', 'tile-paint', 'auto-tile-paint', 'tile-erase', 'sprite']);
export type ToolType = z.infer<typeof toolTypeEnum>;

// Sprite animation state enum
export const animationStateEnum = z.enum(['idle', 'walk', 'run', 'attack', 'hurt', 'die', 'jump', 'fall', 'custom']);
export type AnimationState = z.infer<typeof animationStateEnum>;

// Easing function types for animations
export const easingTypeEnum = z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bounce', 'elastic']);
export type EasingType = z.infer<typeof easingTypeEnum>;

// Animation frame interface with advanced properties
export interface AnimationFrame {
  index: number;
  duration: number; // Frame duration in milliseconds
  x: number; // Source X position in spritesheet
  y: number; // Source Y position in spritesheet
  width: number; // Frame width
  height: number; // Frame height
  offsetX?: number; // Render offset X
  offsetY?: number; // Render offset Y
  metadata?: Record<string, any>; // Custom frame data
}

// Advanced animation definition
export interface AdvancedAnimation {
  id: string;
  name: string;
  frames: AnimationFrame[];
  fps: number;
  loop: boolean;
  easing: EasingType;
  totalDuration: number; // Calculated total duration
  metadata: {
    tags: string[];
    description?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

// Animation state transition
export interface AnimationTransition {
  id: string;
  fromState: AnimationState;
  toState: AnimationState;
  trigger: string; // Event trigger name
  conditions?: Record<string, any>; // Conditional logic
  duration: number; // Transition duration in ms
  easing: EasingType;
}

// State machine definition
export interface StateMachine {
  id: string;
  name: string;
  states: AnimationState[];
  transitions: AnimationTransition[];
  defaultState: AnimationState;
  currentState: AnimationState;
  variables: Record<string, any>; // State machine variables
}

// Timeline keyframe
export interface TimelineKeyframe {
  id: string;
  time: number; // Time in milliseconds
  frameIndex: number;
  properties: {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    opacity?: number;
  };
  easing: EasingType;
}

// Timeline track for organizing keyframes
export interface TimelineTrack {
  id: string;
  name: string;
  type: 'position' | 'scale' | 'rotation' | 'opacity' | 'frame';
  keyframes: TimelineKeyframe[];
  visible: boolean;
  locked: boolean;
}

// Timeline definition
export interface Timeline {
  id: string;
  name: string;
  duration: number; // Total timeline duration in ms
  fps: number;
  tracks: TimelineTrack[];
  playhead: number; // Current playhead position
  isPlaying: boolean;
  loop: boolean;
}

// Spritesheet parsing data
export interface SpritesheetData {
  id: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  totalFrames: number;
  padding: number; // Padding between frames
  margin: number; // Margin around spritesheet
  frames: AnimationFrame[]; // Parsed frame data
}

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
}

// Shape interface
export interface Shape {
  id: string;
  type: ShapeType;
  transform: Transform;
  style: ShapeStyle;
  metadata: {
    createdBy: string;
    createdAt: number;
    locked: boolean;
    layer: number;
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

// Enhanced sprite definition with advanced features
export interface SpriteDefinition {
  id: string;
  name: string;
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  // Legacy simple animations (for backward compatibility)
  animations: {
    [key in AnimationState]?: {
      frames: number[]; // Frame indices
      fps: number;
      loop: boolean;
    };
  };
  // Advanced animations with timeline support
  advancedAnimations: AdvancedAnimation[];
  // State machine for animation transitions
  stateMachine?: StateMachine;
  // Timeline definitions
  timelines: Timeline[];
  // Spritesheet parsing data
  spritesheetData?: SpritesheetData;
  defaultAnimation: AnimationState;
  tags: string[]; // e.g., ['character', 'enemy', 'npc']
  category: string; // Sprite category for organization
  metadata: {
    author?: string;
    version: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

// TileMap interface
export interface TileMap {
  gridSize: number;
  tiles: Tile[];
  spriteDefinitions: SpriteDefinition[];
}

// Godot Integration Types
export interface GodotProject {
  id: string;
  name: string;
  projectPath: string; // Path to Godot HTML5 export
  executable?: string; // Godot executable file (e.g., 'godot.wasm')
  version?: string; // Godot version
  enabled: boolean; // Whether this project is enabled
  createdAt: Date;
  updatedAt: Date;
}

export interface GodotLayer {
  id: string;
  name: string;
  projectId: string; // Reference to GodotProject
  layerIndex: number; // TileMapLayer index in Godot
  visible: boolean;
  zIndex: number; // Z-index for rendering order
  metadata?: Record<string, any>;
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

// Board type enum
export const boardTypeEnum = z.enum(['topdown', 'platformer']);
export type BoardType = z.infer<typeof boardTypeEnum>;

// Physics vector interface
export interface Vector2 {
  x: number;
  y: number;
}

// Physics configuration interface
export interface PhysicsConfig {
  gravity: Vector2; // { x: 0, y: 980 } for platformer, { x: 0, y: 0 } for top-down
  airResistance: number; // 0-1 coefficient
  terminalVelocity: number; // Maximum falling velocity
  physicsScale: number; // Physics world scale factor
  enabled?: boolean; // Whether physics is enabled
}

// Material configuration interface
export interface MaterialConfig {
  id: string;
  name: string; // Material name for display
  materialId: string;
  friction: number; // 0-2 coefficient
  restitution: number; // 0-1 bounce factor
  density: number; // Mass density
  collisionType: 'solid' | 'platform' | 'trigger' | 'hazard';
}

// Enhanced physics entity interface for AI functions
export interface PhysicsEntity {
  id: string;
  boardId: string;
  spriteId: string;
  position: Vector2;
  size: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  mass: number;
  drag: number; // Air drag coefficient
  restitution: number; // Bounce factor
  friction: number; // Surface friction
  isStatic: boolean; // Static objects don't move
  materialType?: string; // Material identifier for physics properties
  materialId?: string; // Material ID reference
  collisionType: 'solid' | 'platform' | 'trigger' | 'hazard';
  // Physics state properties
  isDynamic: boolean; // Whether the entity can move
  useGravity: boolean; // Whether gravity affects this entity
  isGrounded: boolean; // Whether the entity is on the ground
  isColliding: boolean; // Whether the entity is currently colliding
  // Bounding box for collision detection
  aabb: AABB; // Axis-aligned bounding box
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced material type definitions for AI functions
export type MaterialType = 'solid' | 'platform' | 'bouncy' | 'slippery' | 'hazard';
export type CollisionType = 'solid' | 'platform' | 'trigger' | 'hazard';

// Enhanced sprite instance interface with physics integration
export interface EnhancedSpriteInstance extends SpriteInstance {
  physicsEnabled?: boolean;
  physicsProperties?: {
    mass: number;
    friction: number;
    restitution: number;
    isStatic: boolean;
    materialType: MaterialType;
    collisionType: CollisionType;
  };
}

// Platformer level generation parameters
export interface PlatformerLevelParams {
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  theme: 'forest' | 'cave' | 'castle' | 'sky';
  size: 'small' | 'medium' | 'large' | 'massive';
  features: Array<'moving-platforms' | 'hazards' | 'secrets' | 'checkpoints'>;
}

// AABB (Axis-Aligned Bounding Box) interface
export interface AABB {
  min: Vector2;
  max: Vector2;
}

// Collision interface
export interface Collision {
  entityA: string;
  entityB: string | null; // null for tile collisions
  contactPoint: Vector2;
  normal: Vector2;
  penetration: number;
  materialType?: string;
}

// Physics performance metrics interface
export interface PhysicsMetrics {
  fps: number; // Current frames per second
  entityCount: number; // Active physics entities count
  collisionChecks: number; // Number of collision checks per frame
  activeCollisions: number; // Number of active collisions
  updateTime: number; // Average physics update time (ms)
  memoryUsage: number; // Physics system memory usage (bytes)
}

// Tileset type enum
export const tilesetTypeEnum = z.enum(['auto-tiling', 'multi-tile', 'single-tile', 'variant_grid']);
export type TilesetType = z.infer<typeof tilesetTypeEnum>;

// Multi-tile configuration for objects like trees
export interface MultiTileConfig {
  tiles: Array<{ x: number; y: number }>; // Grid positions of tiles that make up the object
}

// Art style configuration
export interface LayeredArtStyle {
  name: 'Pixel Perfect' | 'Hand Painted' | 'Studio Ghibli';
  description: string;
  renderMultiplier: number;
  colorDepth: number;
  edgeStyle: 'pixel' | 'painterly' | 'smooth';
  shadingType: 'flat' | 'realistic' | 'cell';
  textureIntensity: number;
  organicFactor: number;
}

// Terrain generation metadata
export interface TerrainGenerationMetadata {
  algorithm: 'enhanced-javascript' | 'godot' | 'legacy';
  version: string;
  artStyle?: LayeredArtStyle;
  generatedAt: number;
  generationTime: number; // milliseconds
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
  tags?: string[]; // Tags for categorization and metadata storage
  // Optional config for variant grid tilesets (manual variant selection grids)
  variantGridConfig?: { width: number; height: number } | null;
  // New fields for enhanced autotiling
  terrainMetadata?: TerrainGenerationMetadata;
  isGenerated?: boolean;
  sourceTemplate?: string;
}

// Board interface - represents a single board within a project
export interface Board {
  id: string;
  projectId: string;
  name: string;
  type: BoardType;
  tilesets: string[]; // Tileset IDs for this board
  physics: PhysicsConfig;
  canvasState: CanvasState;
  tileMap: TileMap;
  createdAt: number;
  updatedAt: number;
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

// Database schemas
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  isEmailVerified: boolean("is_email_verified").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  usernameIdx: index("users_username_idx").on(table.username),
  emailIdx: index("users_email_idx").on(table.email),
  createdAtIdx: index("users_created_at_idx").on(table.createdAt),
}));

// Sessions table for authentication
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
  tokenIdx: index("sessions_token_idx").on(table.token),
  expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
}));

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
  nameIdx: index("projects_name_idx").on(table.name),
  createdAtIdx: index("projects_created_at_idx").on(table.createdAt),
}));

// Boards table - separate table for better scalability
export const boards = pgTable("boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  type: text("type").notNull().$type<BoardType>().default('topdown'),
  tilesets: jsonb("tilesets").$type<string[]>().default([]),
  physics: jsonb("physics").$type<PhysicsConfig>().default({
    gravity: { x: 0, y: 0 },
    airResistance: 0.01,
    terminalVelocity: 1000,
    physicsScale: 1.0,
    enabled: true
  }),
  canvasState: jsonb("canvas_state").$type<CanvasState>().default({
    shapes: [],
    sprites: [],
    selectedIds: [],
    tool: 'select',
    zoom: 1,
    pan: { x: 0, y: 0 },
    gridSize: 32,
    gridVisible: true,
    snapToGrid: false
  }),
  tileMap: jsonb("tile_map").$type<TileMap>().default({
    gridSize: 32,
    tiles: [],
    spriteDefinitions: []
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdIdx: index("boards_project_id_idx").on(table.projectId),
  nameIdx: index("boards_name_idx").on(table.name),
  typeIdx: index("boards_type_idx").on(table.type),
  createdAtIdx: index("boards_created_at_idx").on(table.createdAt),
}));

// Tilesets table
export const tilesets = pgTable("tilesets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }), // Allow shared tilesets
  name: text("name").notNull(),
  tileSize: integer("tile_size").notNull().default(32),
  spacing: integer("spacing").notNull().default(0),
  imageUrl: text("image_url").notNull(),
  columns: integer("columns").notNull(),
  rows: integer("rows").notNull(),
  tilesetType: text("tileset_type").notNull().default('auto-tiling').$type<TilesetType>(),
  multiTileConfig: jsonb("multi_tile_config").$type<MultiTileConfig | null>(),
  tags: jsonb("tags").$type<string[]>().default([]),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("tilesets_user_id_idx").on(table.userId),
  nameIdx: index("tilesets_name_idx").on(table.name),
  typeIdx: index("tilesets_type_idx").on(table.tilesetType),
  publicIdx: index("tilesets_public_idx").on(table.isPublic),
}));

// Physics configuration table
export const physicsConfigs = pgTable("physics_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: 'cascade' }),
  gravity: jsonb("gravity").$type<Vector2>().default({ x: 0, y: 980 }),
  airResistance: real("air_resistance").notNull().default(0.01),
  terminalVelocity: real("terminal_velocity").notNull().default(1000),
  physicsScale: real("physics_scale").notNull().default(1.0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Material configuration table
export const materialConfigs = pgTable("material_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  physicsConfigId: varchar("physics_config_id").notNull().references(() => physicsConfigs.id, { onDelete: 'cascade' }),
  materialId: varchar("material_id", { length: 50 }).notNull(),
  friction: real("friction").notNull().default(0.7),
  restitution: real("restitution").notNull().default(0.3),
  density: real("density").notNull().default(1.0),
  collisionType: text("collision_type").notNull().default('solid').$type<'solid' | 'platform' | 'trigger' | 'hazard'>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Physics entities table
export const physicsEntities = pgTable("physics_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => boards.id, { onDelete: 'cascade' }),
  spriteId: varchar("sprite_id").notNull(),
  mass: real("mass").notNull().default(1.0),
  drag: real("drag").notNull().default(0.01),
  restitution: real("restitution").notNull().default(0.3),
  friction: real("friction").notNull().default(0.7),
  isStatic: boolean("is_static").notNull().default(false),
  velocity: jsonb("velocity").$type<Vector2>().default({ x: 0, y: 0 }),
  acceleration: jsonb("acceleration").$type<Vector2>().default({ x: 0, y: 0 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  isEmailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
});

// Register user schema
export const registerUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  isEmailVerified: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  avatarUrl: true,
}).extend({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
});

// Login schema
export const loginUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Public user type (excludes sensitive fields)
// Removed duplicate PublicUser type - using the one defined later

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Create project schema for API input (without userId - will be set from auth)
export const createProjectSchema = insertProjectSchema.omit({ userId: true });

// Update project schema for partial updates
export const updateProjectSchema = insertProjectSchema.partial().omit({ userId: true });

export const insertBoardSchema = createInsertSchema(boards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Create board schema for API input
export const createBoardSchema = insertBoardSchema;

// Update board schema for partial updates
export const updateBoardSchema = insertBoardSchema.partial();

export const insertTilesetSchema = createInsertSchema(tilesets, {
  imageUrl: z.string().min(1, 'Image URL is required').refine(url => {
    // Allow relative paths starting with /
    if (url.startsWith('/')) {
      return true;
    }
    // Allow full HTTP/HTTPS URLs
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, 'Must be a valid URL or relative path starting with /')
}).omit({
  id: true,
  createdAt: true,
});

// Create tileset schema for API input (without userId - will be set from auth)
export const createTilesetSchema = insertTilesetSchema.omit({ userId: true });

// Update tileset schema for partial updates
export const updateTilesetSchema = insertTilesetSchema.partial().omit({ userId: true });

export const insertPhysicsConfigSchema = createInsertSchema(physicsConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMaterialConfigSchema = createInsertSchema(materialConfigs).omit({
  id: true,
  createdAt: true,
});

export const insertPhysicsEntitySchema = createInsertSchema(physicsEntities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Sprite database tables
export const sprites = pgTable("sprites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }), // Allow shared sprites
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  frameWidth: integer("frame_width").notNull(),
  frameHeight: integer("frame_height").notNull(),
  totalFrames: integer("total_frames").notNull(),
  category: text("category").notNull().default('general'),
  tags: jsonb("tags").$type<string[]>().default([]),
  spritesheetData: jsonb("spritesheet_data").$type<SpritesheetData | null>(),
  physicsEnabled: boolean("physics_enabled").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(false),
  metadata: jsonb("metadata").$type<{
    author?: string;
    version: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
  }>().default({
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("sprites_user_id_idx").on(table.userId),
  nameIdx: index("sprites_name_idx").on(table.name),
  categoryIdx: index("sprites_category_idx").on(table.category),
  publicIdx: index("sprites_public_idx").on(table.isPublic),
  createdAtIdx: index("sprites_created_at_idx").on(table.createdAt),
}));

export const animations = pgTable("animations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spriteId: varchar("sprite_id").notNull().references(() => sprites.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  state: text("state").notNull().$type<AnimationState>(),
  frames: jsonb("frames").$type<AnimationFrame[]>().default([]),
  fps: integer("fps").notNull().default(12),
  loop: boolean("loop").notNull().default(true),
  easing: text("easing").notNull().default('linear').$type<EasingType>(),
  totalDuration: integer("total_duration").notNull().default(0),
  metadata: jsonb("metadata").$type<{
    tags: string[];
    description?: string;
    createdAt: Date;
    updatedAt: Date;
  }>().default({
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stateMachines = pgTable("state_machines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spriteId: varchar("sprite_id").notNull().references(() => sprites.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  states: jsonb("states").$type<AnimationState[]>().default([]),
  transitions: jsonb("transitions").$type<AnimationTransition[]>().default([]),
  defaultState: text("default_state").notNull().$type<AnimationState>().default('idle'),
  currentState: text("current_state").notNull().$type<AnimationState>().default('idle'),
  variables: jsonb("variables").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const timelines = pgTable("timelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spriteId: varchar("sprite_id").notNull().references(() => sprites.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  duration: integer("duration").notNull().default(1000),
  fps: integer("fps").notNull().default(24),
  tracks: jsonb("tracks").$type<TimelineTrack[]>().default([]),
  playhead: integer("playhead").notNull().default(0),
  isPlaying: boolean("is_playing").notNull().default(false),
  loop: boolean("loop").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Zod schemas for sprite system
export const insertSpriteSchema = createInsertSchema(sprites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnimationSchema = createInsertSchema(animations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStateMachineSchema = createInsertSchema(stateMachines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimelineSchema = createInsertSchema(timelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Public user type (without sensitive information)
export type PublicUser = Omit<User, 'passwordHash' | 'isEmailVerified'> & {
  email?: string | null; // Ensure email is included in public user type
  lastLoginAt?: Date | null; // Include lastLoginAt in public user type
};

// Sprite system types
export type InsertSprite = z.infer<typeof insertSpriteSchema>;
export type SpriteData = typeof sprites.$inferSelect;

export type InsertAnimation = z.infer<typeof insertAnimationSchema>;
export type AnimationData = typeof animations.$inferSelect;

export type InsertStateMachine = z.infer<typeof insertStateMachineSchema>;
export type StateMachineData = typeof stateMachines.$inferSelect;

export type InsertTimeline = z.infer<typeof insertTimelineSchema>;
export type TimelineData = typeof timelines.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Extended project type for backward compatibility with legacy routes
export interface ProjectWithBoards extends Project {
  boards?: BoardData[];
  canvasState?: CanvasState; // Legacy property for migration
  tileMap?: TileMap; // Legacy property for migration
}

export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type BoardData = typeof boards.$inferSelect;

export type InsertTileset = z.infer<typeof insertTilesetSchema>;
export type TilesetData = typeof tilesets.$inferSelect;

export type InsertPhysicsConfig = z.infer<typeof insertPhysicsConfigSchema>;
export type PhysicsConfigData = typeof physicsConfigs.$inferSelect;

export type InsertMaterialConfig = z.infer<typeof insertMaterialConfigSchema>;
export type MaterialConfigData = typeof materialConfigs.$inferSelect;

export type InsertPhysicsEntity = z.infer<typeof insertPhysicsEntitySchema>;
export type PhysicsEntityData = typeof physicsEntities.$inferSelect;
