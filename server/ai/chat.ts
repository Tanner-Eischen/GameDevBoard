import { Request, Response } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { canvasFunctions } from './functions.js';
import { 
  executePaintTerrain, 
  executeCreateShapes, 
  executeAnalyzeCanvas, 
  executePlaceObject, 
  executeClearCanvas, 
  executePlaceSprites,
  executeCreateSprite,
  executeSetPhysics,
  executePlatformerTerrain,
  executeAnimateSprite,
  type ExecutionResult 
} from './executor.js';
import type { CanvasState, TileMap } from "@shared/schema";
import { storage } from "../storage";
import {
  paintTerrainSchema,
  createShapesSchema,
  clearCanvasSchema,
  placeObjectSchema
} from "./validation";
import { getEnvironment } from '../config/env.js';
import { 
  asyncHandler, 
  ApiError, 
  ErrorCode, 
  validateParams,
  logError 
} from '../utils/errorHandler';
import { 
  sanitizeText, 
  sanitizeHtml, 
  VALIDATION_LIMITS 
} from '../utils/validation.js';

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  canvasState: CanvasState;
  tileMap: TileMap;
}

// Validation schemas with enhanced security
// Note: We sanitize AFTER validation to preserve original content for processing
// but ensure safe storage/display
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string()
    .min(1, 'Message content cannot be empty')
    .max(VALIDATION_LIMITS.CHAT_MESSAGE_MAX, `Message content cannot exceed ${VALIDATION_LIMITS.CHAT_MESSAGE_MAX} characters`)
    // Sanitize only for display/storage, but keep original for AI processing
    .transform((val) => {
      // Only sanitize if content appears to contain HTML/script tags
      // This preserves normal text while still protecting against XSS
      if (/<[^>]+>/g.test(val)) {
        return sanitizeText(val);
      }
      // Basic sanitization for control characters only
      return val.replace(/[\x00-\x1F\x7F]/g, '').trim();
    })
});

const canvasStateSchema = z.object({
  shapes: z.array(z.any()).optional().default([]),
  selectedIds: z.array(z.string()).optional().default([]),
  sprites: z.array(z.any()).optional().default([]),
  tool: z.string().optional(),
  zoom: z.number().min(0.1).max(10).optional().default(1),
  pan: z.object({
    x: z.number(),
    y: z.number()
  }).optional().default({ x: 0, y: 0 }),
  gridSize: z.number().min(1).max(100).optional().default(32),
  gridVisible: z.boolean().optional().default(true),
  snapToGrid: z.boolean().optional().default(false)
});

const tileMapSchema = z.object({
  gridSize: z.number().min(1).max(100).optional().default(32),
  tiles: z.array(z.any()).optional().default([]),
  spriteDefinitions: z.array(z.any()).optional().default([])
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema)
    .min(1, 'At least one message is required')
    .max(50, 'Too many messages in conversation'),
  canvasState: canvasStateSchema,
  tileMap: tileMapSchema,
  tilesets: z.array(z.object({}).passthrough()).optional()
});

const functionExecutionSchema = z.object({
  name: z.string().min(1, 'Function name is required'),
  arguments: z.string().min(1, 'Function arguments are required')
});

