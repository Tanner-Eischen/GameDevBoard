import { create } from 'zustand';
import type { 
  Shape, 
  ToolType, 
  CanvasState, 
  UserPresence, 
  Tile, 
  Tileset, 
  SpriteInstance, 
  SpriteDefinition, 
  AnimationState, 
  BoardData, 
  BoardType, 
  PhysicsConfig,
  Timeline,
  TimelineTrack,
  TimelineKeyframe,
  StateMachine,
  AdvancedAnimation,
  SpritesheetData,
  GodotProject,
  GodotLayer
} from '@shared/schema';
import type { GodotProjectConfig } from '@/types/godot';
import { v4 as uuidv4 } from 'uuid';
import { initializeDemoSprites } from '@/utils/demoSprites';

// Debounce utility for frequent history updates
let historyDebounceTimer: NodeJS.Timeout | null = null;

interface CanvasStore extends CanvasState {
  // Actions
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  zoomToCenter: (newZoom: number, viewportWidth: number, viewportHeight: number) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  
  // Shape management
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShapes: (ids: string[]) => void;
  removeShape: (id: string) => void;
  clearShapes: () => void;
  clearCanvas: () => void;
  setSelectedIds: (ids: string[]) => void;
  selectShape: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  selectMultipleShapes: (ids: string[]) => void;
  selectShapesInArea: (x1: number, y1: number, x2: number, y2: number) => void;
  transformSelectedShapes: (updates: { x?: number; y?: number; scaleX?: number; scaleY?: number; rotation?: number }) => void;
  
  // History management
  history: CanvasState[];
  historyIndex: number;
  pushHistory: (actionDescription?: string) => void;
  pushHistoryDebounced: (actionDescription?: string, delay?: number) => void;
  undo: () => void;
  redo: () => void;
  
  // Collaboration
  users: Map<string, UserPresence>;
  currentUser: UserPresence | null;
  setCurrentUser: (user: UserPresence) => void;
  updateUser: (id: string, updates: Partial<UserPresence>) => void;
  removeUser: (id: string) => void;
  
  // Tiles
  tiles: Tile[];
  addTile: (tile: Tile) => void;
  addTiles: (tiles: Tile[]) => void;
  removeTile: (x: number, y: number, layer?: 'terrain' | 'props') => void;
  clearTiles: () => void;
  
  // Tilesets
  tilesets: Tileset[];
  selectedTileset: Tileset | null;
  selectedTileIndex: number;
  brushSize: { width: number; height: number };
  setTilesets: (tilesets: Tileset[]) => void;
  setSelectedTileset: (tileset: Tileset | null) => void;
  setSelectedTileIndex: (index: number) => void;
  setBrushSize: (size: { width: number; height: number }) => void;
  
  // Enhanced autotiling status
  enhancedAutotilingEnabled: boolean;
  setEnhancedAutotiling: (enabled: boolean) => void;
  
  // Sprites
  sprites: SpriteInstance[];
  spriteDefinitions: SpriteDefinition[];
  selectedSpriteId: string | null;
  selectedSpriteDefId: string | null;
  animationPreview: boolean;
  addSprite: (sprite: SpriteInstance) => void;
  updateSprite: (id: string, updates: Partial<SpriteInstance>) => void;
  deleteSprite: (id: string) => void;
  selectSprite: (id: string) => void;
  setSpriteDefinitions: (defs: SpriteDefinition[]) => void;
  setSelectedSpriteDef: (id: string | null) => void;
  setAnimationPreview: (preview: boolean) => void;

