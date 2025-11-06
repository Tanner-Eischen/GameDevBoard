import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, X, AlertTriangle } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExecutionResult {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  canvasUpdates?: {
    shapes?: any[];
    tiles?: any[];
  };
}

interface AiChatResponse {
  message: string;
  executionResults: ExecutionResult[];
  toolCalls: Array<{
    function: string;
    arguments: any;
  }>;
}

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    results: ExecutionResult[];
    aiMessage: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { shapes, tiles, addShape, addTiles, clearShapes, clearTiles, zoom, pan, gridSize, gridVisible, snapToGrid, tool, selectedIds } = useCanvasStore();

  // Helper to apply canvas updates
  const applyCanvasUpdates = (results: ExecutionResult[]) => {
    results.forEach(result => {
      if (result.success && result.canvasUpdates) {
        if (result.canvasUpdates.shapes !== undefined) {
          if (result.canvasUpdates.shapes.length === 0) {
            clearShapes();
          } else {
            result.canvasUpdates.shapes.forEach(shape => addShape(shape));
          }
        }
        if (result.canvasUpdates.tiles !== undefined) {
          if (result.canvasUpdates.tiles.length === 0) {
            clearTiles();
          } else {
            addTiles(result.canvasUpdates.tiles);
          }
        }
      }
    });
  };

  const handleConfirm = () => {
    if (pendingConfirmation) {
      applyCanvasUpdates(pendingConfirmation.results);
      setMessages(prev => [...prev, { role: 'assistant', content: pendingConfirmation.aiMessage }]);
      setPendingConfirmation(null);
    }
  };

  const handleCancel = () => {
    if (pendingConfirmation) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Action cancelled. Your canvas remains unchanged.' 
      }]);
      setPendingConfirmation(null);
    }
  };

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const token = localStorage.getItem('auth_token');
      
      // Check if user is authenticated before making request
      if (!token) {
        throw new Error('You must be logged in to use AI chat. Please sign in first.');
      }

      // Limit conversation history to last 20 messages to avoid exceeding server's 50-message limit
      const maxHistoryMessages = 20;
      let messagesToSend = messages.length > maxHistoryMessages 
        ? messages.slice(-maxHistoryMessages)
        : messages;
      
      // Filter out empty messages (like the loading placeholder) from the request
      messagesToSend = messagesToSend.filter(msg => msg.content.trim().length > 0);
      
      // Remove duplicate consecutive messages (same role and content)
      messagesToSend = messagesToSend.filter((msg, index) => {
        if (index === 0) return true;
        const prev = messagesToSend[index - 1];
        return !(prev.role === msg.role && prev.content === msg.content);
      });
      
      // Ensure we have at least one valid message
      if (messagesToSend.length === 0 && !userMessage.trim()) {
        throw new Error('Cannot send empty message');
      }
      
      // Remove duplicate if the new user message is the same as the last message
      const lastMessage = messagesToSend[messagesToSend.length - 1];
      if (lastMessage && lastMessage.role === 'user' && lastMessage.content === userMessage) {
        messagesToSend = messagesToSend.slice(0, -1);
      }

      const canvasState = {
        shapes,
        selectedIds,
        tool,
        zoom,
        pan,
        gridSize,
        gridVisible,
        snapToGrid
      };
      
      const tileMap = {
        gridSize,
        tiles
      };

      const requestPayload = {
        messages: [...messagesToSend, { role: 'user', content: userMessage }],
        canvasState,
        tileMap
      };

      console.log('Sending AI chat request:', JSON.stringify(requestPayload, null, 2));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestPayload),
        credentials: 'include'
      });

      if (response.status === 401) {
        throw new Error('Unauthorized: Your session may have expired. Please sign in again.');
      }

      if (response.status === 404) {
        throw new Error('AI chat service not found. Please check your server configuration.');
      }

      if (!response.ok) {
        // Try to get error details from response
        try {
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          
          // Try to parse as JSON
          try {
            const errorData = JSON.parse(errorText);
            const errorMessage = errorData.error || errorData.message || response.statusText;
            throw new Error(`HTTP ${response.status}: ${errorMessage}`);
          } catch (parseError) {
            // If not JSON, use raw text
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
          }
        } catch (readError) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let accumulatedMessage = '';
      let executionResults: ExecutionResult[] = [];
      let buffer = ''; // Buffer for incomplete SSE frames

      // Add assistant message placeholder
      const assistantMessageIndex = messagesToSend.length + 1;
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append chunk to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'content') {
                accumulatedMessage += data.content;
                // Update message in real-time
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    role: 'assistant',
                    content: accumulatedMessage
                  };
                  return newMessages;
                });
              } else if (data.type === 'execution') {
                const results = data.results || [];
                const summary = data.summary || {};
                const successCount = summary.successful ?? results.filter((r: ExecutionResult) => r.success).length;
                const failureCount = summary.failed ?? results.filter((r: ExecutionResult) => !r.success).length;
                
                console.log('[AI_CHAT_CLIENT] Received execution results:', {
                  resultCount: results.length,
                  successCount,
                  failureCount,
                  summary
                });
                
                // Log detailed error messages for failed executions
                results.forEach((result: ExecutionResult, index: number) => {
                  if (!result.success) {
                    console.error(`[AI_CHAT_CLIENT] Execution ${index} failed:`, {
                      message: result.message,
                      requiresConfirmation: result.requiresConfirmation,
                      hasCanvasUpdates: !!result.canvasUpdates
                    });
                  } else {
                    console.log(`[AI_CHAT_CLIENT] Execution ${index} succeeded:`, {
                      message: result.message?.substring(0, 100),
                      hasCanvasUpdates: !!result.canvasUpdates,
                      requiresConfirmation: result.requiresConfirmation
                    });
                  }
                });
                
                executionResults = results;
              } else if (data.type === 'error') {
                console.error('[AI_CHAT_CLIENT] Received error from server:', {
                  error: data.error || data.details,
                  code: data.code,
                  statusCode: data.statusCode,
                  type: data.type
                });
                // This is a fatal error (not an execution failure), throw it
                throw new Error(data.details || data.error || 'An error occurred during AI chat processing');
              } else if (data.type === 'warning') {
                console.warn('[AI_CHAT_CLIENT] Received warning from server:', data.message);
                // Warnings are non-fatal, log but continue
              }
            } catch (parseError) {
              // Skip malformed JSON
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

      return {
        message: accumulatedMessage,
        executionResults,
        toolCalls: []
      };
    },
    onSuccess: (data) => {
      // Check for execution failures vs successes
      const failures = data.executionResults.filter(r => !r.success);
      const successes = data.executionResults.filter(r => r.success);
      
      // If there are failures, append error messages to the AI response
      // But only if there are actual failures (not just warnings)
      if (failures.length > 0) {
        const errorMessages = failures
          .map(f => f.message)
          .filter(msg => msg && msg.trim().length > 0)
          .join('\n');
        
        if (errorMessages) {
          // Only append if we have actual error messages
          const updatedMessage = data.message + 
            (data.message.trim() ? '\n\n' : '') + 
            `⚠️ Some operations failed:\n${errorMessages}`;
          
          // Update the last assistant message with error details
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            if (lastIndex >= 0 && newMessages[lastIndex].role === 'assistant') {
              newMessages[lastIndex] = {
                role: 'assistant',
                content: updatedMessage
              };
            }
            return newMessages;
          });
          
          console.error('[AI_CHAT_CLIENT] Execution failures detected:', {
            failureCount: failures.length,
            errors: failures.map(f => f.message)
          });
        }
      }
      
      // Check if any results require confirmation
      const needsConfirmation = data.executionResults.some(r => r.requiresConfirmation);
      
      if (needsConfirmation) {
        // Hold updates pending user confirmation
        setPendingConfirmation({
          results: data.executionResults,
          aiMessage: data.message
        });
      } else if (successes.length > 0) {
        // Only apply canvas updates for successful executions
        applyCanvasUpdates(successes);
      }
    },
    onError: (error: any) => {
      const message = error?.message || 'Something went wrong while contacting the AI.';
      setMessages(prev => [...prev, { role: 'assistant', content: message }]);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Send to AI
    chatMutation.mutate(userMessage);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isOpen) {
    return (
      <Button
        data-testid="button-ai-chat-toggle"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg"
        size="icon"
        variant="default"
      >
        <Sparkles className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-card border border-border rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <Button
          data-testid="button-ai-chat-close"
          onClick={() => setIsOpen(false)}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Hi! I can help you create maps and designs.</p>
            <p className="text-xs mt-2">Try: "Paint a grass field" or "Create 5 stars"</p>
          </div>
        )}
        
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            data-testid="input-ai-chat"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to create something..."
            className="flex-1"
            disabled={chatMutation.isPending}
          />
          <Button
            data-testid="button-ai-chat-send"
            type="submit"
            size="icon"
            disabled={!input.trim() || chatMutation.isPending}
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingConfirmation} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirmation?.results.find(r => r.requiresConfirmation)?.confirmationPrompt || 
                'This action will modify your canvas. Are you sure?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel" onClick={handleCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-proceed" onClick={handleConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
