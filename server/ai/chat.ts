import type { Request, Response } from "express";
import { openai } from "./openai";
import { canvasFunctions } from "./functions";
import {
  executePaintTerrain,
  executeCreateShapes,
  executeAnalyzeCanvas,
  executeClearCanvas,
  type ExecutionResult
} from "./executor";
import type { CanvasState, TileMap } from "@shared/schema";
import { storage } from "../storage";

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
      content: `You are a helpful AI assistant for a collaborative game development board. You can help users create maps and designs by painting terrain, creating shapes, and providing suggestions.
      
Current canvas state:
- ${canvasState.shapes.length} shapes on canvas
- ${tileMap.tiles.length} tiles painted
- Grid size: ${canvasState.gridSize}px
- Zoom level: ${canvasState.zoom}x

Available tilesets: ${tilesets.map(t => t.name).join(", ")}

When users ask to create or paint something, use the available functions to execute their requests. Be creative and helpful!`
    };

    const allMessages = [systemMessage, ...messages];

    // Call OpenAI with function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: allMessages,
      tools: canvasFunctions,
      tool_choice: "auto",
    });

    const responseMessage = response.choices[0].message;
    const executionResults: ExecutionResult[] = [];

    // Execute any function calls
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        let result: ExecutionResult;

        switch (functionName) {
          case "paintTerrain":
            result = executePaintTerrain(functionArgs, canvasState, tileMap, tilesets);
            break;
          case "createShapes":
            result = executeCreateShapes(functionArgs, canvasState);
            break;
          case "analyzeCanvas":
            result = executeAnalyzeCanvas(canvasState, tileMap);
            break;
          case "clearCanvas":
            result = executeClearCanvas(functionArgs, canvasState, tileMap);
            break;
          default:
            result = {
              success: false,
              message: `Unknown function: ${functionName}`
            };
        }

        executionResults.push(result);
      }

      // Get final response from AI after function execution
      const functionMessages = responseMessage.tool_calls.map((toolCall, index) => ({
        role: "tool" as const,
        tool_call_id: toolCall.id,
        content: executionResults[index].message
      }));

      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [...allMessages, responseMessage, ...functionMessages]
      });

      const finalMessage = finalResponse.choices[0].message;

      return res.json({
        message: finalMessage.content,
        executionResults,
        toolCalls: responseMessage.tool_calls
          .filter(tc => tc.type === 'function')
          .map(tc => ({
            function: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
      });
    }

    // No function calls, just return the response
    return res.json({
      message: responseMessage.content,
      executionResults: [],
      toolCalls: []
    });

  } catch (error: any) {
    console.error("AI Chat error:", error);
    return res.status(500).json({ 
      error: "AI chat failed", 
      details: error.message 
    });
  }
}
