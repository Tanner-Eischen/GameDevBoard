import { create } from 'zustand';
import type { Shape, ToolType, CanvasState, UserPresence, Tile, Tileset, SpriteInstance, SpriteDefinition, AnimationState } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { initializeDemoSprites } from '@/utils/demoSprites';

type HistoryEntry = CanvasState & { tiles: Tile[] };

type HistorySource = {
  shapes: Shape[];
  sprites: SpriteInstance[];
  selectedIds: string[];
  tool: ToolType;
  zoom: number;
  pan: { x: number; y: number };
  gridSize: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  tiles: Tile[];
};

const createHistorySnapshot = (state: HistorySource): HistoryEntry =>
  structuredClone({
    shapes: state.shapes,
    sprites: state.sprites,
    selectedIds: state.selectedIds,
    tool: state.tool,
    zoom: state.zoom,
    pan: state.pan,
    gridSize: state.gridSize,
    gridVisible: state.gridVisible,
    snapToGrid: state.snapToGrid,
    tiles: state.tiles,
  });

const applyHistorySnapshot = (snapshot: HistoryEntry) => ({
  shapes: structuredClone(snapshot.shapes),
  sprites: structuredClone(snapshot.sprites),
  selectedIds: [...snapshot.selectedIds],
  tool: snapshot.tool,
  zoom: snapshot.zoom,
  pan: { ...snapshot.pan },
  gridSize: snapshot.gridSize,
  gridVisible: snapshot.gridVisible,
  snapToGrid: snapshot.snapToGrid,
  tiles: structuredClone(snapshot.tiles),
});

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
  updateShape: (id: string, updates: Partial<Shape>, options?: { recordHistory?: boolean }) => void;
  deleteShapes: (ids: string[]) => void;
  clearShapes: () => void;
  setSelectedIds: (ids: string[]) => void;
  selectShape: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  groupSelectedShapes: () => void;
  ungroupSelectedShapes: () => void;

  // History
  history: HistoryEntry[];
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
  
  // Sprites
  sprites: SpriteInstance[];
  spriteDefinitions: SpriteDefinition[];
  selectedSpriteId: string | null;
  selectedSpriteDefId: string | null;
  animationPreview: boolean;
  addSprite: (sprite: SpriteInstance) => void;
  updateSprite: (id: string, updates: Partial<SpriteInstance>, options?: { recordHistory?: boolean }) => void;
  deleteSprite: (id: string) => void;
  selectSprite: (id: string) => void;
  setSpriteDefinitions: (defs: SpriteDefinition[]) => void;
  setSelectedSpriteDef: (id: string | null) => void;
  setAnimationPreview: (preview: boolean) => void;
  
  // Project
  currentProjectId: string | null;
  currentProjectName: string;
  setCurrentProject: (id: string | null, name: string) => void;
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

const initialHistoryEntry = createHistorySnapshot({
  ...initialState,
  tiles: [],
});

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  ...initialState,
  history: [initialHistoryEntry],
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
  
  // Sprite state
  spriteDefinitions: initializeDemoSprites(),
  selectedSpriteId: null,
  selectedSpriteDefId: null,
  animationPreview: true,

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
    get().pushHistory();
    
    // Notify collaboration service
    if ((window as any).__collaborationService) {
      (window as any).__collaborationService.addShape(shape);
    }
  },

  updateShape: (id, updates, options) => {
    const shouldRecord = options?.recordHistory ?? true;
    let updated = false;

    set((state) => {
      const index = state.shapes.findIndex((s) => s.id === id);
      if (index === -1) {
        return {};
      }

      const updatedShape = { ...state.shapes[index], ...updates };
      const updatedShapes = [...state.shapes];
      updatedShapes[index] = updatedShape;
      updated = true;

      // Notify collaboration service
      if ((window as any).__collaborationService) {
        (window as any).__collaborationService.updateShape(index, updatedShape);
      }

      return { shapes: updatedShapes };
    });

    if (updated && shouldRecord) {
      get().pushHistory();
    }
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

  groupSelectedShapes: () => {
    const state = get();
    if (state.selectedIds.length < 2) return;

    const groupId = uuidv4();
    const updatedShapes = state.shapes.map((shape) =>
      state.selectedIds.includes(shape.id)
        ? {
            ...shape,
            metadata: { ...shape.metadata, groupId },
          }
        : shape
    );

    set({ shapes: updatedShapes });

    if ((window as any).__collaborationService) {
      state.selectedIds.forEach((id) => {
        const index = state.shapes.findIndex((shape) => shape.id === id);
        if (index >= 0) {
          (window as any).__collaborationService.updateShape(index, updatedShapes[index]);
        }
      });
    }
    get().pushHistory();
  },

  ungroupSelectedShapes: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;

    const updatedShapes = state.shapes.map((shape) =>
      state.selectedIds.includes(shape.id)
        ? {
            ...shape,
            metadata: { ...shape.metadata, groupId: undefined },
          }
        : shape
    );

    set({ shapes: updatedShapes });

    if ((window as any).__collaborationService) {
      state.selectedIds.forEach((id) => {
        const index = state.shapes.findIndex((shape) => shape.id === id);
        if (index >= 0) {
          (window as any).__collaborationService.updateShape(index, updatedShapes[index]);
        }
      });
    }
    get().pushHistory();
  },

  pushHistory: () => {
    const state = get();
    const snapshot = createHistorySnapshot({
      shapes: state.shapes,
      sprites: state.sprites,
      selectedIds: state.selectedIds,
      tool: state.tool,
      zoom: state.zoom,
      pan: state.pan,
      gridSize: state.gridSize,
      gridVisible: state.gridVisible,
      snapToGrid: state.snapToGrid,
      tiles: state.tiles,
    });

    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);

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
    set((state) => {
      if (state.historyIndex <= 0) {
        return {};
      }

      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];

      return {
        ...applyHistorySnapshot(snapshot),
        historyIndex: newIndex,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) {
        return {};
      }

      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];

      return {
        ...applyHistorySnapshot(snapshot),
        historyIndex: newIndex,
      };
    });
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

  // Sprite actions
  addSprite: (sprite) => {
    set((state) => ({
      sprites: [...state.sprites, sprite],
      selectedSpriteId: sprite.id,
      selectedIds: [], // Clear shape selection
    }));
    get().pushHistory();
    
    // Notify collaboration service
    if ((window as any).__collaborationService) {
      (window as any).__collaborationService.addSprite(sprite);
    }
  },

  updateSprite: (id, updates, options) => {
    const shouldRecord = options?.recordHistory ?? true;
    let updated = false;

    set((state) => {
      const index = state.sprites.findIndex((s) => s.id === id);
      if (index === -1) {
        return {};
      }

      const updatedSprite = { ...state.sprites[index], ...updates };
      const updatedSprites = [...state.sprites];
      updatedSprites[index] = updatedSprite;
      updated = true;

      // Notify collaboration service
      if ((window as any).__collaborationService) {
        (window as any).__collaborationService.updateSprite(index, updatedSprite);
      }

      return { sprites: updatedSprites };
    });

    if (updated && shouldRecord) {
      get().pushHistory();
    }
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
    get().pushHistory();
  },

  selectSprite: (id) => {
    set({ selectedSpriteId: id, selectedIds: [] }); // Clear shape selection
  },

  setSpriteDefinitions: (defs) => set({ spriteDefinitions: defs }),
  setSelectedSpriteDef: (id) => set({ selectedSpriteDefId: id }),
  setAnimationPreview: (preview) => set({ animationPreview: preview }),
}));