  // Advanced Animation System
  timelines: Timeline[];
  stateMachines: StateMachine[];
  advancedAnimations: AdvancedAnimation[];
  spritesheetData: SpritesheetData[];
  currentTimeline: Timeline | null;
  currentStateMachine: StateMachine | null;
  timelinePlayback: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    loop: boolean;
  };
  
  // Timeline actions
  addTimeline: (timeline: Timeline) => void;
  updateTimeline: (id: string, updates: Partial<Timeline>) => void;
  deleteTimeline: (id: string) => void;
  setCurrentTimeline: (timeline: Timeline | null) => void;
  addTimelineTrack: (timelineId: string, track: TimelineTrack) => void;
  updateTimelineTrack: (timelineId: string, trackId: string, updates: Partial<TimelineTrack>) => void;
  deleteTimelineTrack: (timelineId: string, trackId: string) => void;
  addKeyframe: (timelineId: string, trackId: string, keyframe: TimelineKeyframe) => void;
  updateKeyframe: (timelineId: string, trackId: string, keyframeId: string, updates: Partial<TimelineKeyframe>) => void;
  deleteKeyframe: (timelineId: string, trackId: string, keyframeId: string) => void;
  
  // State Machine actions
  addStateMachine: (stateMachine: StateMachine) => void;
  updateStateMachine: (id: string, updates: Partial<StateMachine>) => void;
  deleteStateMachine: (id: string) => void;
  setCurrentStateMachine: (stateMachine: StateMachine | null) => void;
  
  // Advanced Animation actions
  addAdvancedAnimation: (animation: AdvancedAnimation) => void;
  updateAdvancedAnimation: (id: string, updates: Partial<AdvancedAnimation>) => void;
  deleteAdvancedAnimation: (id: string) => void;
  
  // Spritesheet actions
  addSpritesheetData: (data: SpritesheetData) => void;
  updateSpritesheetData: (id: string, updates: Partial<SpritesheetData>) => void;
  deleteSpritesheetData: (id: string) => void;
  
  // Playback controls
  playTimeline: () => void;
  pauseTimeline: () => void;
  stopTimeline: () => void;
  seekTimeline: (time: number) => void;
  setTimelineLoop: (loop: boolean) => void;
  
  // Project
  currentProjectId: string | null;
  currentProjectName: string;
  setCurrentProject: (id: string | null, name: string) => void;
  
  // Multi-board support
  boards: BoardData[];
  currentBoardId: string | null;
  currentBoardName: string;
  setBoards: (boards: BoardData[]) => void;
  addBoard: (board: BoardData) => void;
  updateBoard: (boardId: string, updates: Partial<BoardData>) => void;
  deleteBoard: (boardId: string) => void;
  setCurrentBoard: (boardId: string | null, boardName?: string) => void;
  createNewBoard: (name: string, type: BoardType, physics?: PhysicsConfig) => BoardData;
  switchToBoard: (boardId: string) => void;
  
  // Godot integration state
  useGodotRendering: boolean;
  godotProjectConfig: GodotProjectConfig | null;
  setUseGodotRendering: (enabled: boolean) => void;
  setGodotProjectConfig: (config: GodotProjectConfig | null) => void;
}

