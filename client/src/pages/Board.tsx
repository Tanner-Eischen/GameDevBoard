import { useEffect, useRef } from 'react';
import { Canvas } from '@/components/Canvas';
import { Toolbar } from '@/components/Toolbar';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { LayersPanel } from '@/components/LayersPanel';
import { TilesetPanel } from '@/components/TilesetPanel';
import { SpritePanel } from '@/components/SpritePanel';
import { UserPresence } from '@/components/UserPresence';
import { ProjectManager } from '@/components/ProjectManager';
import { AiChat } from '@/components/AiChat';
import { useCanvasStore } from '@/store/useCanvasStore';
import { getCollaborationService } from '@/services/collaboration';
import { v4 as uuidv4 } from 'uuid';

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
  const { setCurrentUser, setTool, undo, redo, setCurrentProject, currentProjectId, tiles, shapes } = useCanvasStore();
  const collaborationRef = useRef<ReturnType<typeof getCollaborationService> | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize current user
    const userId = uuidv4();
    const userName = `User ${Math.floor(Math.random() * 1000)}`;
    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

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
    collaborationRef.current.connect();
    
    // Make collaboration service globally available for store to use
    (window as any).__collaborationService = collaborationRef.current;
    
    // Auto-load last project from localStorage
    const savedProjectId = localStorage.getItem('currentProjectId');
    const savedProjectName = localStorage.getItem('currentProjectName');
    if (savedProjectId && savedProjectName) {
      setCurrentProject(savedProjectId, savedProjectName);
      
      // Fetch and load the project
      fetch(`/api/projects/${savedProjectId}`)
        .then(res => res.json())
        .then(project => {
          useCanvasStore.setState({
            shapes: project.canvasState.shapes,
            tiles: project.tileMap.tiles,
            zoom: project.canvasState.zoom,
            pan: project.canvasState.pan,
            gridSize: project.canvasState.gridSize,
          });
          
          // Sync loaded data to collaboration document
          if ((window as any).__collaborationService) {
            (window as any).__collaborationService.syncFromLocal();
          }
        })
        .catch(err => {
          console.error('Failed to auto-load project:', err);
          // Clear invalid project from localStorage
          localStorage.removeItem('currentProjectId');
          localStorage.removeItem('currentProjectName');
        });
    }

    return () => {
      if (collaborationRef.current) {
        collaborationRef.current.disconnect();
        (window as any).__collaborationService = null;
      }
    };
  }, [setCurrentUser, setCurrentProject]);

  // Auto-save when tiles or shapes change
  useEffect(() => {
    if (!currentProjectId) return;
    
    // Debounce auto-save to avoid too many requests
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      const state = useCanvasStore.getState();
      const canvasState = {
        shapes: state.shapes,
        selectedIds: [],
        tool: 'select' as const,
        zoom: state.zoom,
        pan: state.pan,
        gridSize: state.gridSize,
        gridVisible: true,
        snapToGrid: false,
      };

      const tileMap = {
        gridSize: state.gridSize,
        tiles: state.tiles,
      };

      try {
        await fetch(`/api/projects/${currentProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canvasState, tileMap }),
          credentials: 'include',
        });
        console.log('Auto-saved project');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 1000); // Wait 1 second after last change before saving

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [tiles, shapes, currentProjectId]);

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
          if (!e.ctrlKey && !e.metaKey) {
            setTool('tile-erase');
          }
          break;
        case 'x':
          setTool('sprite');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo]);

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-card-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold" data-testid="text-app-title">
            Game Dev Board
          </h1>
          <span className="text-sm text-muted-foreground">
            {useCanvasStore.getState().currentProjectName}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <ProjectManager />
          <UserPresence />
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-card border-r border-card-border overflow-auto">
          <div className="p-4 space-y-4">
            <LayersPanel />
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1">
          <Canvas />
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 bg-card border-l border-card-border overflow-auto">
          <div className="p-4 space-y-4">
            <PropertiesPanel />
            <TilesetPanel />
            <SpritePanel />
          </div>
        </aside>
      </div>

      {/* AI Chat - Floating */}
      <AiChat />
    </div>
  );
}
