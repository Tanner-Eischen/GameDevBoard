import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import type { Shape, UserPresence } from '@shared/schema';
import { useCanvasStore } from '@/store/useCanvasStore';

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'auth_failed';
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
  errorCode?: string;
}

interface WebSocketMessage {
  type: 'yjs-update' | 'yjs-awareness' | 'error' | 'auth_success' | 'ping' | 'pong';
  data?: any;
  error?: string;
  code?: string;
  user?: any;
  roomId?: string;
  timestamp?: string;
}

export class CollaborationService {
  private docs: Map<string, Y.Doc> = new Map();
  private ws: WebSocket | null = null;
  private boardMaps: Map<string, {
    shapesMap: Y.Map<any>;
    tilesMap: Y.Map<any>;
    spritesMap: Y.Map<any>;
  }> = new Map();
  private awareness: Awareness;
  private roomId: string;
  private currentBoardId: string | null = null;
  private connectionState: ConnectionState = {
    status: 'disconnected',
    reconnectAttempts: 0
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private updateQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval = 60000; // 60 seconds (increased from 30 for long-running operations)
  private lastHeartbeat: number = 0;
  private authToken: string | null = null;
  private errorCallbacks: Array<(error: string, code?: string) => void> = [];
  private connectionCallbacks: Array<(state: ConnectionState) => void> = [];

  constructor(roomId: string = 'default') {
    this.roomId = roomId;
    
    // Create a shared awareness document for user presence
    const sharedDoc = new Y.Doc();
    this.awareness = new Awareness(sharedDoc);
    
    // Set up periodic awareness cleanup
    setInterval(() => {
      const statesToRemove = Array.from(this.awareness.getStates().keys()).filter(
        clientId => clientId !== this.awareness.clientID
      ).filter(clientId => {
        const state = this.awareness.getStates().get(clientId);
        return !state || (Date.now() - (state.lastSeen || 0)) > 30000; // 30 seconds
      });
      
      // Remove stale states one by one
      statesToRemove.forEach(clientId => {
        this.awareness.getStates().delete(clientId);
      });
    }, 10000); // Check every 10 seconds
  }

  connect(token?: string) {
    if (this.connectionState.status === 'connecting' || this.connectionState.status === 'connected') {
      return this;
    }

    // Store auth token
    if (token) {
      this.authToken = token;
    }

    this.updateConnectionState({
      status: 'connecting',
      error: undefined,
      errorCode: undefined
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Use current origin for WebSocket; Vite proxy will forward in dev
    const host = window.location.host;
    let wsUrl = `${protocol}//${host}/ws?room=${this.roomId}`;
    
    // Add authentication token to URL
    if (this.authToken) {
      wsUrl += `&token=${encodeURIComponent(this.authToken)}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.updateConnectionState({
        status: 'error',
        error: 'Failed to create WebSocket connection',
        errorCode: 'CONNECTION_FAILED'
      });
      this.scheduleReconnect();
      return this;
    }

    this.ws.onopen = () => {
      console.log('WebSocket connected, waiting for authentication...');
      
      // Don't set as fully connected until authentication succeeds
      this.updateConnectionState({
        status: 'connecting'
      });
      
      // Start heartbeat mechanism
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          // Binary Y.js update message
          this.handleBinaryMessage(new Uint8Array(event.data));
        } else {
          // JSON message
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleJsonMessage(message);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        this.notifyError('Failed to process message', 'MESSAGE_PARSE_ERROR');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateConnectionState({
        status: 'error',
        error: 'WebSocket connection error',
        errorCode: 'CONNECTION_ERROR'
      });
      this.notifyError('WebSocket connection error', 'CONNECTION_ERROR');
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      console.log('WebSocket close event details:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        timestamp: new Date().toISOString(),
        readyState: this.ws?.readyState,
        url: this.ws?.url
      });
      
      // Log stack trace to see what triggered the close
      if (event.code === 1001) {
        console.log('Code 1001 close - stack trace:', new Error().stack);
      }
      
      // Stop heartbeat
      this.stopHeartbeat();
      
      // Update connection state based on close code
      let shouldReconnect = true;
      let errorMessage = '';
      let errorCode = '';

      switch (event.code) {
        case 1000: // Normal closure
          shouldReconnect = false;
          this.updateConnectionState({ status: 'disconnected' });
          break;
        case 1008: // Policy violation (auth failed, rate limited, etc.)
          shouldReconnect = false;
          errorMessage = event.reason || 'Connection rejected by server';
          errorCode = 'AUTH_FAILED';
          this.updateConnectionState({
            status: 'auth_failed',
            error: errorMessage,
            errorCode
          });
          this.notifyError(errorMessage, errorCode);
          break;
        case 1011: // Server error
          errorMessage = 'Server error occurred';
          errorCode = 'SERVER_ERROR';
          this.updateConnectionState({
            status: 'error',
            error: errorMessage,
            errorCode
          });
          break;
        default:
          this.updateConnectionState({
            status: 'disconnected',
            error: event.reason || 'Connection lost',
            errorCode: 'CONNECTION_LOST'
          });
      }
      
      // Attempt reconnection if appropriate and under retry limit
      if (shouldReconnect && this.connectionState.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else if (this.connectionState.reconnectAttempts >= this.maxReconnectAttempts) {
        this.updateConnectionState({
          status: 'error',
          error: 'Maximum reconnection attempts exceeded',
          errorCode: 'MAX_RETRIES_EXCEEDED'
        });
        this.notifyError('Maximum reconnection attempts exceeded', 'MAX_RETRIES_EXCEEDED');
      }
    };

    // Enhanced Y.js update handling with batching for all boards
    this.docs.forEach((doc, boardId) => {
      doc.on('update', (update: Uint8Array, origin: any) => {
        if (origin !== 'remote' && this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Send board-specific update with board ID
          const message = JSON.stringify({ boardId, update: Array.from(update) });
          this.ws.send(message);
        } else if (origin !== 'remote') {
          // Queue update if not connected
          this.queueUpdate(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              const message = JSON.stringify({ boardId, update: Array.from(update) });
              this.ws.send(message);
            }
          });
        }
      });
    });

    // Set local user state with enhanced presence
    const currentUser = useCanvasStore.getState().currentUser;
    if (currentUser) {
      this.awareness.setLocalState({
        user: {
          ...currentUser,
          lastSeen: Date.now(),
          cursor: { x: 0, y: 0 },
          selection: [],
          tool: 'select'
        },
      });
    }

    // Enhanced awareness change handling
    this.awareness.on('change', () => {
      const states = this.awareness.getStates();
      const users = new Map<string, UserPresence>();

      states.forEach((state: any, clientId: number) => {
        if (state.user && clientId !== this.awareness.clientID) {
          // Add timestamp for presence tracking
          state.user.lastSeen = Date.now();
          users.set(state.user.id, state.user);
        }
      });

      useCanvasStore.setState({ users });
    });

    // Enhanced change observers with conflict resolution
    this.setupChangeObservers();

    return this;
  }

  // Board management methods
  switchToBoard(boardId: string) {
    this.currentBoardId = boardId;
    
    // Create document and maps for this board if they don't exist
    if (!this.docs.has(boardId)) {
      this.createBoardDocument(boardId);
    }
    
    // Setup observers for the new board
    this.setupBoardObservers(boardId);
    
    // Sync from local state if maps are empty
    const boardMaps = this.boardMaps.get(boardId);
    if (boardMaps && 
        boardMaps.shapesMap.size === 0 && 
        boardMaps.tilesMap.size === 0 && 
        boardMaps.spritesMap.size === 0) {
      this.syncFromLocal();
    }
  }

  private createBoardDocument(boardId: string) {
    const doc = new Y.Doc();
    this.docs.set(boardId, doc);
    
    // Create maps for this board
    const shapesMap = doc.getMap('shapes');
    const tilesMap = doc.getMap('tiles');
    const spritesMap = doc.getMap('sprites');
    
    this.boardMaps.set(boardId, {
      shapesMap,
      tilesMap,
      spritesMap,
    });
    
    // Setup update handler for this document
    doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote' && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({ boardId, update: Array.from(update) });
        this.ws.send(message);
      } else if (origin !== 'remote') {
        this.queueUpdate(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ boardId, update: Array.from(update) });
            this.ws.send(message);
          }
        });
      }
    });
  }

  private setupBoardObservers(boardId: string) {
    const boardMaps = this.boardMaps.get(boardId);
    if (!boardMaps) return;

    // Only setup observers for the current board to avoid conflicts
    if (boardId !== this.currentBoardId) return;

    // Shapes observer
    boardMaps.shapesMap.observe((event) => {
      if (event.transaction.origin !== 'local') {
        const shapes = Array.from(boardMaps.shapesMap.values());
        useCanvasStore.setState({ shapes });
      }
    });

    // Tiles observer
    boardMaps.tilesMap.observe((event) => {
      if (event.transaction.origin !== 'local') {
        const tiles = Array.from(boardMaps.tilesMap.values());
        useCanvasStore.setState({ tiles });
      }
    });

    // Sprites observer
    boardMaps.spritesMap.observe((event) => {
      if (event.transaction.origin !== 'local') {
        const sprites = Array.from(boardMaps.spritesMap.values());
        useCanvasStore.setState({ sprites });
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.updateConnectionState({
      status: 'reconnecting',
      reconnectAttempts: this.connectionState.reconnectAttempts + 1
    });

    // Exponential backoff with jitter - increased delays for stability
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1) * 2, // Double the delay
      60000 // Max 60 seconds instead of 30
    ) + Math.random() * 2000; // Increased jitter

    console.log(`Scheduling reconnect attempt ${this.connectionState.reconnectAttempts} in ${Math.round(delay)}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private queueUpdate(updateFn: () => void) {
    this.updateQueue.push(updateFn);
  }

  private async processUpdateQueue() {
    if (this.isProcessingQueue || this.updateQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    while (this.updateQueue.length > 0) {
      const updateFn = this.updateQueue.shift();
      if (updateFn) {
        try {
          updateFn();
        } catch (error) {
          console.error('Error processing queued update:', error);
        }
      }
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.isProcessingQueue = false;
  }

  private setupChangeObservers() {
    // This method is now handled by setupBoardObservers for each board
    // Keep for backward compatibility but observers are set up per board
  }

  disconnect() {
    console.log('CollaborationService: Explicit disconnect called');
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      console.log('CollaborationService: Closing WebSocket with code 1000');
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.updateConnectionState({
      status: 'disconnected',
      reconnectAttempts: 0,
      error: undefined,
      errorCode: undefined
    });
  }

  syncFromLocal() {
    if (!this.currentBoardId) return;
    
    const state = useCanvasStore.getState();
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    // Sync shapes using Map for better conflict resolution
    doc.transact(() => {
      boardMaps.shapesMap.clear();
      state.shapes.forEach((shape, index) => {
        boardMaps.shapesMap.set(shape.id || `shape-${index}`, shape);
      });
    }, 'local');

    // Sync tiles
    doc.transact(() => {
      boardMaps.tilesMap.clear();
      state.tiles.forEach((tile, index) => {
        const tileId = `${tile.x}-${tile.y}-${tile.layer || 0}-${tile.tilesetId}`;
        boardMaps.tilesMap.set(tileId, tile);
      });
    }, 'local');

    // Sync sprites
    doc.transact(() => {
      boardMaps.spritesMap.clear();
      state.sprites.forEach((sprite, index) => {
        boardMaps.spritesMap.set(sprite.id || `sprite-${index}`, sprite);
      });
    }, 'local');
  }

  // Enhanced shape operations with ID-based updates
  updateShape(shapeId: string, shape: Shape) {
    if (!this.currentBoardId) return;
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    doc.transact(() => {
      boardMaps.shapesMap.set(shapeId, { ...shape, id: shapeId });
    }, 'local');
  }

  addShape(shape: Shape) {
    if (!this.currentBoardId) return '';
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return '';
    
    const shapeId = shape.id || `shape-${Date.now()}-${Math.random()}`;
    doc.transact(() => {
      boardMaps.shapesMap.set(shapeId, { ...shape, id: shapeId });
    }, 'local');
    return shapeId;
  }

  deleteShape(shapeId: string) {
    if (!this.currentBoardId) return;
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    doc.transact(() => {
      boardMaps.shapesMap.delete(shapeId);
    }, 'local');
  }

  // Enhanced tile operations
  addTile(tile: any) {
    if (!this.currentBoardId) return;
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    const tileId = `${tile.x}-${tile.y}-${tile.layer || 0}-${tile.tilesetId}`;
    doc.transact(() => {
      boardMaps.tilesMap.set(tileId, tile);
    }, 'local');
  }

  updateTile(tileId: string, tile: any) {
    if (!this.currentBoardId) return;
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    doc.transact(() => {
      boardMaps.tilesMap.set(tileId, tile);
    }, 'local');
  }

  deleteTile(tileId: string) {
    if (!this.currentBoardId) return;
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    doc.transact(() => {
      boardMaps.tilesMap.delete(tileId);
    }, 'local');
  }

  // Enhanced sprite operations
  addSprite(sprite: any) {
    if (!this.currentBoardId) return '';
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return '';
    
    const spriteId = sprite.id || `sprite-${Date.now()}-${Math.random()}`;
    doc.transact(() => {
      boardMaps.spritesMap.set(spriteId, { ...sprite, id: spriteId });
    }, 'local');
    return spriteId;
  }

  updateSprite(spriteId: string, sprite: any) {
    if (!this.currentBoardId) return;
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    doc.transact(() => {
      boardMaps.spritesMap.set(spriteId, { ...sprite, id: spriteId });
    }, 'local');
  }

  deleteSprite(spriteId: string) {
    if (!this.currentBoardId) return;
    
    const boardMaps = this.boardMaps.get(this.currentBoardId);
    const doc = this.docs.get(this.currentBoardId);
    
    if (!boardMaps || !doc) return;
    
    doc.transact(() => {
      boardMaps.spritesMap.delete(spriteId);
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
          lastSeen: Date.now(),
        },
      });
    }
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  // Error handling and callback methods
  onError(callback: (error: string, code?: string) => void): void {
    this.errorCallbacks.push(callback);
  }

  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.connectionCallbacks.push(callback);
  }

  removeErrorCallback(callback: (error: string, code?: string) => void): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index > -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }

  removeConnectionCallback(callback: (state: ConnectionState) => void): void {
    const index = this.connectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.connectionCallbacks.splice(index, 1);
    }
  }

  private notifyError(error: string, code?: string): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error, code);
      } catch (err) {
        console.error('Error in error callback:', err);
      }
    });
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(this.connectionState);
      } catch (err) {
        console.error('Error in connection state callback:', err);
      }
    });
  }

  // Message handling methods
  private handleJsonMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'auth_success':
        this.handleAuthSuccess(message);
        break;
      case 'error':
        this.handleErrorMessage(message);
        break;
      case 'ping':
        this.handlePing();
        break;
      case 'pong':
        this.handlePong();
        break;
      case 'yjs-update':
        if (message.data) {
          this.handleBinaryMessage(new Uint8Array(message.data));
        }
        break;
      case 'yjs-awareness':
        if (message.data) {
          this.handleAwarenessUpdate(new Uint8Array(message.data));
        }
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private handleBinaryMessage(update: Uint8Array): void {
    if (this.currentBoardId) {
      const doc = this.docs.get(this.currentBoardId);
      if (doc) {
        try {
          Y.applyUpdate(doc, update, 'remote');
        } catch (error) {
          console.error('Error applying Y.js update:', error);
          this.notifyError('Failed to apply collaborative update', 'YJS_UPDATE_ERROR');
        }
      }
    }
  }

  private handleAwarenessUpdate(update: Uint8Array): void {
    try {
      // Apply awareness update
      // Note: This would need proper awareness protocol implementation
      console.log('Received awareness update');
    } catch (error) {
      console.error('Error applying awareness update:', error);
    }
  }

  private handleAuthSuccess(message: WebSocketMessage): void {
    console.log('WebSocket authentication successful');
    
    this.updateConnectionState({
      status: 'connected',
      lastConnected: new Date(),
      reconnectAttempts: 0,
      error: undefined,
      errorCode: undefined
    });

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Send initial state vector for synchronization for current board
    if (this.currentBoardId) {
      const doc = this.docs.get(this.currentBoardId);
      if (doc) {
        try {
          const stateVector = Y.encodeStateVector(doc);
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const syncMessage = JSON.stringify({ 
              type: 'yjs-sync',
              boardId: this.currentBoardId, 
              stateVector: Array.from(stateVector) 
            });
            this.ws.send(syncMessage);
          }
        } catch (error) {
          console.error('Error sending initial sync:', error);
        }
      }
    }

    // Process any queued updates
    this.processUpdateQueue();
  }

  private handleErrorMessage(message: WebSocketMessage): void {
    const error = message.error || 'Unknown server error';
    const code = message.code || 'UNKNOWN_ERROR';
    
    console.error('Server error:', error, code);
    
    this.updateConnectionState({
      status: 'error',
      error,
      errorCode: code
    });

    this.notifyError(error, code);

    // Handle specific error codes
    switch (code) {
      case 'AUTH_FAILED':
      case 'NO_TOKEN':
      case 'INVALID_TOKEN':
      case 'TOKEN_EXPIRED':
        this.updateConnectionState({ status: 'auth_failed' });
        break;
      case 'RATE_LIMIT_EXCEEDED':
      case 'MESSAGE_RATE_LIMIT':
        // Don't reconnect immediately for rate limits
        break;
      default:
        // For other errors, attempt reconnection
        if (this.connectionState.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
    }
  }

  private handlePing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const pongMessage = JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        });
        this.ws.send(pongMessage);
      } catch (error) {
        console.error('Error sending pong:', error);
      }
    }
  }

  private handlePong(): void {
    this.lastHeartbeat = Date.now();
  }

  // Heartbeat mechanism
  private startHeartbeat(): void {
    this.lastHeartbeat = Date.now();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const now = Date.now();
        
        // Check if we've missed too many heartbeats (increased tolerance to 5x for long operations like AI chat)
        if (now - this.lastHeartbeat > this.heartbeatInterval * 5) {
          console.warn('Heartbeat timeout, closing connection');
          this.ws.close(1000, 'Heartbeat timeout');
          return;
        }

        // Send ping
        try {
          const pingMessage = JSON.stringify({
            type: 'ping',
            timestamp: now
          });
          this.ws.send(pingMessage);
        } catch (error) {
          console.error('Error sending heartbeat ping:', error);
        }
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Update queue processing (enhanced version)
  private processUpdateQueueEnhanced(): void {
    // Process any queued updates that were waiting for connection
    // This would be implemented based on your specific queuing needs
    console.log('Processing update queue...');
  }

  // Enhanced error recovery methods
  retryConnection(): void {
    if (this.connectionState.status === 'error' || this.connectionState.status === 'disconnected') {
      console.log('Manually retrying connection...');
      this.updateConnectionState({ 
        reconnectAttempts: 0,
        error: undefined,
        errorCode: undefined
      });
      
      if (this.currentBoardId && this.authToken) {
        this.connect(this.authToken);
      }
    }
  }

  clearError(): void {
    this.updateConnectionState({
      error: undefined,
      errorCode: undefined,
      status: this.ws && this.ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'
    });
  }

  // Connection health check
  isHealthy(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    if (this.connectionState.status === 'error' || this.connectionState.status === 'auth_failed') {
      return false;
    }

    // Check heartbeat health
    const now = Date.now();
    if (this.lastHeartbeat && now - this.lastHeartbeat > this.heartbeatInterval * 5) {
      return false;
    }

    return true;
  }

  // Get connection metrics
  getConnectionMetrics() {
    return {
      status: this.connectionState.status,
      reconnectAttempts: this.connectionState.reconnectAttempts,
      lastConnected: this.connectionState.lastConnected,
      lastHeartbeat: this.lastHeartbeat,
      isHealthy: this.isHealthy(),
      hasError: !!this.connectionState.error,
      errorCode: this.connectionState.errorCode
    };
  }

  // Batch operations for performance
  batchUpdate(operations: Array<() => void>) {
    if (!this.currentBoardId) return;
    
    const doc = this.docs.get(this.currentBoardId);
    if (!doc) return;
    
    doc.transact(() => {
      operations.forEach(op => op());
    }, 'local');
  }

  // Get current board ID
  getCurrentBoardId(): string | null {
    return this.currentBoardId;
  }
}

let collaborationServices: Map<string, CollaborationService> = new Map();

export function getCollaborationService(roomId: string = 'default'): CollaborationService {
  if (!collaborationServices.has(roomId)) {
    collaborationServices.set(roomId, new CollaborationService(roomId));
  }
  return collaborationServices.get(roomId)!;
}
