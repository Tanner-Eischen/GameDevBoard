import type { Request, Response } from "express";
import { openai } from "./openai";
import { canvasFunctions } from "./functions";
import {
  executePaintTerrain,
  executeCreateShapes,
  executeAnalyzeCanvas,
  executeClearCanvas,
  executePlaceObject,
  executePlaceSprites,
  type ExecutionResult
} from "./executor";
import type { CanvasState, TileMap } from "@shared/schema";
import { storage } from "../storage";
import {
  paintTerrainSchema,
  createShapesSchema,
  clearCanvasSchema,
  placeObjectSchema
} from "./validation";
import { fromZodError } from "zod-validation-error";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  canvasState: CanvasState;
  tileMap: TileMap;
}

export async function handleAiChat(req: Request, res: Response) {
  try {
    const { messages, canvasState, tileMap } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array" });
    }

    // Get all tilesets for function execution
    const tilesets = await storage.getAllTilesets();

    // Add system message with context
    const systemMessage = {
      role: "system" as const,
      content: `You are a helpful AI assistant for a collaborative game development board. You help users create maps by interpreting their natural language descriptions and translating them into precise geometric parameters.

Current canvas state:
- ${canvasState.shapes.length} shapes on canvas
- ${tileMap.tiles.length} tiles painted
- Grid size: ${canvasState.gridSize}px
- Zoom level: ${canvasState.zoom}x
- Available tilesets: ${tilesets.map(t => t.name).join(", ")}

SPATIAL LANGUAGE INTERPRETATION RULES:

1. GEOMETRIC CONCEPTS:
   - "winding" / "meandering" / "snaking" / "curvy" → use winding_path pattern with curveIntensity 0.4-0.5
   - "straight" / "direct" → use horizontal_path, vertical_path, or diagonal_path
   - "narrow" / "thin" → pathWidth 2-4 tiles
   - "wide" / "broad" / "thick" → pathWidth 6-10 tiles
   - "gentle curves" → curveIntensity 0.2-0.3
   - "sharp turns" / "dramatic curves" → curveIntensity 0.5-0.7

2. ASPECT RATIO UNDERSTANDING:
   - "river" / "stream" → HIGH aspect ratio (one dimension 3-5x larger than the other)
   - "field" / "area" / "region" → square or moderate aspect ratio
   - "path" / "road" / "trail" → high aspect ratio based on direction
   - "through" / "across" → feature spans the FULL dimension of the area
   
   EXAMPLES:
   - "grass field with river winding through it" →
     * Grass: area { x: 0, y: 0, width: 40, height: 30 }, pattern: "fill"
     * Water: area { x: 0, y: 5, width: 40, height: 12 }, pattern: "winding_path", pathWidth: 4, curveIntensity: 0.4
   
   - "narrow path cutting diagonally across" →
     * area { x: 0, y: 0, width: 30, height: 30 }, pattern: "diagonal_path", pathWidth: 2

3. DIRECTIONAL LANGUAGE:
   - "horizontal" / "left to right" / "east-west" → horizontal_path or high width, low height
   - "vertical" / "top to bottom" / "north-south" → vertical_path or low width, high height
   - "diagonal" / "corner to corner" → diagonal_path with equal width and height
   - "across" → analyze context to determine primary direction

4. FEATURE COMPOSITION:
   - When multiple features requested (e.g., "grass field with river"), create MULTIPLE function calls:
     1. First call: Paint the base/background (grass field with "fill")
     2. Second call: Add the feature on top (river with "winding_path")
   - Ensure features have appropriate spatial relationships (river should fit within/across the field)

5. SIZE INTERPRETATION:
   - "small" → 10-20 tiles
   - "medium" → 20-40 tiles  
   - "large" → 40-80 tiles
   - "huge" / "massive" → 80+ tiles

ALWAYS think about:
- What is the main feature? (background vs foreground)
- What aspect ratio makes sense? (river = long & narrow, field = wide & moderate)
- How should it curve? (winding = high intensity, gentle = low intensity)
- How wide should it be? (narrow = 2-4 tiles, wide = 6-10 tiles)

Be precise with your parameters to match the user's spatial intent!`
    };

    const allMessages = [systemMessage, ...messages];

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Call OpenAI with streaming and function calling
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: allMessages,
      tools: canvasFunctions,
      tool_choice: "auto",
      stream: true,
    });

    let accumulatedContent = '';
    let accumulatedToolCalls: Map<number, { name: string; arguments: string }> = new Map();
    const executionResults: ExecutionResult[] = [];

    // Process stream chunks
    for await (const chunk of stream) {
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
          }
          if (toolCallDelta.function?.arguments) {
            existing.arguments += toolCallDelta.function.arguments;
          }

          accumulatedToolCalls.set(index, existing);
        }
      }
    }

    // Execute any function calls
    if (accumulatedToolCalls.size > 0) {
      for (const [index, toolCall] of accumulatedToolCalls.entries()) {
        const functionName = toolCall.name;
        let result: ExecutionResult;

        try {
          // Parse and validate arguments
          const functionArgs = JSON.parse(toolCall.arguments);

          switch (functionName) {
            case "paintTerrain": {
              const validation = paintTerrainSchema.safeParse(functionArgs);
              if (!validation.success) {
                result = {
                  success: false,
                  message: `Invalid arguments: ${fromZodError(validation.error).message}`
                };
              } else {
                result = executePaintTerrain(validation.data, canvasState, tileMap, tilesets);
              }
              break;
            }
            case "createShapes": {
              const validation = createShapesSchema.safeParse(functionArgs);
              if (!validation.success) {
                result = {
                  success: false,
                  message: `Invalid arguments: ${fromZodError(validation.error).message}`
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
                  message: `Invalid arguments: ${fromZodError(validation.error).message}`
                };
              } else {
                result = executePlaceObject(validation.data, canvasState, tileMap, tilesets);
              }
              break;
            }
            case "clearCanvas": {
              const validation = clearCanvasSchema.safeParse(functionArgs);
              if (!validation.success) {
                result = {
                  success: false,
                  message: `Invalid arguments: ${fromZodError(validation.error).message}`
                };
              } else {
                result = executeClearCanvas(validation.data, canvasState, tileMap);
              }
              break;
            }
            case "placeSprites":
              result = executePlaceSprites(functionArgs, canvasState);
              break;
            default:
              result = {
                success: false,
                message: `Unknown function: ${functionName}`
              };
          }
        } catch (parseError: any) {
          result = {
            success: false,
            message: `Failed to parse function arguments: ${parseError.message}`
          };
        }

        executionResults.push(result);
      }

      // Send execution results
      res.write(`data: ${JSON.stringify({ 
        type: 'execution', 
        results: executionResults,
        toolCalls: Array.from(accumulatedToolCalls.values())
      })}\n\n`);

      // Get final response from AI after function execution
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
    }

    // Send done signal
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error("AI Chat error:", error);
    // Send error through SSE
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: 'AI chat failed', 
      details: error.message 
    })}\n\n`);
    res.end();
  }
}
