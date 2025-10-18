import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import type { Shape, UserPresence } from '@shared/schema';
import { useCanvasStore } from '@/store/useCanvasStore';

export class CollaborationService {
  private doc: Y.Doc;
  private ws: WebSocket | null = null;
  private shapesArray: Y.Array<any>;
  private tilesArray: Y.Array<any>;
  private awareness: Awareness;
  private roomId: string;

  constructor(roomId: string = 'default') {
    this.roomId = roomId;
    this.doc = new Y.Doc();
    this.shapesArray = this.doc.getArray('shapes');
    this.tilesArray = this.doc.getArray('tiles');
    this.awareness = new Awareness(this.doc);
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?room=${this.roomId}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      // Send initial state
      const stateVector = Y.encodeStateVector(this.doc);
      if (this.ws) {
        this.ws.send(stateVector);
      }
    };

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const update = new Uint8Array(event.data);
        Y.applyUpdate(this.doc, update);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Send updates to the server
    this.doc.on('update', (update: Uint8Array) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(update);
      }
    });

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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
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
