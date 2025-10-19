# Game Development Board

A professional collaborative map editor for game development teams. Build tile-based levels and create game maps in real-time with your team using an infinite canvas with shape tools and tile painting capabilities.

## Overview

This is a real-time collaborative game development board built with:
- **Frontend**: React + TypeScript + React-Konva for canvas rendering
- **State Management**: Zustand for local state
- **Real-time Collaboration**: Y.js CRDT + WebSocket for seamless multi-user editing
- **Backend**: Express.js + WebSocket server
- **Database**: PostgreSQL with Drizzle ORM for persistent storage
- **UI**: Shadcn UI components + Tailwind CSS with professional dark mode design

## Features

### Canvas & Drawing Tools
- Infinite canvas with pan and zoom
- Shape tools: Rectangle, Circle, Polygon, Star, Line
- Selection and transformation (move, resize, rotate)
- Multi-select with Shift key
- Customizable shape properties (fill, stroke, opacity)
- Grid system with snap-to-grid functionality

### Tile Mapping
- Tile palette system with visual previews
- **Continuous Brush Painting**: Paint while dragging with adjustable brush sizes (1x1 to 3x3+)
- Paint and erase tools with auto-tiling
- **3x3 Auto-Tiling System**: Automatically selects correct tile variants (corners, edges, center) based on neighbor configuration
- **Optimized Performance**: Entire brush strokes batched into single undo entry
- Tileset upload to Replit object storage
- Three demo tilesets included (dirt, grass, water)
- Grid-based tile placement with snap-to-grid
- Independent auto-tiling per tileset (mixed terrain support)

### Real-Time Collaboration
- Live multi-user editing via Y.js CRDT
- User presence indicators showing active collaborators
- Each user gets a unique color and avatar
- Real-time cursor tracking (ready for integration)
- Conflict-free collaborative editing

### Project Management
- Save/Load projects with full canvas state
- Export projects as JSON
- Auto-save capability (ready for implementation)
- Project history with undo/redo (100 steps)

### Layer Management
- Visual layer panel
- Toggle shape visibility
- Delete shapes from layer panel
- Layer ordering

### AI Assistant
- **Natural Language Commands**: Ask AI to create maps and designs using plain English
- **Streaming Responses**: Real-time word-by-word AI responses via Server-Sent Events
- **Canvas Operations**: Paint terrain, create shapes, analyze canvas, and clear elements
- **Smart Terrain Painting**: AI can paint grass, dirt, or water with fill, border, or checkerboard patterns
- **Shape Generation**: Create rectangles, circles, stars, polygons in grid, random, circle, or line layouts
- **Canvas Analysis**: Get insights, statistics, and suggestions about your current design
- **Safety Features**: Confirmation dialogs for destructive actions (clear canvas)
- **Error Handling**: Zod validation for all AI commands with user-friendly error messages
- **Powered by OpenAI**: Uses GPT-4o-mini via Replit AI Integrations (no API key needed)

## Architecture

### Frontend Structure
```
client/src/
├── components/
│   ├── Canvas.tsx           # Main Konva canvas component
│   ├── Toolbar.tsx          # Tool selection and viewport controls
│   ├── PropertiesPanel.tsx  # Shape property inspector
│   ├── LayersPanel.tsx      # Layer management
│   ├── TilesetPanel.tsx     # Tileset selector and tile picker
│   ├── ObjectUploader.tsx   # Tileset image upload component
│   ├── UserPresence.tsx     # Active user indicators
│   ├── ProjectManager.tsx   # Save/Load/Export functionality
│   └── AiChat.tsx           # AI assistant chat interface
├── store/
│   └── useCanvasStore.ts    # Zustand state management
├── services/
│   └── collaboration.ts     # Y.js WebSocket integration
├── utils/
│   └── autoTiling.ts        # 3x3 auto-tiling algorithm
├── hooks/
│   ├── useProjects.ts       # Project API hooks
│   └── useTilesets.ts       # Tileset API hooks
└── pages/
    └── Board.tsx            # Main board layout
```

### Backend Structure
```
server/
├── routes.ts      # REST API + WebSocket server
├── storage.ts     # Database storage implementation
└── ai/
    ├── openai.ts    # OpenAI client configuration
    ├── functions.ts # AI function schemas (paintTerrain, createShapes, etc.)
    ├── executor.ts  # Function execution logic
    ├── validation.ts # Zod schemas for function arguments
    └── chat.ts      # Streaming chat handler with SSE
```

### Data Models
```
shared/schema.ts   # Shared TypeScript types and schemas
```

## Keyboard Shortcuts

- **V**: Select tool
- **H**: Pan tool
- **R**: Rectangle tool
- **C**: Circle tool
- **P**: Polygon tool
- **S**: Star tool
- **L**: Line tool
- **T**: Tile paint tool
- **E**: Tile erase tool
- **Ctrl+Z**: Undo
- **Ctrl+Shift+Z**: Redo
- **+/-**: Zoom in/out
- **G**: Toggle grid
- **Shift+G**: Toggle snap to grid

## Recent Changes

