import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Shape, UserPresence } from '@shared/schema';
import { useCanvasStore } from '@/store/useCanvasStore';

export class CollaborationService {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private shapesArray: Y.Array<any>;
  private tilesArray: Y.Array<any>;
  private awareness: any;
  private roomId: string;

  constructor(roomId: string = 'default') {
    this.roomId = roomId;
    this.doc = new Y.Doc();
    this.shapesArray = this.doc.getArray('shapes');
    this.tilesArray = this.doc.getArray('tiles');
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?room=${this.roomId}`;

    this.provider = new WebsocketProvider(
      wsUrl,
      this.roomId,
      this.doc,
      {
        connect: true,
        awareness: {
          timeout: 30000,
        },
      }
    );

    this.awareness = this.provider.awareness;

    // Set local user state
    const currentUser = useCanvasStore.getState().currentUser;
    if (currentUser) {
      this.awareness.setLocalState({
        user: currentUser,
      });
    }

    // Listen to awareness changes (other users' cursors, selections, etc.)
    this.awareness.on('change', () => {
      const states = this.awareness.getStates();
      const users = new Map<string, UserPresence>();

      states.forEach((state: any, clientId: number) => {
        if (state.user && clientId !== this.awareness.clientID) {
          users.set(state.user.id, state.user);
        }
      });

      useCanvasStore.setState({ users });
    });

    let isRemoteChange = false;

    // Listen to shapes changes
    this.shapesArray.observe((event) => {
      if (event.transaction.origin !== 'local') {
        isRemoteChange = true;
        const shapes = this.shapesArray.toArray();
        useCanvasStore.setState({ shapes });
        isRemoteChange = false;
      }
    });

    // Listen to tiles changes
    this.tilesArray.observe((event) => {
      if (event.transaction.origin !== 'local') {
        isRemoteChange = true;
        const tiles = this.tilesArray.toArray();
        useCanvasStore.setState({ tiles });
        isRemoteChange = false;
      }
    });

    // Only sync from local if arrays are empty (first connection)
    if (this.shapesArray.length === 0 && this.tilesArray.length === 0) {
      this.syncFromLocal();
    }

    return this;
  }

  disconnect() {
    if (this.provider) {
      this.provider.disconnect();
      this.provider.destroy();
      this.provider = null;
    }
  }

  syncFromLocal() {
    const state = useCanvasStore.getState();
    
    // Sync shapes
    this.doc.transact(() => {
      this.shapesArray.delete(0, this.shapesArray.length);
      this.shapesArray.push(state.shapes);
    }, 'local');

    // Sync tiles
    this.doc.transact(() => {
      this.tilesArray.delete(0, this.tilesArray.length);
      this.tilesArray.push(state.tiles);
    }, 'local');
  }

  updateShape(index: number, shape: Shape) {
    this.doc.transact(() => {
      if (index < this.shapesArray.length) {
        this.shapesArray.delete(index, 1);
        this.shapesArray.insert(index, [shape]);
      }
    }, 'local');
  }

  addShape(shape: Shape) {
    this.doc.transact(() => {
      this.shapesArray.push([shape]);
    }, 'local');
  }

  deleteShape(index: number) {
    this.doc.transact(() => {
      if (index < this.shapesArray.length) {
        this.shapesArray.delete(index, 1);
      }
    }, 'local');
  }

  addTile(tile: any) {
    this.doc.transact(() => {
      this.tilesArray.push([tile]);
    }, 'local');
  }

  updateTile(index: number, tile: any) {
    this.doc.transact(() => {
      if (index < this.tilesArray.length) {
        this.tilesArray.delete(index, 1);
        this.tilesArray.insert(index, [tile]);
      }
    }, 'local');
  }

  deleteTile(index: number) {
    this.doc.transact(() => {
      if (index < this.tilesArray.length) {
        this.tilesArray.delete(index, 1);
      }
    }, 'local');
  }

  updateUserPresence(updates: Partial<UserPresence>) {
    if (this.awareness) {
      const currentState = this.awareness.getLocalState();
      this.awareness.setLocalState({
        ...currentState,
        user: {
          ...currentState?.user,
          ...updates,
        },
      });
    }
  }
}

let collaborationService: CollaborationService | null = null;

export function getCollaborationService(roomId?: string): CollaborationService {
  if (!collaborationService) {
    collaborationService = new CollaborationService(roomId);
  }
  return collaborationService;
}
