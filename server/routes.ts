import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import express from "express";
import * as Y from "yjs";
import { setupWSConnection } from "y-websocket/bin/utils";
import { insertProjectSchema, insertTilesetSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

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

  // Create HTTP server
  const httpServer = createServer(app);

  // Set up WebSocket server for Y.js collaboration on a distinct path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store Y.js documents for each room/project
  const docs = new Map<string, Y.Doc>();

  wss.on('connection', (ws: WebSocket, req) => {
    // Extract room ID from query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const roomId = url.searchParams.get('room') || 'default';

    console.log(`WebSocket connection established for room: ${roomId}`);

    // Get or create Y.js document for this room
    if (!docs.has(roomId)) {
      docs.set(roomId, new Y.Doc());
    }

    const doc = docs.get(roomId)!;

    // Set up Y.js WebSocket connection
    setupWSConnection(ws, req, {
      gc: true,
      docName: roomId,
    });

    ws.on('close', () => {
      console.log(`WebSocket connection closed for room: ${roomId}`);
    });
  });

  // Broadcast function for sending updates to all connected clients in a room
  const broadcastToRoom = (roomId: string, message: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };

  return httpServer;
}
