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
    // Create a demo tileset
    const demoTileset: TilesetData = {
      id: randomUUID(),
      name: 'Demo Terrain',
      tileSize: 32,
      imageUrl: '/demo-tileset.png',
      columns: 8,
      rows: 4,
      createdAt: new Date(),
    };
    this.tilesets.set(demoTileset.id, demoTileset);
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

  async deleteTileset(id: string): Promise<boolean> {
    return this.tilesets.delete(id);
  }
}

export const storage = new MemStorage();
