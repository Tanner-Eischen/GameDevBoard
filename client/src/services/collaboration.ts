import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import type { Shape, UserPresence } from '@shared/schema';
import { useCanvasStore } from '@/store/useCanvasStore';

export class CollaborationService {
  private doc: Y.Doc;
  private ws: WebSocket | null = null;
  private shapesArray: Y.Array<any>;
  private tilesArray: Y.Array<any>;
  private spritesArray: Y.Array<any>;
  private awareness: Awareness;
  private roomId: string;

  constructor(roomId: string = 'default') {
    this.roomId = roomId;
    this.doc = new Y.Doc();
    this.shapesArray = this.doc.getArray('shapes');
    this.tilesArray = this.doc.getArray('tiles');
    this.spritesArray = this.doc.getArray('sprites');
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
      
      // Set local user state AFTER WebSocket is connected
      const currentUser = useCanvasStore.getState().currentUser;
      if (currentUser) {
        this.awareness.setLocalState({
          user: currentUser,
        });
      }
    };

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const update = new Uint8Array(event.data);
        // Check if this is an awareness update (first byte is 1) or doc update (first byte is 0)
        if (update.length > 0 && update[0] === 1) {
          // This is an awareness update - strip the prefix byte
          applyAwarenessUpdate(this.awareness, update.slice(1), null);
        } else if (update.length > 0 && update[0] === 0) {
          // This is a document update - strip the prefix byte
          Y.applyUpdate(this.doc, update.slice(1));
        } else {
          // Legacy message without prefix (for backwards compatibility during initial handshake)
          Y.applyUpdate(this.doc, update);
        }
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // Send document updates to the server
    this.doc.on('update', (update: Uint8Array) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Prepend 0 to indicate this is a document update
        const message = new Uint8Array(update.length + 1);
        message[0] = 0;
        message.set(update, 1);
        this.ws.send(message);
      }
    });

    // Send awareness updates to the server
    this.awareness.on('update', ({ added, updated, removed }: any) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const changedClients = added.concat(updated).concat(removed);
        const update = encodeAwarenessUpdate(this.awareness, changedClients);
        // Prepend 1 to indicate this is an awareness update
        const message = new Uint8Array(update.length + 1);
        message[0] = 1;
        message.set(update, 1);
        this.ws.send(message);
      }
    });

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

    // Listen to sprites changes
    this.spritesArray.observe((event) => {
      if (event.transaction.origin !== 'local') {
        isRemoteChange = true;
        const sprites = this.spritesArray.toArray();
        useCanvasStore.setState({ sprites });
        isRemoteChange = false;
      }
    });

    // Only sync from local if arrays are empty (first connection)
    if (this.shapesArray.length === 0 && this.tilesArray.length === 0 && this.spritesArray.length === 0) {
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

    // Sync sprites
    this.doc.transact(() => {
      this.spritesArray.delete(0, this.spritesArray.length);
      this.spritesArray.push(state.sprites);
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

  addSprite(sprite: any) {
    this.doc.transact(() => {
      this.spritesArray.push([sprite]);
    }, 'local');
  }

  updateSprite(index: number, sprite: any) {
    this.doc.transact(() => {
      if (index < this.spritesArray.length) {
        this.spritesArray.delete(index, 1);
        this.spritesArray.insert(index, [sprite]);
      }
    }, 'local');
  }

  deleteSprite(index: number) {
    this.doc.transact(() => {
      if (index < this.spritesArray.length) {
        this.spritesArray.delete(index, 1);
      }
    }, 'local');
  }

  updateUserPresence(updates: Partial<UserPresence>) {
    if (this.awareness) {
      const currentState = this.awareness.getLocalState();
      const updatedUser = {
        ...currentState?.user,
        ...updates,
      };
      this.awareness.setLocalState({
        user: updatedUser,
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
