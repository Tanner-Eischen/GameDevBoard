import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Define AI function schemas for canvas operations
export const canvasFunctions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "paintTerrain",
      description: "Paint terrain tiles (grass, dirt, or water) on the canvas in a specified area with different patterns. Use this when the user wants to add terrain, fill areas, or create backgrounds.",
      parameters: {
        type: "object",
        properties: {
          tilesetName: {
            type: "string",
            enum: ["Dirt Terrain", "Grass Terrain", "Water Terrain"],
            description: "The type of terrain to paint"
          },
          area: {
            type: "object",
            properties: {
              x: { type: "number", description: "Starting X coordinate in grid units" },
              y: { type: "number", description: "Starting Y coordinate in grid units" },
              width: { type: "number", description: "Width in grid units" },
              height: { type: "number", description: "Height in grid units" }
            },
            required: ["x", "y", "width", "height"],
            description: "The rectangular area to paint"
          },
          pattern: {
            type: "string",
            enum: ["fill", "border", "checkerboard"],
            description: "How to paint the tiles: 'fill' (solid area), 'border' (outline only), 'checkerboard' (alternating pattern)"
          }
        },
        required: ["tilesetName", "area", "pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createShapes",
      description: "Create geometric shapes (rectangles, circles, stars) on the canvas with specified layout and styling. Use this when the user wants to add shapes, objects, or visual elements.",
      parameters: {
        type: "object",
        properties: {
          shapeType: {
            type: "string",
            enum: ["rectangle", "circle", "star", "polygon"],
            description: "The type of shape to create"
          },
          count: {
            type: "number",
            description: "How many shapes to create",
            minimum: 1,
            maximum: 20
          },
          layout: {
            type: "string",
            enum: ["grid", "random", "circle", "line"],
            description: "How to arrange the shapes: 'grid' (organized grid), 'random' (scattered), 'circle' (circular pattern), 'line' (horizontal line)"
          },
          area: {
            type: "object",
            properties: {
              x: { type: "number", description: "Starting X coordinate" },
              y: { type: "number", description: "Starting Y coordinate" },
              width: { type: "number", description: "Area width" },
              height: { type: "number", description: "Area height" }
            },
            description: "The area where shapes should be placed (optional, defaults to center)"
          },
          style: {
            type: "object",
            properties: {
              fill: { type: "string", description: "Fill color (hex code)" },
              stroke: { type: "string", description: "Stroke color (hex code)" },
              size: { type: "number", description: "Size of each shape in pixels" }
            },
            description: "Visual styling for the shapes (optional)"
          }
        },
        required: ["shapeType", "count", "layout"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyzeCanvas",
      description: "Analyze the current canvas state and provide insights, statistics, and suggestions. Use this when the user asks about their canvas, wants feedback, or needs suggestions.",
      parameters: {
        type: "object",
        properties: {},
        description: "No parameters needed - analyzes current canvas state"
      }
    }
  },
  {
    type: "function",
    function: {
      name: "clearCanvas",
      description: "Clear all or specific elements from the canvas. Use with caution - always confirm with user before executing. Use this when user explicitly asks to clear, delete, or remove things.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["all", "shapes", "tiles"],
            description: "What to clear: 'all' (everything), 'shapes' (only shapes), 'tiles' (only tiles)"
          }
        },
        required: ["target"]
      }
    }
  }
];
