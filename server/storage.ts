import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type TilesetData,
  type InsertTileset,
  type TilesetPack,
  type InsertTilesetPack,
  type CanvasState,
  type TileMap,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Tilesets
  getTileset(id: string): Promise<TilesetData | undefined>;
  getAllTilesets(): Promise<TilesetData[]>;
  createTileset(tileset: InsertTileset): Promise<TilesetData>;
  updateTileset(id: string, updates: Partial<InsertTileset>): Promise<TilesetData | undefined>;
  deleteTileset(id: string): Promise<boolean>;

  // Tileset Packs
  getTilesetPack(id: string): Promise<TilesetPack | undefined>;
  getAllTilesetPacks(): Promise<TilesetPack[]>;
  createTilesetPack(pack: InsertTilesetPack): Promise<TilesetPack>;
  updateTilesetPack(id: string, updates: Partial<InsertTilesetPack>): Promise<TilesetPack | undefined>;
  deleteTilesetPack(id: string): Promise<boolean>;
  getTilesetsByPackId(packId: string): Promise<TilesetData[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private tilesets: Map<string, TilesetData>;
  private tilesetPacks: Map<string, TilesetPack>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.tilesets = new Map();
    this.tilesetPacks = new Map();

    // Add some demo tilesets for testing
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create 3x3 demo tilesets from attached assets
    // Each image is 50x50 pixels with 9 tiles of 16x16 pixels and 1px spacing
    const dirtTileset: TilesetData = {
      id: randomUUID(),
      name: 'Dirt Terrain',
      tileSize: 16,
      spacing: 1,
      imageUrl: '/attached_assets/dirt_3x3_1760825550695.png',
      columns: 3,
      rows: 3,
      tilesetType: 'auto-tiling',
      multiTileConfig: null,
      packId: null,
      createdAt: new Date(),
    };
    this.tilesets.set(dirtTileset.id, dirtTileset);

    const grassTileset: TilesetData = {
      id: randomUUID(),
      name: 'Grass Terrain',
      tileSize: 16,
      spacing: 1,
      imageUrl: '/attached_assets/grass_3x3_kenney_1760825550695.png',
      columns: 3,
      rows: 3,
      tilesetType: 'auto-tiling',
      multiTileConfig: null,
      packId: null,
      createdAt: new Date(),
    };
    this.tilesets.set(grassTileset.id, grassTileset);

    const waterTileset: TilesetData = {
      id: randomUUID(),
      name: 'Water Terrain',
      tileSize: 16,
      spacing: 1,
      imageUrl: '/attached_assets/water_3x3_1760825550696.png',
      columns: 3,
      rows: 3,
      tilesetType: 'auto-tiling',
      multiTileConfig: null,
      packId: null,
      createdAt: new Date(),
    };
    this.tilesets.set(waterTileset.id, waterTileset);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Project methods
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const project = {
      id,
      ...insertProject,
      createdAt: now,
      updatedAt: now,
    } as Project;
    this.projects.set(id, project);
    return project;
  }

  async updateProject(
    id: string,
    updates: Partial<InsertProject>
  ): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    } as Project;
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Tileset methods
  async getTileset(id: string): Promise<TilesetData | undefined> {
    return this.tilesets.get(id);
  }

  async getAllTilesets(): Promise<TilesetData[]> {
    return Array.from(this.tilesets.values());
  }

  async createTileset(insertTileset: InsertTileset): Promise<TilesetData> {
    const id = randomUUID();
    const tileset = {
      id,
      name: insertTileset.name,
      tileSize: insertTileset.tileSize ?? 32,
      spacing: insertTileset.spacing ?? 0,
      imageUrl: insertTileset.imageUrl,
      columns: insertTileset.columns,
      rows: insertTileset.rows,
      tilesetType: (insertTileset.tilesetType ?? 'auto-tiling') as 'auto-tiling' | 'multi-tile' | 'variant_grid',
      multiTileConfig: (insertTileset.multiTileConfig ?? null) as MultiTileConfig | null,
      packId: insertTileset.packId ?? null,
      createdAt: new Date(),
    } as TilesetData;
    this.tilesets.set(id, tileset);
    return tileset;
  }

  async updateTileset(
    id: string,
    updates: Partial<InsertTileset>
  ): Promise<TilesetData | undefined> {
    const tileset = this.tilesets.get(id);
    if (!tileset) return undefined;

    const updatedTileset = {
      ...tileset,
      ...updates,
      tilesetType: updates.tilesetType ? (updates.tilesetType as 'auto-tiling' | 'multi-tile' | 'variant_grid') : tileset.tilesetType,
      multiTileConfig: updates.multiTileConfig !== undefined ? (updates.multiTileConfig as MultiTileConfig | null) : tileset.multiTileConfig,
    } as TilesetData;
    this.tilesets.set(id, updatedTileset);
    return updatedTileset;
  }

  async deleteTileset(id: string): Promise<boolean> {
    return this.tilesets.delete(id);
  }

  // Tileset Pack methods
  async getTilesetPack(id: string): Promise<TilesetPack | undefined> {
    return this.tilesetPacks.get(id);
  }

  async getAllTilesetPacks(): Promise<TilesetPack[]> {
    return Array.from(this.tilesetPacks.values());
  }

  async createTilesetPack(insertPack: InsertTilesetPack): Promise<TilesetPack> {
    const id = randomUUID();
    const now = new Date();
    const pack: TilesetPack = {
      id,
      name: insertPack.name,
      tags: (insertPack.tags || []) as string[],
      description: insertPack.description || null,
      createdAt: now,
      updatedAt: now,
    };
    this.tilesetPacks.set(id, pack);
    return pack;
  }

  async updateTilesetPack(
    id: string,
    updates: Partial<InsertTilesetPack>
  ): Promise<TilesetPack | undefined> {
    const pack = this.tilesetPacks.get(id);
    if (!pack) return undefined;

    const updatedPack: TilesetPack = {
      ...pack,
      ...updates,
      tags: updates.tags ? (updates.tags as string[]) : pack.tags,
      updatedAt: new Date(),
    };
    this.tilesetPacks.set(id, updatedPack);
    return updatedPack;
  }

  async deleteTilesetPack(id: string): Promise<boolean> {
    return this.tilesetPacks.delete(id);
  }

  async getTilesetsByPackId(packId: string): Promise<TilesetData[]> {
    return Array.from(this.tilesets.values()).filter(
      (tileset) => tileset.packId === packId
    );
  }
}

