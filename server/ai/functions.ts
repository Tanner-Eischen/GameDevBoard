import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Define AI function schemas for canvas operations
export const canvasFunctions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "paintTerrain",
      description: `Paint terrain tiles (grass, dirt, or water) on the canvas with various patterns.
      
NATURAL LANGUAGE INTERPRETATION GUIDE:
- "field" / "area" / "background" → use 'fill' pattern with large area
- "river" / "winding river" / "stream" → use 'winding_path' pattern with high aspect ratio (width >> height or height >> width)
- "path" / "road" / "trail" → use 'horizontal_path', 'vertical_path', or 'diagonal_path' based on direction
- "border" / "frame" / "outline" → use 'border' pattern
- "winding" / "curved" / "meandering" / "snaking" → use 'winding_path' pattern with higher curveIntensity (0.4-0.5)
- "through" / "across" / "traversing" → path should span the full area dimension
- "narrow" → use smaller pathWidth (2-4), "wide" → use larger pathWidth (6-10)

ASPECT RATIO EXAMPLES:
- River across map: area = { x: 0, y: 10, width: 50, height: 15 } (wide, low height = horizontal river)
- River down map: area = { x: 10, y: 0, width: 15, height: 50 } (tall, low width = vertical river)

Use this when users ask to add terrain, paint backgrounds, create rivers, roads, paths, or fill areas.`,
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
              width: { type: "number", description: "Width in grid units (for rivers: make much larger than height for horizontal flow)" },
              height: { type: "number", description: "Height in grid units (for rivers: make much larger than width for vertical flow)" }
            },
            required: ["x", "y", "width", "height"],
            description: "The rectangular area to paint. For winding features like rivers, use high aspect ratio (one dimension much larger than the other)"
          },
          pattern: {
            type: "string",
            enum: ["fill", "border", "checkerboard", "horizontal_path", "vertical_path", "diagonal_path", "winding_path", "curved_path"],
            description: "Pattern type: 'fill' (solid area/field), 'border' (outline), 'checkerboard' (alternating), 'horizontal_path' (straight horizontal), 'vertical_path' (straight vertical), 'diagonal_path' (straight diagonal), 'winding_path' (curved with multiple turns - best for rivers), 'curved_path' (smoothly curved)"
          },
          pathWidth: {
            type: "number",
            description: "Width of the path in tiles (default: 3). Use 2-4 for narrow rivers/paths, 5-8 for wide rivers, 10+ for very wide features",
            minimum: 1,
            maximum: 20
          },
          curveIntensity: {
            type: "number",
            description: "How much the path curves (default: 0.3). Use 0.1-0.2 for gentle curves, 0.3-0.4 for moderate winding, 0.5+ for very winding/meandering",
            minimum: 0.1,
            maximum: 0.8
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