export const handleAiChat = asyncHandler(async (req: Request, res: Response) => {
  // Ensure request body is properly parsed
  // This is defensive - express.json() should already handle this, but check anyway
  if (!req.body || typeof req.body !== 'object') {
    console.error('[AI_CHAT] Request body is not properly parsed:', {
      bodyType: typeof req.body,
      bodyValue: req.body,
      contentType: req.headers['content-type']
    });
    res.status(400).json({
      error: 'Invalid request body format',
      code: ErrorCode.VALIDATION_ERROR,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Log incoming request for debugging
  console.log('[AI_CHAT] Incoming request:', {
    messageCount: req.body?.messages?.length || 0,
    hasCanvasState: !!req.body?.canvasState,
    hasTileMap: !!req.body?.tileMap,
    canvasStateKeys: req.body?.canvasState ? Object.keys(req.body.canvasState) : [],
    tileMapKeys: req.body?.tileMap ? Object.keys(req.body.tileMap) : [],
    bodyKeys: Object.keys(req.body)
  });

  // Validate request body
  let messages: ChatMessage[];
  let canvasState: CanvasState;
  let tileMap: TileMap;
  let tilesets: any[] | undefined;

  try {
    const requestData = validateParams(chatRequestSchema, req.body);
    messages = requestData.messages;
    canvasState = requestData.canvasState;
    tileMap = requestData.tileMap;
    tilesets = requestData.tilesets;
    
    console.log('[AI_CHAT] Validation passed:', {
      messageCount: messages.length,
      canvasStateShape: canvasState.shapes?.length || 0,
      canvasStateSelectedIds: canvasState.selectedIds?.length || 0,
      tileMapTiles: tileMap.tiles?.length || 0,
      tilesetsCount: tilesets?.length || 0
    });
  } catch (validationError: any) {
    console.error('[AI_CHAT] Validation failed:', {
      errorType: validationError.constructor?.name,
      message: validationError.message,
      isApiError: validationError instanceof ApiError,
      details: validationError.details || validationError.issues || validationError
    });
    logError(validationError, 'AI_CHAT_VALIDATION');
    
    // Extract detailed validation error message
    let errorMessage = 'Invalid request data';
    if (validationError instanceof ApiError) {
      errorMessage = validationError.message;
      if (validationError.details?.message) {
        errorMessage = validationError.details.message;
      }
    } else if (validationError.issues) {
      // Zod validation error
      const issueMessages = validationError.issues.map((issue: any) => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join('; ');
      errorMessage = `Validation failed: ${issueMessages}`;
    } else if (validationError.message) {
      errorMessage = validationError.message;
    }
    
    const apiError = validationError instanceof ApiError 
      ? validationError 
      : new ApiError(errorMessage, 400, ErrorCode.VALIDATION_ERROR, {
          originalError: validationError.message,
          issues: validationError.issues
        });
    
    // Ensure response hasn't been sent already
    if (!res.headersSent) {
      res.status(apiError.statusCode).json({
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
        timestamp: new Date().toISOString()
      });
    } else {
      // Headers already sent, try to close the connection
      console.error('[AI_CHAT] Attempted to send validation error but headers already sent');
      try {
        res.end();
      } catch (e) {
        // Ignore - response might already be closed
      }
    }
    return; // Exit early, don't continue with SSE setup
  }

  try {
    // Fetch tilesets if not provided in request
    if (!tilesets || tilesets.length === 0) {
      console.log('[AI_CHAT] Tilesets not provided, fetching from storage...');
      try {
        const allTilesets = await storage.getAllTilesets();
        // Pass full tileset objects for functions that need tilesetType and multiTileConfig
        tilesets = allTilesets as any;
        console.log('[AI_CHAT] Fetched tilesets from storage:', {
          count: tilesets.length,
          names: tilesets.map((t: any) => t.name).slice(0, 10)
        });
      } catch (tilesetError: any) {
        console.error('[AI_CHAT] Failed to fetch tilesets:', tilesetError);
        logError(tilesetError, 'FETCH_TILESETS');
        // Continue without tilesets - some functions may still work
        tilesets = [];
      }
    }
    
    // Ensure tilesets is always an array (never undefined)
    if (!tilesets) {
      console.warn('[AI_CHAT] Tilesets is undefined, defaulting to empty array');
      tilesets = [];
    }
    // Get environment configuration
    const env = getEnvironment();
    if (!env.OPENAI_API_KEY) {
      throw new ApiError('OpenAI API key not configured', 500, ErrorCode.CONFIGURATION_ERROR);
    }

    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY
    });

    // Build tileset information for the system message
    const tilesetNames = tilesets.map((t: any) => t.name).join(', ');
    const tilesetInfo = tilesets.length > 0 
      ? `\n\nAVAILABLE TILESETS:\n${tilesetNames}\n\nIMPORTANT TILESET MAPPINGS:\n- Water features (lake, pond, river, water) → use "Lake" or "Water Terrain" (they are equivalent)\n- Paths, roads, trails, walkways → use "DirtPath" tileset`
      : '\n\nNote: Tilesets information will be provided when available.';

    // Enhanced system message with board type detection and platformer capabilities
    const systemMessage = {
      role: "system" as const,
      content: `You are an AI assistant for a game development board editor. You help users create game levels, place objects, and design interactive experiences.${tilesetInfo}

BOARD TYPE DETECTION:
Analyze user requests to determine the intended board type:
- **Canvas Board**: General 2D design, shapes, terrain painting, object placement
- **Platformer Board**: Side-scrolling games with physics, platforms, sprites, enemies
- **Puzzle Board**: Grid-based puzzles, logic games, tile matching
- **Strategy Board**: Top-down strategy, unit placement, tactical layouts

ENHANCED CAPABILITIES:

1. **SPRITE MANAGEMENT**:
   - Use createSprite() for individual sprites with physics integration
   - Use placeSprites() for multiple sprites in formations
   - Use animateSprite() to control animations and state machines
   - Available sprite types: knight-demo, platformer-character, enemy-goblin
   - Animation states: idle, walk, run, jump, attack, hurt, die

2. **PHYSICS INTEGRATION**:
   - Use setPlatformPhysics() to configure tile physics properties
   - Material types: solid, platform, bouncy, slippery, hazard
   - Collision types: solid, platform (one-way), trigger
   - Physics properties: mass, friction, restitution, collision detection

3. **PLATFORMER LEVEL GENERATION**:
   - Use createPlatformerLevel() for complete level generation
   - Difficulty levels: easy, medium, hard, expert
   - Themes: forest, cave, castle, sky
   - Sizes: small (30x20), medium (50x30), large (80x40), massive (120x60)
   - Features: moving-platforms, hazards, secrets, checkpoints

4. **BOARD TYPE RECOMMENDATIONS**:
   When users mention:
   - "platformer", "side-scroller", "jumping", "physics" → Use platformer functions
   - "character", "sprite", "animation", "enemy" → Use sprite functions
   - "platform", "collision", "physics", "bounce" → Use physics functions
   - "level", "terrain", "complete game" → Use level generation functions

5. **SPATIAL LANGUAGE INTERPRETATION**:
   - "field" / "area" / "background" → use 'fill' pattern with large area
   - "river" / "winding river" / "stream" / "lake" / "pond" / "water" → use 'winding_path' pattern with high aspect ratio, use "Lake" or "Water Terrain" tileset (they are equivalent)
   - "path" / "road" / "trail" / "dirt path" / "walkway" → use "DirtPath" tileset with appropriate path patterns based on direction
   - "platform" / "ledge" → create elevated terrain with platform physics
   - "hazard" / "spikes" / "lava" → use hazard material type with trigger collision

6. **PHYSICS-AWARE RECOMMENDATIONS**:
   - Suggest physics properties based on context (ice = slippery, trampoline = bouncy)
   - Recommend appropriate collision types (platforms = one-way, walls = solid)
   - Consider sprite physics when placing characters (mass affects gravity)

7. **ANIMATION GUIDANCE**:
   - Suggest appropriate animations based on context (moving = walk, combat = attack)
   - Recommend state machine transitions for interactive behaviors
   - Consider animation loops (idle/walk = loop, jump/attack = no loop)

ENHANCED WORKFLOW:
1. Detect board type from user intent
2. Choose appropriate functions based on detected type
3. Apply physics and animation enhancements when relevant
4. Provide contextual suggestions for game mechanics
5. Ensure proper integration between terrain, physics, and sprites

PLATFORMER PATTERNS:
- Ground + Platforms + Physics = Basic platformer level
- Sprites + Animation + Physics = Interactive characters
- Hazards + Trigger collision = Dangerous obstacles
- Moving platforms + Checkpoints = Advanced level design

Always consider the complete game experience and suggest enhancements that improve gameplay and interactivity!`
    };

    const allMessages = [systemMessage, ...messages];

    // Headers already set above, but ensure they're set if somehow we got here without them
    if (!res.headersSent) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    try {
      // Call OpenAI with streaming and function calling
      console.log('[AI_CHAT] Calling OpenAI API:', {
        messageCount: allMessages.length,
        toolCount: canvasFunctions.length,
        model: "gpt-4o-mini",
        hasApiKey: !!env.OPENAI_API_KEY,
        firstMessagePreview: allMessages[1]?.content?.substring(0, 100) // Skip system message
      });
      
      stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: allMessages,
        tools: canvasFunctions,
        tool_choice: "auto",
        stream: true,
      });
      console.log('[AI_CHAT] OpenAI API call successful, streaming started');
    } catch (error: any) {
      console.error('[AI_CHAT] OpenAI API call failed:', {
        status: error.status,
        statusCode: error.statusCode,
        message: error.message,
        type: error.type,
        code: error.code,
        response: error.response?.data || error.response
      });
      logError(error, 'OPENAI_API_CALL');
      
      // Provide specific error messages based on error type
      if (error.status === 401 || error.statusCode === 401) {
        throw new ApiError(
          'Invalid OpenAI API key. Please check your API key configuration.',
          401,
          ErrorCode.AUTHENTICATION_ERROR,
          { originalError: error.message }
        );
      } else if (error.status === 429 || error.statusCode === 429) {
        throw new ApiError(
          'OpenAI API rate limit exceeded. Please wait a moment and try again.',
          429,
          ErrorCode.RATE_LIMITED,
          { retryAfter: error.response?.headers?.['retry-after'] }
        );
      } else if (error.status >= 500 || (error.statusCode && error.statusCode >= 500)) {
        throw new ApiError(
          'OpenAI service is temporarily unavailable. Please try again later.',
          503,
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { originalError: error.message }
        );
      } else if (error.type === 'insufficient_quota') {
        throw new ApiError(
          'OpenAI API quota exceeded. Please check your account billing.',
          402,
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { originalError: error.message }
        );
      } else {
        throw new ApiError(
          `Failed to communicate with OpenAI: ${error.message || 'Unknown error'}`,
          500,
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          { originalError: error.message, type: error.type }
        );
      }
    }

    let accumulatedContent = '';
    let accumulatedToolCalls: Map<number, { name: string; arguments: string }> = new Map();
    const executionResults: ExecutionResult[] = [];
    let chunkCount = 0;

    try {
      // Process stream chunks
      for await (const chunk of stream) {
        chunkCount++;
        const delta = chunk.choices[0]?.delta;

        // Handle content streaming
        if (delta?.content) {
          accumulatedContent += delta.content;
          // Send content chunk to client
          res.write(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`);
        }

        // Handle tool call streaming
        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;
            const existing = accumulatedToolCalls.get(index) || { name: '', arguments: '' };

            if (toolCallDelta.function?.name) {
              existing.name = toolCallDelta.function.name;
              console.log(`[AI_CHAT] Received tool call ${index}: ${existing.name}`);
            }
            if (toolCallDelta.function?.arguments) {
              existing.arguments += toolCallDelta.function.arguments;
            }

            accumulatedToolCalls.set(index, existing);
          }
        }
      }
      
      console.log('[AI_CHAT] Stream processing completed:', {
        chunkCount,
        contentLength: accumulatedContent.length,
        toolCallCount: accumulatedToolCalls.size,
        accumulatedToolCalls: Array.from(accumulatedToolCalls.entries()).map(([idx, tc]) => ({
          index: idx,
          name: tc.name,
          argsLength: tc.arguments?.length || 0
        }))
      });
    } catch (error: any) {
      console.error('[AI_CHAT] Error processing OpenAI stream:', {
        errorType: error.constructor?.name,
        message: error.message,
        chunkCount: chunkCount || 0,
        accumulatedContentLength: accumulatedContent.length
      });
      logError(error, 'OPENAI_STREAM_PROCESSING');
      throw new ApiError('Failed to process OpenAI response stream', 500, ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    // Execute any function calls
    if (accumulatedToolCalls.size > 0) {
      console.log('[AI_CHAT] Executing tool calls:', {
        count: accumulatedToolCalls.size,
        functions: Array.from(accumulatedToolCalls.values()).map(tc => tc.name)
      });

      for (const [index, toolCall] of accumulatedToolCalls.entries()) {
        const functionName = toolCall.name;
        let result: ExecutionResult;
        
        try {
          console.log(`[AI_CHAT] Executing function ${index}: ${functionName}`, {
            argumentsPreview: toolCall.arguments ? toolCall.arguments.substring(0, 200) : 'No arguments'
          });
        } catch (logError: any) {
          console.error(`[AI_CHAT] Error logging function execution:`, logError);
        }

        try {
          // Validate function call structure
          const validatedToolCall = validateParams(functionExecutionSchema, {
            name: functionName,
            arguments: toolCall.arguments
          });

          // Parse and validate arguments
          let functionArgs: any;
          try {
            functionArgs = JSON.parse(validatedToolCall.arguments);
          } catch (parseError: any) {
            console.error(`[AI_CHAT] Failed to parse function arguments for ${functionName}:`, {
              error: parseError.message,
              argumentsPreview: toolCall.arguments?.substring(0, 200),
              argumentsLength: toolCall.arguments?.length
            });
            logError(parseError, 'FUNCTION_ARGS_PARSE');
            result = {
              success: false,
              message: `Invalid JSON in function arguments for ${functionName}: ${parseError.message}. The function arguments may be malformed or incomplete.`
            };
            executionResults.push(result);
            continue;
          }

          // Ensure tilesets is available before executing functions that need it
          if (!tilesets || !Array.isArray(tilesets)) {
            console.error(`[AI_CHAT] Tilesets is ${tilesets} before executing ${functionName}, initializing empty array`);
            tilesets = [];
          }

          // Execute function based on name
          switch (functionName) {
            case "paintTerrain": {
              const validation = paintTerrainSchema.safeParse(functionArgs);
              if (!validation.success) {
                result = {
                  success: false,
                  message: `Invalid paintTerrain arguments: ${fromZodError(validation.error).message}`
                };
              } else {
                console.log(`[AI_CHAT] Calling executePaintTerrain with tilesets count: ${tilesets?.length || 0}`);
                result = executePaintTerrain(validation.data, canvasState, tileMap, tilesets || []);
              }
              break;
            }
            case "createShapes": {
              const validation = createShapesSchema.safeParse(functionArgs);
              if (!validation.success) {
                result = {
                  success: false,
                  message: `Invalid createShapes arguments: ${fromZodError(validation.error).message}`
                };
              } else {
                result = executeCreateShapes(validation.data, canvasState);
              }
              break;
            }
            case "analyzeCanvas":
              result = executeAnalyzeCanvas(canvasState, tileMap);
              break;
            case "placeObject": {
              const validation = placeObjectSchema.safeParse(functionArgs);
              if (!validation.success) {
                result = {
                  success: false,
                  message: `Invalid placeObject arguments: ${fromZodError(validation.error).message}`
                };
              } else {
                console.log(`[AI_CHAT] Calling executePlaceObject with tilesets count: ${tilesets?.length || 0}`);
                result = executePlaceObject(validation.data, canvasState, tileMap, tilesets || []);
              }
              break;
            }
            case "clearCanvas": {
              try {
                const validation = clearCanvasSchema.safeParse(functionArgs);
                if (!validation.success) {
                  result = {
                    success: false,
                    message: `Invalid clearCanvas arguments: ${fromZodError(validation.error).message}`
                  };
                } else {
                  console.log(`[AI_CHAT] Calling executeClearCanvas with target: ${validation.data.target}`, {
                    canvasStateShapes: canvasState?.shapes?.length || 0,
                    tileMapTiles: tileMap?.tiles?.length || 0
                  });
                  // Ensure we have valid copies of state to avoid mutations
                  const safeCanvasState = {
                    ...canvasState,
                    shapes: canvasState?.shapes ? [...canvasState.shapes] : []
                  };
                  const safeTileMap = {
                    ...tileMap,
                    tiles: tileMap?.tiles ? [...tileMap.tiles] : []
                  };
                  result = executeClearCanvas(validation.data, safeCanvasState, safeTileMap);
                }
              } catch (execError: any) {
                console.error('[AI_CHAT] Error executing clearCanvas:', {
                  errorType: execError.constructor?.name,
                  message: execError.message,
                  stack: execError.stack?.substring(0, 500)
                });
                logError(execError, 'EXECUTE_CLEAR_CANVAS');
                result = {
                  success: false,
                  message: `Failed to execute clearCanvas: ${execError.message || 'Unknown error'}`
                };
              }
              break;
            }
            case "placeSprites":
              try {
                result = executePlaceSprites(functionArgs, canvasState);
              } catch (execError: any) {
                logError(execError, 'EXECUTE_PLACE_SPRITES');
                result = {
                  success: false,
                  message: `Failed to execute placeSprites: ${execError.message}`
                };
              }
              break;
            case "createSprite":
              try {
                result = executeCreateSprite(functionArgs, canvasState);
              } catch (execError: any) {
                logError(execError, 'EXECUTE_CREATE_SPRITE');
                result = {
                  success: false,
                  message: `Failed to execute createSprite: ${execError.message}`
                };
              }
              break;
            case "setPlatformPhysics":
              try {
                result = executeSetPhysics(functionArgs, canvasState, tileMap);
              } catch (execError: any) {
                logError(execError, 'EXECUTE_SET_PHYSICS');
                result = {
                  success: false,
                  message: `Failed to execute setPlatformPhysics: ${execError.message}`
                };
              }
              break;
            case "createPlatformerLevel":
              try {
                console.log(`[AI_CHAT] Calling executePlatformerTerrain with tilesets count: ${tilesets?.length || 0}`);
                result = executePlatformerTerrain(functionArgs, canvasState, tileMap, tilesets || []);
              } catch (execError: any) {
                logError(execError, 'EXECUTE_PLATFORMER_TERRAIN');
                result = {
                  success: false,
                  message: `Failed to execute createPlatformerLevel: ${execError.message}`
                };
              }
              break;
            case "animateSprite":
              try {
                result = executeAnimateSprite(functionArgs, canvasState);
              } catch (execError: any) {
                logError(execError, 'EXECUTE_ANIMATE_SPRITE');
                result = {
                  success: false,
                  message: `Failed to execute animateSprite: ${execError.message}`
                };
              }
              break;
            default:
              result = {
                success: false,
                message: `Unknown function: ${functionName}`
              };
              logError(new Error(`Unknown function called: ${functionName}`), 'UNKNOWN_FUNCTION');
          }
        } catch (functionError: any) {
          console.error(`[AI_CHAT] Error in function execution wrapper for ${functionName}:`, {
            errorType: functionError.constructor?.name,
            message: functionError.message,
            stack: functionError.stack?.substring(0, 500),
            functionName,
            argumentsPreview: toolCall.arguments?.substring(0, 100)
          });
          logError(functionError, 'FUNCTION_EXECUTION');
          
          // Create more actionable error message
          let errorMessage = `Function execution failed: ${functionError?.message || 'Unknown error'}`;
          
          // Provide specific guidance for common errors
          if (functionError.message?.includes('tileset') || functionError.message?.includes('Tileset')) {
            errorMessage += '. Please ensure the tileset exists and is available.';
          } else if (functionError.message?.includes('undefined') || functionError.message?.includes('null')) {
            errorMessage += '. Required data may be missing. Please check your request.';
          } else if (functionError.message?.includes('parse') || functionError.message?.includes('JSON')) {
            errorMessage += '. Invalid function arguments format.';
          }
          
          result = {
            success: false,
            message: errorMessage
          };
        }

        // Ensure result is always defined
        if (!result) {
          console.error(`[AI_CHAT] Result is undefined for function ${functionName}, creating error result`);
          result = {
            success: false,
            message: `Function ${functionName} did not return a result`
          };
        }

        // Ensure result.message exists
        if (!result.message) {
          console.warn(`[AI_CHAT] Result message is missing for ${functionName}, adding default`);
          result.message = result.success 
            ? `Function ${functionName} executed successfully` 
            : `Function ${functionName} failed`;
        }

        try {
          console.log(`[AI_CHAT] Function ${functionName} result:`, {
            success: result.success,
            messagePreview: result.message.substring(0, 100),
            hasCanvasUpdates: !!result.canvasUpdates,
            requiresConfirmation: result.requiresConfirmation || false
          });
        } catch (logError: any) {
          console.error(`[AI_CHAT] Error logging result for ${functionName}:`, logError);
        }

        executionResults.push(result);
      }

      // Send execution results
      const successCount = executionResults.filter(r => r.success).length;
      const failureCount = executionResults.filter(r => !r.success).length;
      
      console.log('[AI_CHAT] Sending execution results:', {
        resultCount: executionResults.length,
        successCount,
        failureCount,
        failures: executionResults.filter(r => !r.success).map(r => ({
          message: r.message?.substring(0, 100),
          requiresConfirmation: r.requiresConfirmation
        }))
      });

      // Send execution results - distinguish between failures and errors
      res.write(`data: ${JSON.stringify({ 
        type: 'execution', 
        results: executionResults,
        toolCalls: Array.from(accumulatedToolCalls.values()),
        summary: {
          total: executionResults.length,
          successful: successCount,
          failed: failureCount
        }
      })}\n\n`);

      // Get final response from AI after function execution
      try {
        const functionMessages = Array.from(accumulatedToolCalls.entries()).map(([index, toolCall]) => ({
          role: "tool" as const,
          tool_call_id: `call_${index}`,
          content: executionResults[index]?.message || 'Function executed'
        }));

        const finalStream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [...allMessages, {
            role: "assistant" as const,
            content: accumulatedContent || null,
            tool_calls: Array.from(accumulatedToolCalls.entries()).map(([index, tc]) => ({
              id: `call_${index}`,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments }
            }))
          }, ...functionMessages],
          stream: true
        });

        // Stream final response
        for await (const chunk of finalStream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            res.write(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`);
          }
        }
      } catch (finalStreamError: any) {
        logError(finalStreamError, 'FINAL_STREAM_ERROR');
        // Continue without final response if this fails
        res.write(`data: ${JSON.stringify({ 
          type: 'warning', 
          message: 'Function executed but final response unavailable' 
        })}\n\n`);
      }
    }

    // Send done signal
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('[AI_CHAT] Top-level error caught:', {
      errorType: error.constructor.name,
      message: error.message,
      isApiError: error instanceof ApiError,
      headersSent: res.headersSent
    });

    // Check if response has already been started (SSE headers sent)
    if (res.headersSent) {
      // Response is already streaming, send error via SSE
      try {
        console.error('[AI_CHAT] Sending error via SSE stream:', {
          errorType: error.constructor?.name,
          message: error.message,
          isApiError: error instanceof ApiError
        });
        
        if (error instanceof ApiError) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message,
            details: error.details,
            code: error.code,
            statusCode: error.statusCode,
            timestamp: new Date().toISOString()
          })}\n\n`);
        } else {
          // Log unexpected errors with more detail
          logError(error, 'AI_CHAT_UNEXPECTED_ERROR');
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'An unexpected error occurred during AI chat processing',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: ErrorCode.INTERNAL_ERROR,
            timestamp: new Date().toISOString()
          })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      } catch (writeError: any) {
        console.error('[AI_CHAT] Error writing to SSE stream:', {
          error: writeError.message,
          originalError: error.message,
          headersSent: res.headersSent
        });
        // Response might already be closed, just log and exit
        try {
          res.end();
        } catch {
          // Ignore - response is already closed
        }
      }
    } else {
      // Headers not sent yet, can send regular JSON error response
      // But we need to prevent the asyncHandler from also trying to send an error
      // So we'll handle it here and not re-throw
      const apiError = error instanceof ApiError 
        ? error 
        : new ApiError('An unexpected error occurred during AI chat processing', 500, ErrorCode.INTERNAL_ERROR);
      
      logError(apiError, 'AI_CHAT_ERROR_BEFORE_STREAM');
      
      // Send JSON error response with detailed information
      // Double-check headers haven't been sent (defensive)
      if (!res.headersSent) {
        res.status(apiError.statusCode).json({
          error: apiError.message,
          code: apiError.code,
          details: apiError.details,
          timestamp: new Date().toISOString(),
          // Include helpful context in development
          ...(process.env.NODE_ENV === 'development' && {
            stack: apiError.stack?.substring(0, 500)
          })
        });
      } else {
        // Headers already sent - this shouldn't happen, but log it
        console.error('[AI_CHAT] Attempted to send error response but headers already sent:', {
          error: apiError.message,
          code: apiError.code
        });
        // Try to close the connection
        try {
          res.end();
        } catch (e) {
          // Ignore - response might already be closed
        }
      }
    }
  }
});
