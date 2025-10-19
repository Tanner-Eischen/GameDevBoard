# Game Development Board

## Overview

This project is a real-time collaborative map editor for game development teams, enabling the creation of tile-based levels and game maps on an infinite canvas with various drawing tools. It aims to provide a professional, efficient environment for team-based game asset creation, focusing on intuitive design and real-time synchronization.

## User Preferences

- Default theme: Dark mode
- Professional productivity tool aesthetic
- Keyboard-first workflow for power users
- Real-time collaboration as core feature

## System Architecture

The application is built with a modern web stack, featuring:

-   **Frontend**: React, TypeScript, React-Konva for canvas rendering, Zustand for local state management, Shadcn UI, and Tailwind CSS for a professional dark mode design.
-   **Backend**: Express.js and a WebSocket server for real-time communication.
-   **Database**: PostgreSQL with Drizzle ORM for persistent storage of project data.
-   **Real-time Collaboration**: Y.js CRDT for conflict-free, multi-user editing.
-   **UI/UX**: Professional dark-first design inspired by Figma, Linear, and VS Code, using a blue primary color, deep slate backgrounds, Inter font for UI, and JetBrains Mono for values.
-   **Canvas & Drawing Tools**: Features an infinite canvas with pan/zoom, shape tools (Rectangle, Circle, Polygon, Star, Line), selection/transformation, multi-select, customizable shape properties, and a grid system with snap-to-grid.
-   **Tile Mapping**: Implements a two-layer tile system (terrain and props) with layer-aware painting, continuous brush painting with adjustable sizes, 3x3 auto-tiling, multi-tile object support (e.g., trees, plateaus), and optimized batching for performance.
-   **AI Assistant**: Integrates an AI assistant for natural language commands to create maps and designs, supporting streaming responses, various canvas operations (paint terrain, create shapes, analyze canvas, clear elements), and safety features with Zod validation.
-   **Project Management**: Includes save/load functionality with auto-save, local storage persistence, auto-load of the last project, export to JSON, and undo/redo history.
-   **Layer Management**: Provides a visual panel for managing layers, including visibility toggling and deletion.
-   **Development**: Uses Vite for fast development, TypeScript for type safety, and ESLint/Prettier for code quality.

## External Dependencies

-   **Real-time Collaboration**: Y.js (CRDT library)
-   **Database**: PostgreSQL (via Drizzle ORM with Neon HTTP driver)
-   **Cloud Storage**: Replit Object Storage (for tileset uploads)
-   **AI**: OpenAI (GPT-4o-mini via Replit AI Integrations)
-   **UI Components**: Shadcn UI
-   **Styling**: Tailwind CSS

## Recent Changes

### October 19, 2025
- **Enhanced AI Assistant with Advanced Natural Language Understanding**:
  - Added 5 new terrain patterns: `horizontal_path`, `vertical_path`, `diagonal_path`, `winding_path`, `curved_path`
  - Implemented Catmull-Rom spline algorithm for realistic curved/winding paths (rivers, roads)
  - New parameters: `pathWidth` (1-20 tiles) and `curveIntensity` (0.1-0.8) for fine control
  - Enhanced function descriptions with comprehensive "Natural Language Interpretation Guide"
  - Improved system prompt with spatial language rules: geometric concepts, aspect ratio understanding, directional language, feature composition, size interpretation
  - AI now correctly interprets: "winding river" → high aspect ratio + curved path, "narrow" → pathWidth 2-4, "through/across" → spans full dimension
  - Example: "paint a grass field with a river winding through it" → Creates 40×30 grass fill + 40×12 winding water path with curveIntensity 0.4
  - Fixed diagonal path boundary issue (paths now correctly terminate at area bounds)
  - Increased Express body size limit to 10MB to handle large canvas states
- **Implemented Terrain-Aware Auto-Tiling System**:
  - Cross-tileset neighbor detection: Terrain tiles now consider ANY terrain tile as a neighbor (not just same tileset)
  - Bidirectional updates: When painting any terrain through another, BOTH tilesets update (painted terrain shows center, neighboring terrain shows edges)
  - Uniform behavior: ALL terrain types update neighbors consistently when painted - no special cases
  - Erase support: Removing terrain tiles updates surrounding terrain to remove edges
  - Implementation uses explicit layer parameter to handle erase scenarios correctly
- **Replaced Three Tileset Images**:
  - **Grass Terrain**: Updated to grass2.png (48x48px, 0px spacing)
  - **Water Terrain**: Updated to river_48x48.png (48x48px, 0px spacing)
  - **Dirt Path**: Updated to dirt_path_grass.png (48x48px, 0px spacing)
- **Added Three New Tilesets**:
  - **Dirt Path**: 3x3 auto-tiling terrain tileset (48x48px, 16x16 tiles, 0px spacing) - Compatible with existing auto-tiling system
  - **Grass Field Variants**: 12x3 variant grid terrain tileset (192x48px, 16x16 tiles, 0px spacing) - Provides 36 different grass tile variants
  - **Plateau Stone**: 3x6 multi-tile prop object (48x87px, 18 tiles total) - Large stone plateau that paints and erases atomically as a complete unit
- **Tileset Count**: Now 11 total tilesets (7 auto-tiling terrain, 1 variant grid, 3 multi-tile props)
- **Verified Multi-Tile Erase**: Confirmed Plateau Stone (3x6) erases all 18 tiles atomically when any tile is clicked
- **Fixed LSP Errors**: Updated MemStorage demo tilesets to include tilesetType and multiTileConfig fields