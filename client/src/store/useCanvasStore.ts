import { create } from 'zustand';
import type { Shape, ToolType, CanvasState, UserPresence, Tile, Tileset } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

interface CanvasStore extends CanvasState {
  // Actions
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  
  // Shape management
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShapes: (ids: string[]) => void;
  clearShapes: () => void;
  setSelectedIds: (ids: string[]) => void;
  selectShape: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  
  // History
  history: CanvasState[];
  historyIndex: number;
  pushHistory: () => void;
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
  
  // Project
  currentProjectId: string | null;
  currentProjectName: string;
  setCurrentProject: (id: string | null, name: string) => void;
}

const initialState: CanvasState = {
  shapes: [],
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

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPan: (pan) => set({ pan }),
  setGridVisible: (visible) => set({ gridVisible: visible }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSize: (size) => set({ gridSize: size }),

  addShape: (shape) => {
    set((state) => ({
      shapes: [...state.shapes, shape],
      selectedIds: [shape.id],
    }));
    get().pushHistory();
    
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
    get().pushHistory();
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

  pushHistory: () => {
    const state = get();
    const currentState: CanvasState = {
      shapes: state.shapes,
      selectedIds: state.selectedIds,
      tool: state.tool,
      zoom: state.zoom,
      pan: state.pan,
      gridSize: state.gridSize,
      gridVisible: state.gridVisible,
      snapToGrid: state.snapToGrid,
    };
    
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
    get().pushHistory();
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
    get().pushHistory();
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
    get().pushHistory();
  },

  clearTiles: () => {
    set({ tiles: [] });
    get().pushHistory();
  },

  clearShapes: () => {
    set({ shapes: [], selectedIds: [] });
    get().pushHistory();
  },

  setTilesets: (tilesets) => set({ tilesets }),
  setSelectedTileset: (tileset) => set({ selectedTileset: tileset }),
  setSelectedTileIndex: (index) => set({ selectedTileIndex: index }),
  setBrushSize: (size) => set({ brushSize: size }),

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
}));
