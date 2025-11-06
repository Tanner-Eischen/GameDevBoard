import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import { Toolbar } from '@/components/Toolbar';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { LayersPanel } from '@/components/LayersPanel';
import { TilesetPanel } from '@/components/TilesetPanel';
import { SpritePanel } from '@/components/SpritePanel';
import { UserPresence } from '@/components/UserPresence';
import { ProjectManager } from '@/components/ProjectManager';
import { BoardManager } from '@/components/BoardManager';
import { AiChat } from '@/components/AiChat';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getCollaborationService } from '@/services/collaboration';
import { LayerVisibilityProvider } from '@/contexts/LayerVisibilityContext';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { PanelLeft, PanelRight, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const USER_COLORS = [
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(271 81% 56%)',
  'hsl(168 76% 42%)',
  'hsl(24 94% 50%)',
  'hsl(291 64% 42%)',
  'hsl(199 89% 48%)',
];

export default function Board() {
  const { 
    setCurrentUser, 
    setTool, 
    undo, 
    redo,
    clearCanvas
  } = useCanvasStore();
  
  const { logout } = useAuth();
  const collaborationRef = useRef<ReturnType<typeof getCollaborationService> | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Initialize user and collaboration on mount
  useEffect(() => {
    // Clear the canvas to ensure it's blank
    clearCanvas();
    
    // Initialize current user with persistence
    let userId = localStorage.getItem('user_id');
    let userName = localStorage.getItem('user_name');
    let userColor = localStorage.getItem('user_color');

    // Generate new user identity only if not already stored
    if (!userId || !userName || !userColor) {
      userId = uuidv4();
      userName = `User ${Math.floor(Math.random() * 1000)}`;
      userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
      
      // Store in localStorage for persistence
      localStorage.setItem('user_id', userId);
      localStorage.setItem('user_name', userName);
      localStorage.setItem('user_color', userColor);
    }

    setCurrentUser({
      id: userId,
      name: userName,
      color: userColor,
      cursor: null,
      selection: [],
      tool: 'select',
    });

    // Initialize collaboration service
    const roomId = new URLSearchParams(window.location.search).get('room') || 'default';
    collaborationRef.current = getCollaborationService(roomId);
    
    // Get auth token from localStorage and connect
    const authToken = localStorage.getItem('auth_token');
    collaborationRef.current.connect(authToken || undefined);
    
    // Make collaboration service globally available for store to use
    (window as any).__collaborationService = collaborationRef.current;

    return () => {
      console.log('Board.tsx: Cleanup function called - disconnecting collaboration service');
      if (collaborationRef.current) {
        collaborationRef.current.disconnect();
        (window as any).__collaborationService = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key === 'z') {
          e.preventDefault();
          redo();
        } else if (e.key === 'z') {
          e.preventDefault();
          undo();
        }
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 'h':
          setTool('pan');
          break;
        case 'r':
          setTool('rectangle');
          break;
        case 'c':
          setTool('circle');
          break;
        case 'p':
          setTool('polygon');
          break;
        case 's':
          setTool('star');
          break;
        case 'l':
          setTool('line');
          break;
        case 't':
          setTool('tile-paint');
          break;
        case 'e':
          setTool('tile-erase');
          break;
        case 'g':
          setTool('sprite');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo]);

  // Always render the blank board interface
  return (
    <LayerVisibilityProvider>
      <div data-testid="main-board" className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden">
        {/* Top Toolbar - Full Width */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <BoardManager />
            <ProjectManager />
          </div>
          
          {/* Horizontal Toolbar with drawing tools only */}
          <div className="flex-1 flex justify-center max-w-none overflow-hidden">
            <div className="flex items-center justify-center">
              <Toolbar />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <UserPresence />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main content - canvas fills entire area, panels overlay */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {/* Canvas fills container */}
          <div className="absolute inset-0">
            <Canvas />
          </div>

          {/* Left overlay panel */}
          <div
            className={cn(
              "absolute left-0 top-0 h-full bg-gray-800 border-r border-gray-700 transition-all duration-200",
              leftPanelOpen ? "w-80 opacity-100 pointer-events-auto" : "w-80 opacity-0 pointer-events-none"
            )}
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <PropertiesPanel />
                <LayersPanel />
              </div>
            </div>
          </div>

          {/* Right overlay panel */}
          <div
            className={cn(
              "absolute right-0 top-0 h-full bg-gray-800 border-l border-gray-700 transition-all duration-200",
              rightPanelOpen ? "w-80 opacity-100 pointer-events-auto" : "w-80 opacity-0 pointer-events-none"
            )}
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <TilesetPanel />
                <SpritePanel />
              </div>
              <div className="flex-1">
                <AiChat />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LayerVisibilityProvider>
  );
}
