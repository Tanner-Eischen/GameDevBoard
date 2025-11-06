import {
  type User,
  type InsertUser,
  type Project,
  type ProjectWithBoards,
  type InsertProject,
  type BoardData,
  type InsertBoard,
  type TilesetData,
  type InsertTileset,
  type TilesetType,
  type CanvasState,
  type TileMap,
} from "@shared/schema";
import { BUILT_IN_TILESETS, type BuiltInTileset } from "@shared/built-in-tilesets";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Boards
  getBoard(id: string): Promise<BoardData | undefined>;
  getBoardsByProject(projectId: string): Promise<BoardData[]>;
  createBoard(board: InsertBoard): Promise<BoardData>;
  updateBoard(id: string, updates: Partial<InsertBoard>): Promise<BoardData | undefined>;
  deleteBoard(id: string): Promise<boolean>;

  // Tilesets
  getTileset(id: string): Promise<TilesetData | undefined>;
  getAllTilesets(): Promise<TilesetData[]>;
  getBuiltInTilesets(): Promise<TilesetData[]>;
  createTileset(tileset: InsertTileset): Promise<TilesetData>;
  updateTileset(id: string, updates: Partial<InsertTileset>): Promise<TilesetData | undefined>;
  deleteTileset(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private boards: Map<string, BoardData>;
  private tilesets: Map<string, TilesetData>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.boards = new Map();
    this.tilesets = new Map();

    // Add some demo tilesets for testing
    this.initializeDemoData();
  }

  private async initializeDemoData() {
    try {
      // Initialize built-in tilesets
      this.initializeBuiltInTilesets();
      // Fix any existing tileset URLs with Windows backslashes
      this.fixExistingTilesetUrls();
      console.log('MemStorage initialized with built-in tilesets - ready for tileset uploads');
    } catch (error) {
      console.log('Demo data initialization skipped');
    }
  }

  private initializeBuiltInTilesets() {
    console.log('Initializing built-in tilesets...');
    BUILT_IN_TILESETS.forEach(builtInTileset => {
      // Calculate columns and rows based on tileset type
      let columns = 1;
      let rows = 1;
      
      if (builtInTileset.tilesetType === 'auto-tiling') {
         // Auto-tiling tilesets use 3x3 grids
         columns = 3;
         rows = 3;
       } else if (builtInTileset.tilesetType === 'multi-tile' && builtInTileset.multiTileConfig) {
        // Multi-tile objects use their configured dimensions
        columns = builtInTileset.multiTileConfig.width;
        rows = builtInTileset.multiTileConfig.height;
      } else if (builtInTileset.tilesetType === 'single-tile') {
        // Single tiles are 1x1
        columns = 1;
        rows = 1;
      }

      const tileset: any = {
        id: builtInTileset.id,
        userId: 'built-in', // Special user ID for built-in tilesets
        name: builtInTileset.name,
        imageUrl: builtInTileset.imageUrl,
        tileSize: builtInTileset.tileSize,
        spacing: 1, // 1 pixel spacing for 50x50px images with 3x3 grid of 16x16px tiles
        columns,
        rows,
        tilesetType: builtInTileset.tilesetType,
        multiTileConfig: builtInTileset.multiTileConfig || null,
        isPublic: true, // Built-in tilesets are public
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.tilesets.set(tileset.id, tileset);
    });
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: any = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Project methods
  async getProject(id: string): Promise<ProjectWithBoards | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    // Add boards to the project for backward compatibility
    const projectBoards = await this.getBoardsByProject(id);
    return {
      ...project,
      boards: projectBoards
    } as ProjectWithBoards;
  }

  async getAllProjects(): Promise<ProjectWithBoards[]> {
    const projects = Array.from(this.projects.values());
    const projectsWithBoards = await Promise.all(
      projects.map(async (project) => {
        const projectBoards = await this.getBoardsByProject(project.id);
        return {
          ...project,
          boards: projectBoards
        } as ProjectWithBoards;
      })
    );
    return projectsWithBoards;
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
    // Also delete all boards for this project
    const projectBoards = Array.from(this.boards.values()).filter(
      board => board.projectId === id
    );
    projectBoards.forEach(board => this.boards.delete(board.id));
    
    return this.projects.delete(id);
  }

  // Board methods
  async getBoard(id: string): Promise<BoardData | undefined> {
    return this.boards.get(id);
  }

  async getBoardsByProject(projectId: string): Promise<BoardData[]> {
    return Array.from(this.boards.values()).filter(
      board => board.projectId === projectId
    );
  }

  async createBoard(insertBoard: InsertBoard): Promise<BoardData> {
    const id = randomUUID();
    const now = new Date();
    const board: any = {
      id,
      ...insertBoard,
      createdAt: now,
      updatedAt: now,
    };
    this.boards.set(id, board);
    return board;
  }

  async updateBoard(
    id: string,
    updates: Partial<InsertBoard>
  ): Promise<BoardData | undefined> {
    const board = this.boards.get(id);
    if (!board) return undefined;

    const updatedBoard: any = {
      ...board,
      ...updates,
      updatedAt: new Date(),
    };
    this.boards.set(id, updatedBoard);
    return updatedBoard;
  }

  async deleteBoard(id: string): Promise<boolean> {
    return this.boards.delete(id);
  }

  async getTileset(id: string): Promise<TilesetData | undefined> {
    // Check built-in tilesets first
    const builtInTileset = Array.from(this.tilesets.values()).find(t => t.id === id && t.userId === 'built-in');
    if (builtInTileset) {
      return builtInTileset;
    }
    
    // Then check user-uploaded tilesets
    return this.tilesets.get(id);
  }

  async getAllTilesets(): Promise<TilesetData[]> {
    return Array.from(this.tilesets.values());
  }

  async getBuiltInTilesets(): Promise<TilesetData[]> {
    return Array.from(this.tilesets.values()).filter(tileset => tileset.userId === 'built-in');
  }

  async createTileset(insertTileset: InsertTileset): Promise<TilesetData> {
    const id = randomUUID();
    const tileset: any = {
      id,
      ...insertTileset,
      tileSize: insertTileset.tileSize ?? 32,
      spacing: insertTileset.spacing ?? 0,
      tilesetType: (insertTileset.tilesetType ?? 'auto-tiling') as TilesetType,
      multiTileConfig: insertTileset.multiTileConfig ?? null,
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

    const updatedTileset: any = {
      ...tileset,
      ...updates,
      tilesetType: (updates.tilesetType ?? tileset.tilesetType) as TilesetType,
    };
    this.tilesets.set(id, updatedTileset);
    return updatedTileset;
  }

  async deleteTileset(id: string): Promise<boolean> {
    return this.tilesets.delete(id);
  }

  // Fix existing tileset URLs that contain Windows backslashes
  fixExistingTilesetUrls(): void {
    console.log('Fixing existing tileset URLs with Windows backslashes...');
    let fixedCount = 0;
    
    for (const [id, tileset] of this.tilesets.entries()) {
      if (tileset.imageUrl && tileset.imageUrl.includes('%5C')) {
        // Replace URL-encoded backslashes with forward slashes
        const fixedUrl = tileset.imageUrl.replace(/%5C/g, '/');
        tileset.imageUrl = fixedUrl;
        this.tilesets.set(id, tileset);
        fixedCount++;
        console.log(`Fixed tileset "${tileset.name}" (${id}): ${tileset.imageUrl}`);
      }
    }
    
    console.log(`Fixed ${fixedCount} tileset URLs with Windows backslashes`);
  }
}

import { db, users as usersTable, projects as projectsTable, boards as boardsTable, tilesets as tilesetsTable } from "./db";
import { eq } from "drizzle-orm";

export class DbStorage implements IStorage {
  constructor() {
    // Skip database initialization for now
    console.log('DbStorage initialized (database features disabled)');
  }

  private async initializeDemoData() {
    try {
      // Check if demo tilesets already exist
      const existing = await this.getAllTilesets();
      if (existing.length > 0) {
        console.log(`Database already has ${existing.length} tileset(s)`);
        return;
      }

      console.log('DbStorage initialized - ready for tileset uploads');
      // Note: Demo tilesets can be added here if you have tileset images
      // Users can upload their own tilesets through the UI
    } catch (error) {
      console.log('Demo data initialization skipped:', error instanceof Error ? error.message : 'Unknown error');
    }
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
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
    // Delete all boards for this project first (cascade delete)
    await db.delete(boardsTable).where(eq(boardsTable.projectId, id));
    
    const result = await db.delete(projectsTable).where(eq(projectsTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Board methods
  async getBoard(id: string): Promise<BoardData | undefined> {
    const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, id));
    return board;
  }

  async getBoardsByProject(projectId: string): Promise<BoardData[]> {
    return await db.select().from(boardsTable).where(eq(boardsTable.projectId, projectId));
  }

  async createBoard(insertBoard: InsertBoard): Promise<BoardData> {
    const [board] = await db.insert(boardsTable).values(insertBoard as any).returning();
    return board;
  }

  async updateBoard(id: string, updates: Partial<InsertBoard>): Promise<BoardData | undefined> {
    const [board] = await db
      .update(boardsTable)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(boardsTable.id, id))
      .returning();
    return board;
  }

  async deleteBoard(id: string): Promise<boolean> {
    const result = await db.delete(boardsTable).where(eq(boardsTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Tileset methods
  async getTileset(id: string): Promise<TilesetData | undefined> {
    // Check built-in tilesets first
    const builtInTileset = this.getBuiltInTilesetsSync().find(t => t.id === id);
    if (builtInTileset) {
      return builtInTileset;
    }
    
    // Then check database
    const [tileset] = await db.select().from(tilesetsTable).where(eq(tilesetsTable.id, id));
    return tileset;
  }

  async getAllTilesets(): Promise<TilesetData[]> {
    // Combine built-in tilesets with database tilesets
    const builtInTilesets = this.getBuiltInTilesetsSync();
    const dbTilesets = await db.select().from(tilesetsTable);
    return [...builtInTilesets, ...dbTilesets];
  }

  async getBuiltInTilesets(): Promise<TilesetData[]> {
    return this.getBuiltInTilesetsSync();
  }

  private getBuiltInTilesetsSync(): TilesetData[] {
    return BUILT_IN_TILESETS.map(builtInTileset => {
      // Calculate columns and rows based on tileset type
      let columns = 1;
      let rows = 1;
      let multiTileConfig = null;
      
      if (builtInTileset.tilesetType === 'auto-tiling') {
         // Auto-tiling tilesets use 3x3 grids
         columns = 3;
         rows = 3;
       } else if (builtInTileset.tilesetType === 'multi-tile' && builtInTileset.multiTileConfig) {
        // Multi-tile objects use their configured dimensions
        columns = builtInTileset.multiTileConfig.width;
        rows = builtInTileset.multiTileConfig.height;
        
        // Generate tiles array for MultiTileConfig
        const tiles = [];
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < columns; x++) {
            tiles.push({ x, y });
          }
        }
        multiTileConfig = { tiles };
      } else if (builtInTileset.tilesetType === 'single-tile') {
        // Single tiles are 1x1
        columns = 1;
        rows = 1;
      }

      return {
        id: builtInTileset.id,
        userId: 'built-in',
        name: builtInTileset.name,
        imageUrl: builtInTileset.imageUrl,
        tileSize: builtInTileset.tileSize,
        spacing: 1, // 1 pixel spacing for 50x50px images with 3x3 grid of 16x16px tiles
        columns,
        rows,
        tilesetType: builtInTileset.tilesetType,
        multiTileConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        tags: [], // Add empty tags array for built-in tilesets
      };
    });
  }

  async createTileset(insertTileset: InsertTileset): Promise<TilesetData> {
    const tilesetData: any = {
      ...insertTileset,
      tilesetType: (insertTileset.tilesetType ?? 'auto-tiling') as TilesetType,
      multiTileConfig: insertTileset.multiTileConfig ?? null,
    };
    const [tileset] = await db.insert(tilesetsTable).values(tilesetData).returning();
    return tileset;
  }

  async updateTileset(id: string, updates: Partial<InsertTileset>): Promise<TilesetData | undefined> {
    const updateData: any = { ...updates };
    if (updates.tilesetType) {
      updateData.tilesetType = updates.tilesetType as TilesetType;
    }
    const [tileset] = await db
      .update(tilesetsTable)
      .set(updateData)
      .where(eq(tilesetsTable.id, id))
      .returning();
    return tileset;
  }

  async deleteTileset(id: string): Promise<boolean> {
    const result = await db.delete(tilesetsTable).where(eq(tilesetsTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

// Use database storage (set USE_MEMORY_STORAGE=true in .env to use in-memory storage for testing)
export const storage = process.env.USE_MEMORY_STORAGE === 'true' 
  ? new MemStorage() 
  : new DbStorage();
