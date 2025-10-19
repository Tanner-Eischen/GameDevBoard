import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatResponse {
  message: string;
  executionResults: Array<{
    success: boolean;
    message: string;
    canvasUpdates?: {
      shapes?: any[];
      tiles?: any[];
    };
  }>;
  toolCalls: Array<{
    function: string;
    arguments: any;
  }>;
}

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { shapes, tiles, addShape, addTiles, clearShapes, clearTiles, zoom, pan, gridSize, gridVisible, snapToGrid, tool, selectedIds } = useCanvasStore();

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
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

      const res = await apiRequest('POST', '/api/ai/chat', {
        messages: [...messages, { role: 'user', content: userMessage }],
        canvasState,
        tileMap
      });
      
      return await res.json() as AiChatResponse;
    },
    onSuccess: (data) => {
      // Apply canvas updates from AI
      if (data.executionResults) {
        data.executionResults.forEach(result => {
          if (result.success && result.canvasUpdates) {
            if (result.canvasUpdates.shapes) {
              result.canvasUpdates.shapes.forEach(shape => addShape(shape));
            }
            if (result.canvasUpdates.tiles) {
              addTiles(result.canvasUpdates.tiles);
            }
            // Handle clear operations
            if (result.canvasUpdates.shapes && result.canvasUpdates.shapes.length === 0) {
              clearShapes();
            }
            if (result.canvasUpdates.tiles && result.canvasUpdates.tiles.length === 0) {
              clearTiles();
            }
          }
        });
      }

      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
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
    </div>
  );
}
