# Game Development Board

## Overview
This project is a real-time collaborative map editor designed for game development teams. It facilitates the creation of tile-based levels and game maps on an infinite canvas, offering various drawing tools. The primary goal is to provide a professional, efficient, and intuitive environment for team-based game asset creation with a strong focus on real-time synchronization. The project aims to enhance productivity and streamline the level design process for game developers.

## User Preferences
- Default theme: Dark mode
- Professional productivity tool aesthetic
- Keyboard-first workflow for power users
- Real-time collaboration as core feature

## System Architecture
The application is built with a modern web stack, emphasizing real-time collaboration and a professional user experience.

**UI/UX Decisions:**
- Professional dark-first design inspired by Figma, Linear, and VS Code.
- Uses a blue primary color, deep slate backgrounds, Inter font for UI, and JetBrains Mono for values.
- Features a responsive layout with accessible panel management.

**Technical Implementations & Feature Specifications:**
- **Frontend**: React, TypeScript, React-Konva for canvas rendering, Zustand for local state management, Shadcn UI, and Tailwind CSS.
-   **Backend**: Express.js and a WebSocket server for real-time communication.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Real-time Collaboration**: Y.js CRDT for conflict-free, multi-user editing, enabling shared canvas state, sprite synchronization, and object placement.
-   **Canvas & Drawing Tools**: Infinite canvas with pan/zoom, various shape tools (Rectangle, Circle, Polygon, Star, Line), selection/transformation, multi-select, customizable shape properties, and a grid system with snap-to-grid.
-   **Tile Mapping**: Two-layer tile system (terrain and props) with layer-aware painting, continuous brush painting, adjustable brush sizes, 3x3 auto-tiling with cross-tileset neighbor detection, multi-tile object support, and optimized batching. Includes variant grid tilesets for manual tile selection.
-   **AI Assistant**: Integrates an AI assistant for natural language commands, supporting map creation, design operations (e.g., paint terrain, create shapes, analyze canvas, clear elements, place objects), streaming responses, and safety features with Zod validation. Enhanced with advanced natural language understanding for spatial concepts and various terrain patterns.
-   **Project Management**: Save/load functionality, auto-save, local storage persistence, auto-load of the last project, export to JSON, and undo/redo history.
-   **Layer Management**: Visual panel for managing layers, including visibility toggling and deletion.
-   **Sprite Animation System**: Supports sprite definitions with animations, frame rates, scaling, and flipping, fully synchronized across collaborators.
-   **Development**: Vite for fast development, TypeScript for type safety, ESLint/Prettier for code quality.

## External Dependencies
-   **Real-time Collaboration**: Y.js (CRDT library)
-   **Database**: PostgreSQL (via Drizzle ORM with Neon HTTP driver)
-   **Cloud Storage**: Replit Object Storage (for tileset uploads)
-   **AI**: OpenAI (GPT-4o-mini via Replit AI Integrations)
-   **UI Components**: Shadcn UI
-   **Styling**: Tailwind CSS