### 2025-10-19 - AI Assistant with Streaming & Safety Features Complete
- ✅ Integrated Replit OpenAI integration (GPT-4o-mini, no API key needed)
- ✅ Created AI agent infrastructure: openai.ts, functions.ts, executor.ts, validation.ts, chat.ts
- ✅ Implemented 4 AI canvas functions: paintTerrain, createShapes, analyzeCanvas, clearCanvas
- ✅ Built streaming chat UI with real-time word-by-word responses via SSE
- ✅ Added confirmation dialogs for destructive actions (clearCanvas)
- ✅ Implemented Zod validation for all AI function arguments
- ✅ Error handling with try-catch blocks and user-friendly messages
- ✅ SSE buffering for reliable streaming across network chunks
- ✅ End-to-end tested: 6 test scenarios covering chat, terrain painting, shape creation, analysis, and confirmations
- ✅ All AI features architect-reviewed and approved

### 2025-10-19 - Database Persistence (Milestone 1) Complete
- ✅ Migrated from in-memory storage to PostgreSQL database
- ✅ Created Drizzle ORM client with Neon HTTP driver
- ✅ Implemented DbStorage class with full IStorage interface
- ✅ Database schema with projects, tilesets, and users tables
- ✅ Automatic demo tileset initialization on first run
- ✅ All API endpoints now persist data to database
- ✅ Project save/load now persists across server restarts

### 2025-10-19 - Advanced Brush Painting System Complete
- ✅ Implemented continuous brush-based tile painting (paint while dragging, not just clicking)
- ✅ Added adjustable brush sizes with UI selector (1x1, 2x2, 2x3, 3x3, and more)
- ✅ Fixed CRITICAL BUG: Tile painting now works when clicking on existing tiles/shapes
- ✅ Implemented tile batching system: entire brush stroke creates single undo entry
- ✅ Optimized painting performance by batching all tile operations per stroke
- ✅ Brush tiles properly merge with auto-tiling results (no tile loss edge cases)
- ✅ Stage-target guard correctly placed: tile tools bypass check, shape tools validate

### 2025-10-19 - Texture-Based Tile Rendering Complete
- ✅ Implemented texture-based rendering using Konva.Image with crop
- ✅ Added image loading and caching system for tilesets
- ✅ Fixed tile cropping to account for 1px spacing in 3x3 grids
- ✅ Changed default gridSize to 16px to match native tile size
- ✅ Added Express middleware to serve attached_assets as static files
- ✅ Tiles now render with actual textures instead of colored rectangles

### 2025-10-18 - 3x3 Auto-Tiling System Complete
- ✅ Integrated Replit object storage for tileset uploads
- ✅ Created ObjectUploader component for tileset image management
- ✅ Implemented 3x3 auto-tiling algorithm with neighbor detection
- ✅ Fixed auto-tiling logic: single-neighbor cases use edge tiles, not corners
- ✅ Fixed erase logic: neighbors recalculate correctly after tile removal
- ✅ Added three demo tilesets (dirt, grass, water) as 16x16 3x3 grids
- ✅ Tested end-to-end: paint, erase, and mixed terrain all working
- ✅ Independent auto-tiling per tileset verified

### 2025-10-18 - MVP Complete & Tested
- ✅ Implemented complete schema with shapes, tiles, projects, and tilesets
- ✅ Built full canvas system with React-Konva integration
- ✅ Created all UI components with professional dark mode design
- ✅ Implemented Zustand store for state management
- ✅ Set up Y.js collaboration with WebSocket for real-time sync
- ✅ Created REST API for projects and tilesets with Zod validation
- ✅ Integrated WebSocket server for real-time collaboration
- ✅ Connected frontend to backend with React Query
- ✅ Added loading states and error handling
- ✅ Implemented project save/load functionality with canvas hydration
- ✅ Fixed collaboration sync: local mutations propagate to Y.js document
- ✅ Fixed project loading: canvas state properly hydrates from saved projects
- ✅ Added input validation to all API endpoints using Zod schemas
- ✅ Replaced y-websocket provider with custom WebSocket implementation
- ✅ Downgraded react-konva to v18 for React 18 compatibility
- ✅ End-to-end tested: drawing, saving, loading all working correctly

## Design System

The application uses a professional dark-first design system inspired by Figma, Linear, and VS Code:

- **Primary Color**: Blue (#3b82f6) for interactive elements and selections
- **Background**: Deep slate (220 13% 9%) for comfortable long editing sessions
- **Canvas**: Slightly lighter than background (220 13% 11%) for depth
- **Typography**: Inter for UI, JetBrains Mono for coordinates and values
- **Spacing**: Consistent 4px/8px/16px rhythm
- **Components**: Shadcn UI with custom hover/active elevations

## Future Enhancements

### Phase 2 Features (Next)
- Advanced auto-tiling with 47-tile Wang/bitmask system
- AI-powered terrain generation
- Bezier curve drawing tool
- Custom brush system
- Performance optimizations (chunk-based rendering, WebWorkers)

### Planned Features
- Collaborative cursor rendering on canvas
- Shape locking for exclusive editing
- Advanced layer blending modes
- Plugin architecture
- Version control for projects
- Real-time chat between collaborators
- Permission system for shared projects

## Development

The project uses:
- Vite for fast development and builds
- TypeScript for type safety
- ESLint and Prettier (configured)
- Hot module replacement for instant updates

## User Preferences

- Default theme: Dark mode
- Professional productivity tool aesthetic
- Keyboard-first workflow for power users
- Real-time collaboration as core feature
