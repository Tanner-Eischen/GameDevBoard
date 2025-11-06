import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import express from "express";
import * as Y from "yjs";
import { insertProjectSchema, insertTilesetSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { handleAiChat } from "./ai/chat";
import spritesRouter from "./routes/sprites";
import boardsRouter from "./routes/boards";
import physicsRouter from "./routes/physics";
import authRouter from "./routes/auth";
import autotilingRouter from "./routes/autotiling";
import terrainGenerationRouter from "./routes/terrain-generation";
import healthRouter from "./routes/health";
import { 
  asyncHandler, 
  ApiError, 
  ErrorCode, 
  validateParams,
  logError,
  handleDatabaseError 
} from './utils/errorHandler';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { 
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
  createBoardSchema,
  updateBoardSchema,
  boardIdSchema,
  updateTilesetSchema,
  tilesetIdSchema,
  imageUploadSchema,
  paginationSchema,
  searchSchema
} from './utils/schemas.js';
import { 
  validateFilename, 
  ALLOWED_IMAGE_TYPES 
} from './utils/validation.js';
import {
  aiChatRateLimit,
  generalApiRateLimit,
  fileUploadRateLimit,
  rateLimitStatus,
  rateLimitMonitoring
} from './middleware/rateLimiter.js';
import { authenticateToken } from './middleware/auth.js';
import { 
  authenticateWebSocket, 
  checkRoomAccess, 
  generateConnectionId,
  validateRoomId,
  extractTokenFromRequest,
  sendWebSocketError,
  sendAuthSuccess,
  type AuthenticatedWebSocket 
} from './middleware/websocketAuth.js';

// Parameter validation schemas
const projectParamsSchema = z.object({
  id: projectIdSchema
});

const boardParamsSchema = z.object({
  boardId: boardIdSchema
});

const tilesetParamsSchema = z.object({
  id: tilesetIdSchema
});

const projectBoardParamsSchema = z.object({
  projectId: projectIdSchema,
  boardId: boardIdSchema
});

const imageUrlSchema = z.object({
  imageURL: z.string().min(1, 'Image URL is required').refine(
    (url) => {
      // Allow relative paths starting with /
      if (url.startsWith('/')) return true;
      // Allow full HTTP/HTTPS URLs
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    'Valid image URL is required'
  )
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth API (must be first to avoid middleware conflicts)
  app.use("/api/auth", authRouter);

  // Projects API
  app.get("/api/projects", authenticateToken, asyncHandler(async (req, res) => {
    try {
      // Validate query parameters
      const query = validateParams(paginationSchema.merge(searchSchema), req.query);
      
      const projects = await storage.getAllProjects();
      
      // Migration: Ensure projects have boards array
      const migratedProjects = projects.map((project: any) => {
        // If project has old structure (canvasState/tileMap), migrate to boards
        if (project.canvasState && project.tileMap && !project.boards) {
          const defaultBoard = {
          id: 'default',
          projectId: project.id,
          name: 'Main Board',
          type: 'topdown' as const,
          tilesets: [],
          physics: {
            gravity: { x: 0, y: 0 },
            airResistance: 0.01,
            terminalVelocity: 1000,
            physicsScale: 1.0,
            enabled: false
          },
          canvasState: project.canvasState || { 
            shapes: [], 
            sprites: [],
            selectedIds: [],
            tool: 'select' as const,
            zoom: 1,
            pan: { x: 0, y: 0 },
            gridSize: 32,
            gridVisible: true,
            snapToGrid: false
          },
          tileMap: project.tileMap || { 
            gridSize: 32,
            tiles: [],
            spriteDefinitions: []
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
          return {
            ...project,
            boards: [defaultBoard],
          };
        }
        
        // Ensure boards array exists
        if (!project.boards) {
          project.boards = [];
        }
        
        // Migration: Add layer field to tiles that don't have it
        project.boards = project.boards.map((board: any) => {
          if (board.tileMap && board.tileMap.tiles) {
            board.tileMap.tiles = board.tileMap.tiles.map((tile: any) => {
              if (!tile.layer) {
                return { ...tile, layer: 'terrain' };
              }
              return tile;
            });
          }
          return board;
        });
        
        return project;
      });
      
      res.json(migratedProjects);
    } catch (error) {
      logError(error, 'GET_ALL_PROJECTS');
      throw handleDatabaseError(error);
    }
  }));

  app.get("/api/projects/:id", authenticateToken, asyncHandler(async (req, res) => {
    const { id } = validateParams(projectParamsSchema, req.params);
    
    try {
      const project = await storage.getProject(id);
      if (!project) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      
      // Migration: If project has old structure (canvasState/tileMap), migrate to boards
      if ((project as any).canvasState && (project as any).tileMap && !(project as any).boards) {
        const defaultBoard = {
          id: 'default',
          name: 'Main Board',
          canvasState: (project as any).canvasState,
          tileMap: (project as any).tileMap,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        (project as any).boards = [defaultBoard];
      }
      
      // Ensure boards array exists
      if (!(project as any).boards) {
        (project as any).boards = [];
      }
      
      // Migration: Add layer field to tiles that don't have it
      (project as any).boards = (project as any).boards.map((board: any) => {
        if (board.tileMap && board.tileMap.tiles) {
          board.tileMap.tiles = board.tileMap.tiles.map((tile: any) => {
            if (!tile.layer) {
              return { ...tile, layer: 'terrain' };
            }
            return tile;
          });
        }
        return board;
      });
      
      res.json(project);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'GET_PROJECT');
      throw handleDatabaseError(error);
    }
  }));

  app.post("/api/projects", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    try {
      const validatedData = validateParams(createProjectSchema, req.body);
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'CREATE_PROJECT');
      throw handleDatabaseError(error);
    }
  }));

  app.patch("/api/projects/:id", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    const { id } = validateParams(projectParamsSchema, req.params);
    
    try {
      const validatedData = validateParams(updateProjectSchema, req.body);
      const project = await storage.updateProject(id, validatedData);
      if (!project) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      res.json(project);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'UPDATE_PROJECT');
      throw handleDatabaseError(error);
    }
  }));

  app.delete("/api/projects/:id", authenticateToken, asyncHandler(async (req, res) => {
    const { id } = validateParams(projectParamsSchema, req.params);
    
    try {
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      res.status(204).send();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'DELETE_PROJECT');
      throw handleDatabaseError(error);
    }
  }));

  // Board-specific API endpoints
  app.get("/api/projects/:projectId/boards", authenticateToken, asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      res.json((project as any).boards || []);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'GET_PROJECT_BOARDS');
      throw handleDatabaseError(error);
    }
  }));

  app.get("/api/projects/:projectId/boards/:boardId", authenticateToken, asyncHandler(async (req, res) => {
    const { projectId, boardId } = req.params;
    
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      const board = (project as any).boards?.find((b: any) => b.id === boardId);
      if (!board) {
        throw new ApiError('Board not found', 404, ErrorCode.NOT_FOUND);
      }
      res.json(board);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'GET_PROJECT_BOARD');
      throw handleDatabaseError(error);
    }
  }));

  app.post("/api/projects/:projectId/boards", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    const { projectId } = validateParams(z.object({ projectId: projectIdSchema }), req.params);
    
    try {
      const validatedData = validateParams(createBoardSchema, req.body);
      
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      
      const newBoard = {
        id: validatedData.id || `board-${Date.now()}`,
        projectId: projectId,
        name: validatedData.name,
        description: validatedData.description,
        width: validatedData.width,
        height: validatedData.height,
        tileSize: validatedData.tileSize,
        backgroundColor: validatedData.backgroundColor,
        layers: validatedData.layers,
        metadata: validatedData.metadata,
        type: 'topdown' as const,
        tilesets: [],
        physics: {
          gravity: { x: 0, y: 0 },
          airResistance: 0.01,
          terminalVelocity: 1000,
          physicsScale: 1.0,
          enabled: false
        },
        canvasState: { 
          shapes: [], 
          sprites: [],
          selectedIds: [],
          tool: 'select' as const,
          zoom: 1,
          pan: { x: 0, y: 0 },
          gridSize: validatedData.tileSize,
          gridVisible: true,
          snapToGrid: false
        },
        tileMap: { 
          gridSize: validatedData.tileSize,
          tiles: [],
          spriteDefinitions: []
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      if (!(project as any).boards) {
        (project as any).boards = [];
      }
      (project as any).boards.push(newBoard);
      
      const updatedProject = await storage.updateProject(projectId, project);
      res.status(201).json(newBoard);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'CREATE_PROJECT_BOARD');
      throw handleDatabaseError(error);
    }
  }));

  app.patch("/api/projects/:projectId/boards/:boardId", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    const { projectId, boardId } = validateParams(projectBoardParamsSchema, req.params);
    
    try {
      const validatedData = validateParams(updateBoardSchema, req.body);
      
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      
      if (!(project as any).boards) {
        throw new ApiError('Board not found', 404, ErrorCode.NOT_FOUND);
      }
      
      const boardIndex = (project as any).boards.findIndex((b: any) => b.id === boardId);
      if (boardIndex === -1) {
        throw new ApiError('Board not found', 404, ErrorCode.NOT_FOUND);
      }
      
      (project as any).boards[boardIndex] = {
        ...(project as any).boards[boardIndex],
        ...validatedData,
        updatedAt: Date.now(),
      };
      
      const updatedProject = await storage.updateProject(projectId, project);
      res.json((project as any).boards[boardIndex]);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'UPDATE_PROJECT_BOARD');
      throw handleDatabaseError(error);
    }
  }));

  app.delete("/api/projects/:projectId/boards/:boardId", authenticateToken, asyncHandler(async (req, res) => {
    const { projectId, boardId } = validateParams(projectBoardParamsSchema, req.params);
    
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new ApiError('Project not found', 404, ErrorCode.NOT_FOUND);
      }
      
      if (!(project as any).boards) {
        throw new ApiError('Board not found', 404, ErrorCode.NOT_FOUND);
      }
      
      const boardIndex = (project as any).boards.findIndex((b: any) => b.id === boardId);
      if (boardIndex === -1) {
        throw new ApiError('Board not found', 404, ErrorCode.NOT_FOUND);
      }
      
      (project as any).boards.splice(boardIndex, 1);
      
      const updatedProject = await storage.updateProject(projectId, project);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'DELETE_PROJECT_BOARD');
      throw handleDatabaseError(error);
    }
  }));

  // Direct board API endpoints (for auto-save functionality)
  app.patch("/api/boards/:boardId", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    const { boardId } = validateParams(boardParamsSchema, req.params);
    
    try {
      const validatedData = validateParams(updateBoardSchema, req.body);
      const board = await storage.updateBoard(boardId, validatedData);
      if (!board) {
        throw new ApiError('Board not found', 404, ErrorCode.NOT_FOUND);
      }
      res.json(board);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'UPDATE_BOARD_DIRECT');
      throw handleDatabaseError(error);
    }
  }));

  // Tilesets API
  app.get("/api/tilesets", asyncHandler(async (req, res) => {
    try {
      // Validate query parameters
      const query = validateParams(paginationSchema.merge(searchSchema), req.query);
      
      // Check if user is authenticated
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token) {
        // If token is provided, authenticate and return all tilesets
        try {
          // Use the authentication middleware logic
          await new Promise<void>((resolve, reject) => {
            authenticateToken(req as any, res, (error?: any) => {
              if (error) reject(error);
              else resolve();
            });
          });
          
          // If authenticated, return all tilesets (built-in + user's)
          const tilesets = await storage.getAllTilesets();
          res.json(tilesets);
        } catch (authError) {
          // If authentication fails, fall back to built-in tilesets only
          const builtInTilesets = await storage.getBuiltInTilesets();
          res.json(builtInTilesets);
        }
      } else {
        // If no token provided, return only built-in tilesets
        const builtInTilesets = await storage.getBuiltInTilesets();
        res.json(builtInTilesets);
      }
    } catch (error) {
      logError(error, 'GET_ALL_TILESETS');
      throw handleDatabaseError(error);
    }
  }));

  app.get("/api/tilesets/:id", authenticateToken, asyncHandler(async (req, res) => {
    const { id } = validateParams(tilesetParamsSchema, req.params);
    
    try {
      const tileset = await storage.getTileset(id);
      if (!tileset) {
        throw new ApiError('Tileset not found', 404, ErrorCode.NOT_FOUND);
      }
      res.json(tileset);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'GET_TILESET');
      throw handleDatabaseError(error);
    }
  }));

  app.post("/api/tilesets", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    try {
      const validatedData = validateParams(insertTilesetSchema, req.body);
      
      // Normalize the imageUrl if it's a Google Cloud Storage URL
      if (validatedData.imageUrl) {
        const objectStorageService = new ObjectStorageService();
        validatedData.imageUrl = objectStorageService.normalizeObjectEntityPath(validatedData.imageUrl);
      }
      
      const tileset = await storage.createTileset(validatedData);
      res.status(201).json(tileset);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'CREATE_TILESET');
      throw handleDatabaseError(error);
    }
  }));

  app.patch("/api/tilesets/:id", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    const { id } = validateParams(tilesetParamsSchema, req.params);
    
    try {
      const validatedData = validateParams(updateTilesetSchema, req.body);
      const tileset = await storage.updateTileset(id, validatedData);
      if (!tileset) {
        throw new ApiError('Tileset not found', 404, ErrorCode.NOT_FOUND);
      }
      res.json(tileset);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'UPDATE_TILESET');
      throw handleDatabaseError(error);
    }
  }));

  app.delete("/api/tilesets/:id", authenticateToken, asyncHandler(async (req, res) => {
    const { id } = validateParams(tilesetParamsSchema, req.params);
    
    try {
      const deleted = await storage.deleteTileset(id);
      if (!deleted) {
        throw new ApiError('Tileset not found', 404, ErrorCode.NOT_FOUND);
      }
      res.status(204).send();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'DELETE_TILESET');
      throw handleDatabaseError(error);
    }
  }));

  // Get upload URL for tileset images with validation
  app.post("/api/tilesets/:id/upload-url", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    const { id } = validateParams(tilesetParamsSchema, req.params);
    
    // Validate upload request body
    const uploadRequestSchema = z.object({
      filename: z.string()
        .min(1, 'Filename is required')
        .max(255, 'Filename too long')
        .refine(filename => {
          const validation = validateFilename(filename);
          return validation.isValid;
        }, 'Invalid filename format'),
      contentType: z.string()
        .refine(type => ALLOWED_IMAGE_TYPES.includes(type as any), 
          `Content type must be one of: ${ALLOWED_IMAGE_TYPES.join(', ')}`)
        .optional()
    });
    
    const { filename, contentType } = validateParams(uploadRequestSchema, req.body);
    
    try {
      const tileset = await storage.getTileset(id);
      if (!tileset) {
        throw new ApiError('Tileset not found', 404, ErrorCode.NOT_FOUND);
      }

      // Sanitize filename
      const filenameValidation = validateFilename(filename);
      if (!filenameValidation.isValid) {
        throw new ApiError(filenameValidation.error || 'Invalid filename', 400, ErrorCode.VALIDATION_ERROR);
      }

      const objectStorageService = new ObjectStorageService();
      const uploadUrl = await objectStorageService.getUploadUrl(
        `tilesets/${id}/${filenameValidation.sanitized}`,
        contentType || 'image/png'
      );

      res.json({ uploadUrl });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'GET_TILESET_UPLOAD_URL');
      throw new ApiError('Failed to get upload URL', 500, ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  }));

  // Serve uploaded tileset images (public access)
  app.get("/objects/:objectPath(*)", asyncHandler(async (req, res) => {
    try {
      console.log('Serving object:', req.path);
      // Check if we should use local storage
      const useLocalStorage = process.env.PRIVATE_OBJECT_DIR && process.env.PRIVATE_OBJECT_DIR.startsWith('./');
      
      if (useLocalStorage) {
        const { LocalObjectStorageService } = await import('./localObjectStorage');
        const localStorageService = new LocalObjectStorageService();
        const filePath = await localStorageService.getObjectEntityFilePath(req.path);
        console.log('Resolved file path:', filePath);
        await localStorageService.downloadObject(filePath, res);
      } else {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        objectStorageService.downloadObject(objectFile, res);
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.log('Error serving object:', errMessage);
      if (error instanceof ObjectNotFoundError) {
        throw new ApiError('Object not found', 404, ErrorCode.NOT_FOUND);
      }
      logError(error, 'SERVE_OBJECT');
      throw new ApiError('Failed to serve object', 500, ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  }));

  // Update tileset with uploaded image URL
  app.put("/api/tilesets/:id/image", authenticateToken, express.json(), asyncHandler(async (req, res) => {
    const { id } = validateParams(tilesetParamsSchema, req.params);
    const { imageURL } = validateParams(imageUrlSchema, req.body);

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(imageURL);

      // Update the tileset with the image URL
      const tileset = await storage.getTileset(id);
      if (!tileset) {
        throw new ApiError('Tileset not found', 404, ErrorCode.NOT_FOUND);
      }

      const updatedTileset = await storage.updateTileset(id, {
        imageUrl: objectPath,
      });

      res.status(200).json(updatedTileset);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'UPDATE_TILESET_IMAGE');
      throw handleDatabaseError(error);
    }
  }));

  // General object upload URL endpoint
  app.post("/api/objects/upload", authenticateToken, asyncHandler(async (req, res) => {
    try {
      // Check if we should use local storage
      const useLocalStorage = process.env.PRIVATE_OBJECT_DIR && process.env.PRIVATE_OBJECT_DIR.startsWith('./');
      
      if (useLocalStorage) {
        const { LocalObjectStorageService } = await import('./localObjectStorage');
        const localStorageService = new LocalObjectStorageService();
        const { uploadUrl, objectPath } = await localStorageService.getObjectEntityUploadURL();
        
        // For local storage, return a server endpoint for file upload instead of local:// URL
        const serverUploadUrl = `/api/objects/upload-file/${encodeURIComponent(uploadUrl.replace('local://', ''))}`;
        res.json({ uploadURL: serverUploadUrl, objectPath });
      } else {
        const objectStorageService = new ObjectStorageService();
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        res.json({ uploadURL });
      }
    } catch (error) {
      logError(error, 'GET_OBJECT_UPLOAD_URL');
      throw new ApiError('Failed to get upload URL', 500, ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  }));

  // Local file upload handler for local storage (no auth required for local uploads)
  app.put("/api/objects/upload-file/:filePath(*)", asyncHandler(async (req, res) => {
    try {
      const filePath = decodeURIComponent(req.params.filePath);
      
      // Normalize path separators to handle Windows paths correctly
      const normalizedFilePath = filePath.replace(/\\/g, '/');
      
      // Validate that the file path is within the uploads directory
      const uploadsDir = path.resolve(process.env.PRIVATE_OBJECT_DIR || './uploads');
      const fullPath = path.resolve(normalizedFilePath);
      
      if (!fullPath.startsWith(uploadsDir)) {
        throw new ApiError('Invalid file path', 400, ErrorCode.VALIDATION_ERROR);
      }

      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

      // Write the file
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => {
        chunks.push(chunk);
      });

      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await fs.promises.writeFile(fullPath, buffer);
          
          // Return success response
          res.status(200).json({ 
            success: true, 
            message: 'File uploaded successfully',
            path: fullPath 
          });
        } catch (writeError) {
          logError(writeError, 'WRITE_LOCAL_FILE');
          throw new ApiError('Failed to write file', 500, ErrorCode.EXTERNAL_SERVICE_ERROR);
        }
      });

      req.on('error', (error) => {
        logError(error, 'UPLOAD_LOCAL_FILE');
        throw new ApiError('Failed to upload file', 500, ErrorCode.EXTERNAL_SERVICE_ERROR);
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logError(error, 'UPLOAD_LOCAL_FILE');
      throw new ApiError('Failed to upload file', 500, ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  }));

  // Sprites API
  app.use("/api/sprites", spritesRouter);

  // Boards API (new multi-board system)
  app.use("/api/boards", boardsRouter);

  // Physics API
  app.use("/api/physics", physicsRouter);

  // Enhanced Autotiling API
  app.use("/api/autotiling", autotilingRouter);

  // Terrain Generation API
  app.use("/api/terrain-generation", terrainGenerationRouter);

  // Health & Monitoring API
  app.use("/api/health", healthRouter);

  // AI Chat API
  // Note: express.json() is already applied globally in server/index.ts
  // Only add it here if we need different options for this specific route
  app.post("/api/ai/chat", authenticateToken, handleAiChat);

  // Create HTTP server
  const httpServer = createServer(app);

  // Set up WebSocket server for Y.js collaboration on a distinct path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store connections per room for simple broadcasting
  const rooms = new Map<string, Set<AuthenticatedWebSocket>>();

  wss.on('connection', async (conn: AuthenticatedWebSocket, req) => {
    // Extract room ID and token from query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const roomId = url.searchParams.get('room') || 'default';
    const token = extractTokenFromRequest(req.url || '');

    console.log(`WebSocket connection attempt for room: ${roomId}`);

    // Generate unique connection ID
    conn.connectionId = generateConnectionId();
    conn.roomId = roomId;
    conn.lastHeartbeat = Date.now();

    // Validate room ID format
    if (!validateRoomId(roomId)) {
      console.log(`Invalid room ID format: ${roomId}`);
      sendWebSocketError(conn, 'Invalid room ID format', 'INVALID_ROOM_ID');
      conn.close(1008, 'Invalid room ID');
      return;
    }

    // Authenticate the connection
    if (!token) {
      console.log('WebSocket connection missing authentication token');
      sendWebSocketError(conn, 'Authentication token required', 'NO_TOKEN');
      conn.close(1008, 'Authentication required');
      return;
    }

    const authResult = await authenticateWebSocket(token);
    if (!authResult.success || !authResult.user) {
      console.log(`WebSocket authentication failed: ${authResult.error}`);
      sendWebSocketError(conn, authResult.error || 'Authentication failed', authResult.errorCode || 'AUTH_FAILED');
      conn.close(1008, 'Authentication failed');
      return;
    }

    // Check room access permissions
    const hasAccess = await checkRoomAccess(authResult.user.id, roomId);
    if (!hasAccess) {
      console.log(`User ${authResult.user.id} denied access to room ${roomId}`);
      sendWebSocketError(conn, 'Access denied to room', 'ACCESS_DENIED');
      conn.close(1008, 'Access denied');
      return;
    }

    // Set authenticated connection properties
    conn.user = authResult.user;
    conn.userId = authResult.user.id;
    conn.isAuthenticated = true;

    console.log(`WebSocket connection authenticated for user ${authResult.user.username} in room: ${roomId}`);

    // Send authentication success message
    sendAuthSuccess(conn, authResult.user, roomId);

    // Add connection to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(conn);

    // Broadcast incoming messages to all other clients in the same room
    conn.on("message", (message: Buffer) => {
      // Update heartbeat on any message
      conn.lastHeartbeat = Date.now();

      // Handle heartbeat messages
      try {
        const messageStr = message.toString();
        const parsedMessage = JSON.parse(messageStr);
        
        if (parsedMessage.type === 'ping') {
          // Respond to ping with pong
          if (conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
          }
          return;
        }
      } catch (error) {
        // Not a JSON message, treat as binary Y.js update
      }

      // Broadcast to other clients in the room
      const roomClients = rooms.get(roomId);
      if (roomClients) {
        roomClients.forEach((client) => {
          if (client !== conn && client.readyState === WebSocket.OPEN && client.isAuthenticated) {
            client.send(message);
          }
        });
      }
    });

    // Clean up on disconnect
    conn.on("close", (code, reason) => {
      console.log(`WebSocket connection closed for user ${conn.user?.username} in room ${roomId}: ${code} ${reason}`);
      const roomClients = rooms.get(roomId);
      if (roomClients) {
        roomClients.delete(conn);
        if (roomClients.size === 0) {
          rooms.delete(roomId);
        }
      }
    });

    // Handle WebSocket errors
    conn.on("error", (error) => {
      logError(error, 'WEBSOCKET_ERROR');
      console.error(`WebSocket error for user ${conn.user?.username} in room ${roomId}:`, error);
    });
  });

  return httpServer;
}
