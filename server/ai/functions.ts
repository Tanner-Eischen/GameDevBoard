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
      name: "placeObject",
      description: `Place prop objects (trees, tents, campfires, plateau stones) on the canvas at specific positions or scattered across an area.

AVAILABLE OBJECTS:
- "Tree" - A tall tree prop
- "Tent" - A camping tent (2x2 tiles)
- "Campfire 1" - Campfire variant 1 (single tile)
- "Campfire 2" - Campfire variant 2 (single tile)
- "Plateau Stone" - Large stone plateau (3x6 tiles)

PLACEMENT MODES:
- Single placement: Specify exact x,y coordinates to place one object
- Multiple scattered: Specify area and count to randomly scatter objects
- Grid placement: Specify area and count with grid layout

Use this when users ask to add objects, props, decorations, or natural elements like trees, tents, campfires, or rocks.`,
      parameters: {
        type: "object",
        properties: {
          objectName: {
            type: "string",
            enum: ["Tree", "Tent", "Campfire 1", "Campfire 2", "Plateau Stone"],
            description: "The type of object to place"
          },
          placement: {
            type: "object",
            properties: {
              mode: {
                type: "string",
                enum: ["single", "scatter", "grid"],
                description: "Placement mode: 'single' (one object at specific position), 'scatter' (randomly distribute), 'grid' (organized grid)"
              },
              x: {
                type: "number",
                description: "X coordinate for single placement, or area start X for scatter/grid"
              },
              y: {
                type: "number",
                description: "Y coordinate for single placement, or area start Y for scatter/grid"
              },
              width: {
                type: "number",
                description: "Area width for scatter/grid placement (not used for single)"
              },
              height: {
                type: "number",
                description: "Area height for scatter/grid placement (not used for single)"
              },
              count: {
                type: "number",
                description: "Number of objects to place (for scatter/grid modes)",
                minimum: 1,
                maximum: 50
              }
            },
            required: ["mode", "x", "y"],
            description: "Placement configuration - must include x,y always. For scatter/grid, also include width, height, count"
          }
        },
        required: ["objectName", "placement"]
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
  },
  {
    type: "function",
    function: {
      name: "placeSprites",
      description: "Place animated sprites on the canvas at specified positions. Use this when users want to add characters, NPCs, enemies, or any animated game objects.",
      parameters: {
        type: "object",
        properties: {
          spriteType: {
            type: "string",
            enum: ["knight-demo"],
            description: "The type of sprite to place. Currently available: 'knight-demo' (armored knight character)"
          },
          count: {
            type: "number",
            description: "How many sprites to place",
            minimum: 1,
            maximum: 10
          },
          layout: {
            type: "string",
            enum: ["grid", "random", "circle", "line", "formation"],
            description: "How to arrange the sprites: 'grid' (organized grid), 'random' (scattered), 'circle' (circular pattern), 'line' (horizontal line), 'formation' (tactical formation)"
          },
          area: {
            type: "object",
            properties: {
              x: { type: "number", description: "Starting X coordinate in pixels" },
              y: { type: "number", description: "Starting Y coordinate in pixels" },
              width: { type: "number", description: "Area width in pixels" },
              height: { type: "number", description: "Area height in pixels" }
            },
            description: "The area where sprites should be placed (optional, defaults to center)"
          },
          animation: {
            type: "string",
            enum: ["idle", "walk", "run", "attack", "hurt", "die"],
            description: "Initial animation state for the sprites (default: 'idle')"
          },
          scale: {
            type: "number",
            description: "Scale factor for the sprites (default: 1.0, range: 0.5-3.0)",
            minimum: 0.5,
            maximum: 3.0
          },
          rotation: {
            type: "number",
            description: "Rotation angle in degrees (default: 0, range: 0-360)",
            minimum: 0,
            maximum: 360
          }
        },
        required: ["spriteType", "count", "layout"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createScene",
      description: `Create a complete detailed scene with multiple layers, terrain, and objects with intelligent random placement.
      
This is a high-level function that creates entire maps at once with proper layering and random variation.
Use this when users ask to create a complete scene, generate a whole map, or build an entire environment.

SCENE TYPES:
- "forest" - Dense forest with grass, trees, and natural elements
- "camp" - Campground with grass, paths, tents, and campfires
- "village" - Settlement with paths, buildings, and decorations
- "grassland" - Open field with grass variations and scattered objects
- "mixed" - Custom combination based on user description

The function automatically:
- Creates appropriate base terrain (grass with variants for natural look)
- Adds winding paths or rivers if requested
- Randomly scatters objects with natural spacing
- Uses different tile variants for visual variety
- Ensures objects don't overlap
- Creates a cohesive, professional-looking scene`,
      parameters: {
        type: "object",
        properties: {
          sceneType: {
            type: "string",
            enum: ["forest", "camp", "village", "grassland", "mixed"],
            description: "The type of scene to create"
          },
          area: {
            type: "object",
            properties: {
              x: { type: "number", description: "Starting X coordinate" },
              y: { type: "number", description: "Starting Y coordinate" },
              width: { type: "number", description: "Scene width in tiles" },
              height: { type: "number", description: "Scene height in tiles" }
            },
            required: ["x", "y", "width", "height"],
            description: "The area for the scene"
          },
          features: {
            type: "object",
            properties: {
              grassVariants: {
                type: "boolean",
                description: "Use grass variants for more natural look (default: true)"
              },
              trees: {
                type: "number",
                description: "Number of trees to scatter (default: 0, max: 30)"
              },
              paths: {
                type: "boolean",
                description: "Add winding paths through the scene (default: false)"
              },
              water: {
                type: "boolean",
                description: "Add a winding river or stream (default: false)"
              },
              objects: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", description: "Object type name" },
                    count: { type: "number", description: "How many to place" }
                  }
                },
                description: "Additional objects to scatter (tents, campfires, etc.)"
              }
            },
            description: "Scene features and density"
          }
        },
        required: ["sceneType", "area"]
      }
    }
  }
];
