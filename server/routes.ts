import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import express from "express";
import * as Y from "yjs";
import { insertProjectSchema, insertTilesetSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Projects API
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", express.json(), async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", express.json(), async (req, res) => {
    try {
      const validatedData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, validatedData);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Tilesets API
  app.get("/api/tilesets", async (req, res) => {
    try {
      const tilesets = await storage.getAllTilesets();
      res.json(tilesets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tilesets" });
    }
  });

  app.get("/api/tilesets/:id", async (req, res) => {
    try {
      const tileset = await storage.getTileset(req.params.id);
      if (!tileset) {
        return res.status(404).json({ error: "Tileset not found" });
      }
      res.json(tileset);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tileset" });
    }
  });

  app.post("/api/tilesets", express.json(), async (req, res) => {
    try {
      const validatedData = insertTilesetSchema.parse(req.body);
      const tileset = await storage.createTileset(validatedData);
      res.status(201).json(tileset);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to create tileset" });
    }
  });

  app.delete("/api/tilesets/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTileset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Tileset not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tileset" });
    }
  });

  // Object Storage routes for tileset uploads
  // Get upload URL for a tileset image
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Serve uploaded tileset images (public access)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Update tileset with uploaded image URL
  app.put("/api/tilesets/:id/image", express.json(), async (req, res) => {
    try {
      if (!req.body.imageURL) {
        return res.status(400).json({ error: "imageURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.imageURL,
      );

      // Update the tileset with the image URL
      const tileset = await storage.getTileset(req.params.id);
      if (!tileset) {
        return res.status(404).json({ error: "Tileset not found" });
      }

      const updatedTileset = await storage.updateTileset(req.params.id, {
        imageUrl: objectPath,
      });

      res.status(200).json(updatedTileset);
    } catch (error) {
      console.error("Error updating tileset image:", error);
      res.status(500).json({ error: "Failed to update tileset image" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Set up WebSocket server for Y.js collaboration on a distinct path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store connections per room for simple broadcasting
  const rooms = new Map<string, Set<WebSocket>>();

  wss.on('connection', (conn: WebSocket, req) => {
    // Extract room ID from query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const roomId = url.searchParams.get('room') || 'default';

    console.log(`WebSocket connection established for room: ${roomId}`);

    // Add connection to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(conn);

    // Broadcast incoming messages to all other clients in the same room
    conn.on("message", (message: Buffer) => {
      const roomClients = rooms.get(roomId);
      if (roomClients) {
        roomClients.forEach((client) => {
          if (client !== conn && client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
    });

    // Cleanup on disconnect
    conn.on('close', () => {
      console.log(`WebSocket connection closed for room: ${roomId}`);
      const roomClients = rooms.get(roomId);
      if (roomClients) {
        roomClients.delete(conn);
        if (roomClients.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });

  return httpServer;
}
