# Game Development Board

A professional collaborative map editor for game development teams. Build tile-based levels and create game maps in real-time with your team using an infinite canvas with shape tools and tile painting capabilities.

## Overview

This is a real-time collaborative game development board built with:
- **Frontend**: React + TypeScript + React-Konva for canvas rendering
- **State Management**: Zustand for local state
- **Real-time Collaboration**: Y.js CRDT + WebSocket for seamless multi-user editing
- **Backend**: Express.js + WebSocket server
- **Storage**: In-memory storage for projects and tilesets
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
- Tile palette system
- Paint and erase tools
- Tileset management
- Grid-based tile placement

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
│   ├── UserPresence.tsx     # Active user indicators
│   └── ProjectManager.tsx   # Save/Load/Export functionality
├── store/
│   └── useCanvasStore.ts    # Zustand state management
├── services/
│   └── collaboration.ts     # Y.js WebSocket integration
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
└── storage.ts     # In-memory storage implementation
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

### 2025-01-18 - Initial Implementation & Fixes
- Implemented complete schema with shapes, tiles, projects, and tilesets
- Built full canvas system with Konva.js integration
- Created all UI components with professional dark mode design
- Implemented Zustand store for state management
- Set up Y.js collaboration infrastructure with proper two-way sync
- Created REST API for projects and tilesets with Zod validation
- Integrated WebSocket server for real-time collaboration
- Connected frontend to backend with React Query
- Added loading states and error handling
- Implemented project save/load functionality with proper canvas hydration
- Fixed collaboration sync: local mutations now propagate to Y.js document
- Fixed project loading: canvas state now properly hydrates from saved projects
- Added input validation to all API endpoints using Zod schemas

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
- Firebase Storage for cloud tilesets
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