import { db, users as usersTable, projects as projectsTable, tilesets as tilesetsTable, tilesetPacks as tilesetPacksTable } from "./db";
import { eq } from "drizzle-orm";

export class DbStorage implements IStorage {
  constructor() {
    this.initializeDemoData();
  }

  private async initializeDemoData() {
    // Check if demo tilesets already exist
    const existing = await this.getAllTilesets();
    if (existing.length > 0) return;

    // Create 3x3 demo tilesets from attached assets
    await this.createTileset({
      name: 'Dirt Terrain',
      tileSize: 16,
      spacing: 1,
      imageUrl: '/attached_assets/dirt_3x3_1760825550695.png',
      columns: 3,
      rows: 3,
    });

    await this.createTileset({
      name: 'Grass Terrain',
      tileSize: 16,
      spacing: 1,
      imageUrl: '/attached_assets/grass_3x3_kenney_1760825550695.png',
      columns: 3,
      rows: 3,
    });

    await this.createTileset({
      name: 'Water Terrain',
      tileSize: 16,
      spacing: 1,
      imageUrl: '/attached_assets/water_3x3_1760825550696.png',
      columns: 3,
      rows: 3,
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(usersTable).values(insertUser).returning();
    return user;
  }

  // Project methods
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    return project;
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projectsTable);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projectsTable).values(insertProject as any).returning();
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projectsTable)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(projectsTable.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projectsTable).where(eq(projectsTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Tileset methods
  async getTileset(id: string): Promise<TilesetData | undefined> {
    const [tileset] = await db.select().from(tilesetsTable).where(eq(tilesetsTable.id, id));
    return tileset;
  }

  async getAllTilesets(): Promise<TilesetData[]> {
    return await db.select().from(tilesetsTable);
  }

  async createTileset(insertTileset: InsertTileset): Promise<TilesetData> {
    const [tileset] = await db.insert(tilesetsTable).values(insertTileset as any).returning();
    return tileset as TilesetData;
  }

  async updateTileset(id: string, updates: Partial<InsertTileset>): Promise<TilesetData | undefined> {
    const [tileset] = await db
      .update(tilesetsTable)
      .set(updates as any)
      .where(eq(tilesetsTable.id, id))
      .returning();
    return tileset as TilesetData;
  }

  async deleteTileset(id: string): Promise<boolean> {
    const result = await db.delete(tilesetsTable).where(eq(tilesetsTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Tileset Pack methods
  async getTilesetPack(id: string): Promise<TilesetPack | undefined> {
    const [pack] = await db.select().from(tilesetPacksTable).where(eq(tilesetPacksTable.id, id));
    return pack;
  }

  async getAllTilesetPacks(): Promise<TilesetPack[]> {
    return await db.select().from(tilesetPacksTable);
  }

  async createTilesetPack(insertPack: InsertTilesetPack): Promise<TilesetPack> {
    const [pack] = await db.insert(tilesetPacksTable).values(insertPack as any).returning();
    return pack as TilesetPack;
  }

  async updateTilesetPack(id: string, updates: Partial<InsertTilesetPack>): Promise<TilesetPack | undefined> {
    const [pack] = await db
      .update(tilesetPacksTable)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(tilesetPacksTable.id, id))
      .returning();
    return pack;
  }

  async deleteTilesetPack(id: string): Promise<boolean> {
    const result = await db.delete(tilesetPacksTable).where(eq(tilesetPacksTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTilesetsByPackId(packId: string): Promise<TilesetData[]> {
    return await db.select().from(tilesetsTable).where(eq(tilesetsTable.packId, packId));
  }
}

// Use database storage instead of in-memory
export const storage = new DbStorage();
