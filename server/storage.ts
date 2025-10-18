import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type TilesetData,
  type InsertTileset,
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private tilesets: Map<string, TilesetData>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.tilesets = new Map();

    // Add some demo tilesets for testing
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create 3x3 demo tilesets from attached assets
    const dirtTileset: TilesetData = {
      id: randomUUID(),
      name: 'Dirt Terrain',
      tileSize: 16,
      imageUrl: '/attached_assets/dirt_3x3_1760825550695.png',
      columns: 3,
      rows: 3,
      createdAt: new Date(),
    };
    this.tilesets.set(dirtTileset.id, dirtTileset);

    const grassTileset: TilesetData = {
      id: randomUUID(),
      name: 'Grass Terrain',
      tileSize: 16,
      imageUrl: '/attached_assets/grass_3x3_kenney_1760825550695.png',
      columns: 3,
      rows: 3,
      createdAt: new Date(),
    };
    this.tilesets.set(grassTileset.id, grassTileset);

    const waterTileset: TilesetData = {
      id: randomUUID(),
      name: 'Water Terrain',
      tileSize: 16,
      imageUrl: '/attached_assets/water_3x3_1760825550696.png',
      columns: 3,
      rows: 3,
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
    const project: Project = {
      id,
      ...insertProject,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(
    id: string,
    updates: Partial<InsertProject>
  ): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updatedProject: Project = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    };
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
    const tileset: TilesetData = {
      id,
      ...insertTileset,
      createdAt: new Date(),
    };
    this.tilesets.set(id, tileset);
    return tileset;
  }

  async updateTileset(
    id: string,
    updates: Partial<InsertTileset>
  ): Promise<TilesetData | undefined> {
    const tileset = this.tilesets.get(id);
    if (!tileset) return undefined;

    const updatedTileset: TilesetData = {
      ...tileset,
      ...updates,
    };
    this.tilesets.set(id, updatedTileset);
    return updatedTileset;
  }

  async deleteTileset(id: string): Promise<boolean> {
    return this.tilesets.delete(id);
  }
}

export const storage = new MemStorage();