const initialState: CanvasState = {
  shapes: [],
  sprites: [],
  selectedIds: [],
  tool: 'select',
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridSize: 16,
  gridVisible: true,
  snapToGrid: false,
};

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  ...initialState,
  history: [initialState],
  historyIndex: 0,
  users: new Map(),
  currentUser: null,
  tiles: [],
  tilesets: [],
  selectedTileset: null,
  selectedTileIndex: 0,
  brushSize: { width: 1, height: 1 },
  currentProjectId: null,
  currentProjectName: 'Untitled Project',
  
  // Multi-board state
  boards: [],
  currentBoardId: null,
  currentBoardName: '',
  
  // Sprite state
  spriteDefinitions: initializeDemoSprites(),
  selectedSpriteId: null,
  selectedSpriteDefId: null,
  animationPreview: true,

  // Advanced Animation System state
  timelines: [],
  stateMachines: [],
  advancedAnimations: [],
  spritesheetData: [],
  currentTimeline: null,
  currentStateMachine: null,
  timelinePlayback: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    loop: false,
  },
  
  // Godot integration state
  useGodotRendering: false,
  godotProjectConfig: null,

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPan: (pan) => set({ pan }),
  
  // Zoom to center of viewport
  zoomToCenter: (newZoom: number, viewportWidth: number, viewportHeight: number) => {
    const state = get();
    const oldZoom = state.zoom;
    const clampedZoom = Math.max(0.1, Math.min(5, newZoom));
    
    // Calculate viewport center in screen coordinates
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    
    // Adjust pan to keep viewport center at same world position
    const zoomRatio = clampedZoom / oldZoom;
    const newPanX = state.pan.x * zoomRatio + viewportCenterX * (1 - zoomRatio);
    const newPanY = state.pan.y * zoomRatio + viewportCenterY * (1 - zoomRatio);
    
    set({
      zoom: clampedZoom,
      pan: { x: newPanX, y: newPanY },
    });
  },
  setGridVisible: (visible) => set({ gridVisible: visible }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSize: (size) => set({ gridSize: size }),

  addShape: (shape) => {
    set((state) => ({
      shapes: [...state.shapes, shape],
      selectedIds: [shape.id],
    }));
    get().pushHistory('Add shape');
    
    // Notify collaboration service
    if ((window as any).__collaborationService) {
      (window as any).__collaborationService.addShape(shape);
    }
  },

  updateShape: (id, updates) => {
    set((state) => {
      const index = state.shapes.findIndex((s) => s.id === id);
      const updatedShapes = state.shapes.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      
      // Notify collaboration service
      if (index >= 0 && (window as any).__collaborationService) {
        (window as any).__collaborationService.updateShape(index, updatedShapes[index]);
      }
      
      return { shapes: updatedShapes };
    });
    get().pushHistory('Update shape');
  },

  deleteShapes: (ids) => {
    set((state) => {
      // Notify collaboration service before deleting
      if ((window as any).__collaborationService) {
        ids.forEach((id) => {
          const index = state.shapes.findIndex((s) => s.id === id);
          if (index >= 0) {
            (window as any).__collaborationService.deleteShape(index);
          }
        });
      }
      
      return {
        shapes: state.shapes.filter((s) => !ids.includes(s.id)),
        selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
      };
    });
    get().pushHistory('Delete shapes');
  },

  removeShape: (id) => {
    get().deleteShapes([id]);
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  selectShape: (id, multi = false) => {
    set((state) => ({
      selectedIds: multi
        ? state.selectedIds.includes(id)
          ? state.selectedIds.filter((sid) => sid !== id)
          : [...state.selectedIds, id]
        : [id],
    }));
  },

  clearSelection: () => set({ selectedIds: [] }),

  selectMultipleShapes: (ids) => {
    set({ selectedIds: ids });
  },

  selectShapesInArea: (x1, y1, x2, y2) => {
    const state = get();
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const shapesInArea = state.shapes.filter(shape => {
      const { x, y, width = 0, height = 0 } = shape.transform;
      return x >= minX && y >= minY && (x + width) <= maxX && (y + height) <= maxY;
    });

    set({ selectedIds: shapesInArea.map(shape => shape.id) });
  },

  transformSelectedShapes: (updates) => {
    const state = get();
    const selectedShapes = state.shapes.filter(shape => state.selectedIds.includes(shape.id));
    
    if (selectedShapes.length === 0) return;

    // Calculate center point of selection for relative transformations
    const bounds = selectedShapes.reduce((acc, shape) => {
      const { x, y, width = 0, height = 0 } = shape.transform;
      return {
        minX: Math.min(acc.minX, x),
        minY: Math.min(acc.minY, y),
        maxX: Math.max(acc.maxX, x + width),
        maxY: Math.max(acc.maxY, y + height),
      };
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    set((state) => ({
      shapes: state.shapes.map(shape => {
        if (!state.selectedIds.includes(shape.id)) return shape;

        const transform = { ...shape.transform };

        // Apply transformations
        if (updates.x !== undefined || updates.y !== undefined) {
          transform.x += updates.x || 0;
          transform.y += updates.y || 0;
        }

        if (updates.scaleX !== undefined || updates.scaleY !== undefined) {
          const scaleX = updates.scaleX || transform.scaleX;
          const scaleY = updates.scaleY || transform.scaleY;
          
          // Scale relative to center point
          const relativeX = transform.x - centerX;
          const relativeY = transform.y - centerY;
          
          transform.x = centerX + relativeX * scaleX;
          transform.y = centerY + relativeY * scaleY;
          transform.scaleX = scaleX;
          transform.scaleY = scaleY;
        }

        if (updates.rotation !== undefined) {
          transform.rotation = (transform.rotation + updates.rotation) % 360;
        }

        return { ...shape, transform };
      }),
    }));
    
    get().pushHistory('Transform shapes');
  },

  pushHistory: (actionDescription?: string) => {
    const state = get();
    const currentState: CanvasState = {
      shapes: state.shapes,
      sprites: state.sprites,
      selectedIds: state.selectedIds,
      tool: state.tool,
      zoom: state.zoom,
      pan: state.pan,
      gridSize: state.gridSize,
      gridVisible: state.gridVisible,
      snapToGrid: state.snapToGrid,
    };
    
    // Add debug information in development
    if (process.env.NODE_ENV === 'development' && actionDescription) {
      console.log(`History: ${actionDescription}`, {
        shapes: currentState.shapes.length,
        sprites: currentState.sprites.length,
        selectedIds: currentState.selectedIds.length,
      });
    }
    
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(currentState);
      
      // Limit history to 100 items
      if (newHistory.length > 100) {
        newHistory.shift();
      }
      
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  },

  pushHistoryDebounced: (actionDescription?: string, delay: number = 300) => {
    if (historyDebounceTimer) {
      clearTimeout(historyDebounceTimer);
    }
    
    historyDebounceTimer = setTimeout(() => {
      get().pushHistory(actionDescription);
      historyDebounceTimer = null;
    }, delay);
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const previousState = state.history[newIndex];
      set({
        ...previousState,
        historyIndex: newIndex,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const nextState = state.history[newIndex];
      set({
        ...nextState,
        historyIndex: newIndex,
      });
    }
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  updateUser: (id, updates) => {
    set((state) => {
      const newUsers = new Map(state.users);
      const user = newUsers.get(id);
      if (user) {
        newUsers.set(id, { ...user, ...updates });
      }
      return { users: newUsers };
    });
  },

  removeUser: (id) => {
    set((state) => {
      const newUsers = new Map(state.users);
      newUsers.delete(id);
      return { users: newUsers };
    });
  },

  addTile: (tile) => {
    set((state) => {
      // Find existing tile at same position AND same layer
      const existingIndex = state.tiles.findIndex(
        (t) => t.x === tile.x && t.y === tile.y && t.layer === tile.layer
      );
      if (existingIndex >= 0) {
        const newTiles = [...state.tiles];
        newTiles[existingIndex] = tile;
        
        // Notify collaboration service
        if ((window as any).__collaborationService) {
          (window as any).__collaborationService.updateTile(existingIndex, tile);
        }
        
        return { tiles: newTiles };
      }
      
      // Notify collaboration service
      if ((window as any).__collaborationService) {
        (window as any).__collaborationService.addTile(tile);
      }
      
      return { tiles: [...state.tiles, tile] };
    });
    get().pushHistory('Add tile');
  },

  addTiles: (tilesToAdd) => {
    set((state) => {
      let newTiles = [...state.tiles];
      
      tilesToAdd.forEach((tile) => {
        // Find existing tile at same position AND same layer
        const existingIndex = newTiles.findIndex(
          (t) => t.x === tile.x && t.y === tile.y && t.layer === tile.layer
        );
        
        if (existingIndex >= 0) {
          newTiles[existingIndex] = tile;
          // Notify collaboration service
          if ((window as any).__collaborationService) {
            (window as any).__collaborationService.updateTile(existingIndex, tile);
          }
        } else {
          newTiles.push(tile);
          // Notify collaboration service
          if ((window as any).__collaborationService) {
            (window as any).__collaborationService.addTile(tile);
          }
        }
      });
      
      return { tiles: newTiles };
    });
    get().pushHistory('Add tiles');
  },

  removeTile: (x, y, layer) => {
    set((state) => {
      // If layer is specified, only remove tiles from that layer
      // Otherwise, remove all tiles at the position (backwards compatibility)
      const index = state.tiles.findIndex((t) => 
        t.x === x && t.y === y && (!layer || t.layer === layer)
      );
      
      // Notify collaboration service
      if (index >= 0 && (window as any).__collaborationService) {
        (window as any).__collaborationService.deleteTile(index);
      }
      
      return {
        tiles: state.tiles.filter((t) => 
          !(t.x === x && t.y === y && (!layer || t.layer === layer))
        ),
      };
    });
    get().pushHistory('Remove tile');
  },

  clearTiles: () => {
    set({ tiles: [] });
    get().pushHistory('Clear tiles');
  },

  clearShapes: () => {
    set({ shapes: [], selectedIds: [] });
    get().pushHistory('Clear shapes');
  },

  clearCanvas: () => {
    set({ 
      shapes: [], 
      sprites: [],
      tiles: [],
      selectedIds: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      gridSize: 16,
      gridVisible: true,
      snapToGrid: false,
      tool: 'select'
    });
    get().pushHistory('Clear canvas');
  },

  setTilesets: (tilesets) => set({ tilesets }),
  setSelectedTileset: (tileset) => set({ selectedTileset: tileset }),
  setSelectedTileIndex: (index) => set({ selectedTileIndex: index }),
  setBrushSize: (size) => set({ brushSize: size }),
  
  // Enhanced autotiling
  enhancedAutotilingEnabled: true,
  setEnhancedAutotiling: (enabled) => {
    set({ enhancedAutotilingEnabled: enabled });
    
    // Update client instance
    const { EnhancedAutoTilingClient } = require('@/utils/enhancedAutoTiling');
    const client = EnhancedAutoTilingClient.getInstance();
    client.setFallbackMode(!enabled);
  },

  setCurrentProject: (id, name) => {
    set({ currentProjectId: id, currentProjectName: name });
    
    // Persist to localStorage for auto-load on page refresh
    if (id) {
      localStorage.setItem('currentProjectId', id);
      localStorage.setItem('currentProjectName', name);
    } else {
      localStorage.removeItem('currentProjectId');
      localStorage.removeItem('currentProjectName');
    }
  },

  // Sprite actions
  addSprite: (sprite) => {
    set((state) => ({
      sprites: [...state.sprites, sprite],
      selectedSpriteId: sprite.id,
      selectedIds: [], // Clear shape selection
    }));
    get().pushHistory('Add sprite');
    
    // Notify collaboration service
    if ((window as any).__collaborationService) {
      (window as any).__collaborationService.addSprite(sprite);
    }
  },

  updateSprite: (id, updates) => {
    set((state) => {
      const index = state.sprites.findIndex((s) => s.id === id);
      const updatedSprites = state.sprites.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      
      // Notify collaboration service
      if (index >= 0 && (window as any).__collaborationService) {
        (window as any).__collaborationService.updateSprite(index, updatedSprites[index]);
      }
      
      return { sprites: updatedSprites };
    });
    get().pushHistory('Update sprite');
  },

  deleteSprite: (id) => {
    set((state) => {
      const index = state.sprites.findIndex((s) => s.id === id);
      
      // Notify collaboration service before deleting
      if (index >= 0 && (window as any).__collaborationService) {
        (window as any).__collaborationService.deleteSprite(index);
      }
      
      return {
        sprites: state.sprites.filter((s) => s.id !== id),
        selectedSpriteId: state.selectedSpriteId === id ? null : state.selectedSpriteId,
      };
    });
    get().pushHistory('Delete sprite');
  },

  selectSprite: (id) => {
    set({ selectedSpriteId: id, selectedIds: [] }); // Clear shape selection
  },

  setSpriteDefinitions: (defs) => set({ spriteDefinitions: defs }),
  setSelectedSpriteDef: (id) => set({ selectedSpriteDefId: id }),
  setAnimationPreview: (preview) => set({ animationPreview: preview }),

  // Multi-board management
  setBoards: (boards) => set({ boards }),
  
  addBoard: (board) => {
    set((state) => ({
      boards: [...state.boards, board],
      currentBoardId: board.id,
    }));
  },
  
  updateBoard: (boardId, updates) => {
    set((state) => ({
      boards: state.boards.map((board) =>
        board.id === boardId ? { ...board, ...updates, updatedAt: new Date() } : board
      ),
    }));
  },
  
  deleteBoard: (boardId) => {
    set((state) => {
      const newBoards = state.boards.filter((board) => board.id !== boardId);
      const newCurrentBoardId = state.currentBoardId === boardId 
        ? (newBoards.length > 0 ? newBoards[0].id : null)
        : state.currentBoardId;
      
      return {
        boards: newBoards,
        currentBoardId: newCurrentBoardId,
      };
    });
  },
  
  setCurrentBoard: (boardId, boardName) => set({ 
    currentBoardId: boardId, 
    currentBoardName: boardName || '' 
  }),
  
  createNewBoard: (name, type = 'topdown', physics) => {
    const defaultPhysics: PhysicsConfig = type === 'platformer' 
      ? { 
          gravity: { x: 0, y: 980 }, 
          airResistance: 0.1, 
          terminalVelocity: 1000, 
          physicsScale: 1,
          enabled: true 
        }
      : { 
          gravity: { x: 0, y: 0 }, 
          airResistance: 0, 
          terminalVelocity: 1000, 
          physicsScale: 1,
          enabled: false 
        };

    const newBoard: BoardData = {
      id: uuidv4(),
      projectId: get().currentProjectId || '',
      name,
      type,
      tilesets: [],
      physics: physics || defaultPhysics,
      canvasState: { ...initialState },
      tileMap: {
        gridSize: 16,
        tiles: [],
        spriteDefinitions: initializeDemoSprites(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    return newBoard;
  },
  
  switchToBoard: (boardId) => {
    const state = get();
    const board = state.boards.find((b) => b.id === boardId);
    
    if (!board) return;
    
    // Save current board state before switching
    if (state.currentBoardId) {
      const currentBoardState: CanvasState = {
        shapes: state.shapes,
        sprites: state.sprites,
        selectedIds: state.selectedIds,
        tool: state.tool,
        zoom: state.zoom,
        pan: state.pan,
        gridSize: state.gridSize,
        gridVisible: state.gridVisible,
        snapToGrid: state.snapToGrid,
      };
      
      const currentTileMap = {
        gridSize: state.gridSize,
        tiles: state.tiles,
        spriteDefinitions: state.spriteDefinitions,
      };
      
      get().updateBoard(state.currentBoardId, {
        canvasState: currentBoardState,
        tileMap: currentTileMap,
      });
    }
    
    // Load new board state with null checks
    set({
      currentBoardId: boardId,
      currentBoardName: board.name,
      shapes: board.canvasState?.shapes || [],
      sprites: board.canvasState?.sprites || [],
      selectedIds: [],
      tool: board.canvasState?.tool || 'select',
      zoom: board.canvasState?.zoom || 1,
      pan: board.canvasState?.pan || { x: 0, y: 0 },
      gridSize: board.canvasState?.gridSize || 16,
      gridVisible: board.canvasState?.gridVisible ?? true,
      snapToGrid: board.canvasState?.snapToGrid ?? false,
      tiles: board.tileMap?.tiles || [],
      spriteDefinitions: board.tileMap?.spriteDefinitions || initializeDemoSprites(),
    });
    
    // Sync to collaboration service
    if ((window as any).__collaborationService) {
      (window as any).__collaborationService.syncFromLocal();
    }
  },

  // Timeline actions
  addTimeline: (timeline) => {
    set((state) => ({
      timelines: [...state.timelines, timeline],
      currentTimeline: timeline,
    }));
    get().pushHistory('Add timeline');
  },

  updateTimeline: (id, updates) => {
    set((state) => ({
      timelines: state.timelines.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
      currentTimeline: state.currentTimeline?.id === id 
        ? { ...state.currentTimeline, ...updates } 
        : state.currentTimeline,
    }));
    get().pushHistory('Update timeline');
  },

  deleteTimeline: (id) => {
    set((state) => ({
      timelines: state.timelines.filter((t) => t.id !== id),
      currentTimeline: state.currentTimeline?.id === id ? null : state.currentTimeline,
    }));
    get().pushHistory('Delete timeline');
  },

  setCurrentTimeline: (timeline) => set({ currentTimeline: timeline }),

  addTimelineTrack: (timelineId, track) => {
    set((state) => ({
      timelines: state.timelines.map((t) =>
        t.id === timelineId 
          ? { ...t, tracks: [...t.tracks, track] }
          : t
      ),
    }));
    get().pushHistory('Add timeline track');
  },

  updateTimelineTrack: (timelineId, trackId, updates) => {
    set((state) => ({
      timelines: state.timelines.map((t) =>
        t.id === timelineId 
          ? {
              ...t,
              tracks: t.tracks.map((track) =>
                track.id === trackId ? { ...track, ...updates } : track
              ),
            }
          : t
      ),
    }));
    get().pushHistory('Update timeline track');
  },

  deleteTimelineTrack: (timelineId, trackId) => {
    set((state) => ({
      timelines: state.timelines.map((t) =>
        t.id === timelineId 
          ? { ...t, tracks: t.tracks.filter((track) => track.id !== trackId) }
          : t
      ),
    }));
    get().pushHistory('Delete timeline track');
  },

  addKeyframe: (timelineId, trackId, keyframe) => {
    set((state) => ({
      timelines: state.timelines.map((t) =>
        t.id === timelineId 
          ? {
              ...t,
              tracks: t.tracks.map((track) =>
                track.id === trackId 
                  ? { ...track, keyframes: [...track.keyframes, keyframe] }
                  : track
              ),
            }
          : t
      ),
    }));
    get().pushHistory('Add keyframe');
  },

  updateKeyframe: (timelineId, trackId, keyframeId, updates) => {
    set((state) => ({
      timelines: state.timelines.map((t) =>
        t.id === timelineId 
          ? {
              ...t,
              tracks: t.tracks.map((track) =>
                track.id === trackId 
                  ? {
                      ...track,
                      keyframes: track.keyframes.map((kf) =>
                        kf.id === keyframeId ? { ...kf, ...updates } : kf
                      ),
                    }
                  : track
              ),
            }
          : t
      ),
    }));
    get().pushHistory('Update keyframe');
  },

  deleteKeyframe: (timelineId, trackId, keyframeId) => {
    set((state) => ({
      timelines: state.timelines.map((t) =>
        t.id === timelineId 
          ? {
              ...t,
              tracks: t.tracks.map((track) =>
                track.id === trackId 
                  ? { ...track, keyframes: track.keyframes.filter((kf) => kf.id !== keyframeId) }
                  : track
              ),
            }
          : t
      ),
    }));
    get().pushHistory('Delete keyframe');
  },

  // State Machine actions
  addStateMachine: (stateMachine) => {
    set((state) => ({
      stateMachines: [...state.stateMachines, stateMachine],
      currentStateMachine: stateMachine,
    }));
    get().pushHistory('Add state machine');
  },

  updateStateMachine: (id, updates) => {
    set((state) => ({
      stateMachines: state.stateMachines.map((sm) =>
        sm.id === id ? { ...sm, ...updates } : sm
      ),
      currentStateMachine: state.currentStateMachine?.id === id 
        ? { ...state.currentStateMachine, ...updates } 
        : state.currentStateMachine,
    }));
    get().pushHistory('Update state machine');
  },

  deleteStateMachine: (id) => {
    set((state) => ({
      stateMachines: state.stateMachines.filter((sm) => sm.id !== id),
      currentStateMachine: state.currentStateMachine?.id === id ? null : state.currentStateMachine,
    }));
    get().pushHistory('Delete state machine');
  },

  setCurrentStateMachine: (stateMachine) => set({ currentStateMachine: stateMachine }),

  // Advanced Animation actions
  addAdvancedAnimation: (animation) => {
    set((state) => ({
      advancedAnimations: [...state.advancedAnimations, animation],
    }));
    get().pushHistory('Add advanced animation');
  },

  updateAdvancedAnimation: (id, updates) => {
    set((state) => ({
      advancedAnimations: state.advancedAnimations.map((anim) =>
        anim.id === id ? { ...anim, ...updates } : anim
      ),
    }));
    get().pushHistory('Update advanced animation');
  },

  deleteAdvancedAnimation: (id) => {
    set((state) => ({
      advancedAnimations: state.advancedAnimations.filter((anim) => anim.id !== id),
    }));
    get().pushHistory('Delete advanced animation');
  },

  // Spritesheet actions
  addSpritesheetData: (data) => {
    set((state) => ({
      spritesheetData: [...state.spritesheetData, data],
    }));
    get().pushHistory('Add spritesheet data');
  },

  updateSpritesheetData: (id, updates) => {
    set((state) => ({
      spritesheetData: state.spritesheetData.map((data) =>
        data.id === id ? { ...data, ...updates } : data
      ),
    }));
    get().pushHistory('Update spritesheet data');
  },

  deleteSpritesheetData: (id) => {
    set((state) => ({
      spritesheetData: state.spritesheetData.filter((data) => data.id !== id),
    }));
    get().pushHistory('Delete spritesheet data');
  },

  // Playback controls
  playTimeline: () => {
    set((state) => ({
      timelinePlayback: {
        ...state.timelinePlayback,
        isPlaying: true,
      },
    }));
  },

  pauseTimeline: () => {
    set((state) => ({
      timelinePlayback: {
        ...state.timelinePlayback,
        isPlaying: false,
      },
    }));
  },

  stopTimeline: () => {
    set((state) => ({
      timelinePlayback: {
        ...state.timelinePlayback,
        isPlaying: false,
        currentTime: 0,
      },
    }));
  },

  seekTimeline: (time) => {
    set((state) => ({
      timelinePlayback: {
        ...state.timelinePlayback,
        currentTime: Math.max(0, Math.min(time, state.timelinePlayback.duration)),
      },
    }));
  },

  setTimelineLoop: (loop) => {
    set((state) => ({
      timelinePlayback: {
        ...state.timelinePlayback,
        loop,
      },
    }));
  },
  
  // Godot integration actions
  setUseGodotRendering: (enabled) => set({ useGodotRendering: enabled }),
  setGodotProjectConfig: (config) => set({ godotProjectConfig: config }),
}));
