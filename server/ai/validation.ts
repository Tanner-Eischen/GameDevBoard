import { z } from "zod";

// Validation schemas for AI function arguments
export const paintTerrainSchema = z.object({
  tilesetName: z.enum(["Dirt Terrain", "Grass Terrain", "Water Terrain"]),
  area: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive()
  }),
  pattern: z.enum([
    "fill", 
    "border", 
    "checkerboard",
    "horizontal_path",
    "vertical_path",
    "diagonal_path",
    "winding_path",
    "curved_path"
  ]),
  pathWidth: z.number().min(1).max(20).optional(),
  curveIntensity: z.number().min(0.1).max(0.8).optional()
});

export const createShapesSchema = z.object({
  shapeType: z.enum(["rectangle", "circle", "star", "polygon"]),
  count: z.number().min(1).max(20),
  layout: z.enum(["grid", "random", "circle", "line"]),
  area: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional(),
  style: z.object({
    fill: z.string().optional(),
    stroke: z.string().optional(),
    size: z.number().positive().optional()
  }).optional()
});

export const clearCanvasSchema = z.object({
  target: z.enum(["all", "shapes", "tiles"])
});

export const placeObjectSchema = z.object({
  objectName: z.enum(["Tree", "Tent", "Campfire 1", "Campfire 2", "Plateau Stone"]),
  placement: z.object({
    mode: z.enum(["single", "scatter", "grid"]),
    x: z.number(),
    y: z.number(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    count: z.number().min(1).max(50).optional()
  })
});

export type PaintTerrainArgs = z.infer<typeof paintTerrainSchema>;
export type CreateShapesArgs = z.infer<typeof createShapesSchema>;
export type ClearCanvasArgs = z.infer<typeof clearCanvasSchema>;
export type PlaceObjectArgs = z.infer<typeof placeObjectSchema>;
