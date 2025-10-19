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

## Deployment Options

### GitHub Workflow (Recommended)
This project supports a seamless Git-based workflow:

1. **Push from Replit** → GitHub repository
2. **Clone elsewhere** → Make edits locally or on other machines
3. **Push changes** → Back to GitHub
4. **Pull into Replit** → Use Git pane or Shell to sync
5. **Deploy from Replit** → Publish with all integrations intact

**Benefits:**
- Environment variables and secrets stay in Replit (no need to commit them)
- Edit locally with your preferred IDE
- Deploy from Replit's infrastructure with zero reconfiguration
- Automatic checkpoints created by Replit Agent

**Authentication:**
- For private repos, use GitHub personal access token
- Store in Replit Secrets as `GIT_URL`: `https://<username>:<token>@github.com/<user>/<repo>`
- Use `git push $GIT_URL` to push without re-entering credentials

### Deploying from Replit
- Use Replit's built-in publishing feature for production deployment
- Supports custom domains and automatic HTTPS
- All Replit integrations (database, object storage, AI) remain connected
- No additional configuration needed

## Environment Variables & Dependencies

### Required Environment Variables
The following environment variables are used by this application and are automatically provided by Replit integrations:

**Database Integration (Required):**
- **`DATABASE_URL`**: PostgreSQL connection string (Neon-backed, auto-configured)

**AI Integration (Required):**
- **`AI_INTEGRATIONS_OPENAI_API_KEY`**: OpenAI API key (auto-managed, rotated automatically)
- **`AI_INTEGRATIONS_OPENAI_BASE_URL`**: OpenAI API endpoint (Replit proxy for rate limiting)

**Object Storage Integration (Optional):**
- **`PUBLIC_OBJECT_SEARCH_PATHS`**: Search paths for public assets (defaults to empty if not set)
- **`PRIVATE_OBJECT_DIR`**: Directory for private objects (defaults to empty if not set)

These variables are automatically set when you add the respective integrations to your Replit project. The database and AI integrations are required for the application to function. Object storage variables have safe defaults.

### Replit-Specific Integrations
These services are integrated and managed by Replit:

1. **Object Storage** (`server/objectStorage.ts`)
   - Uses Google Cloud Storage via Replit sidecar endpoint
   - Automatic credential management
   - Used for tileset image uploads

2. **AI Integration** (`server/ai/openai.ts`)
   - OpenAI API access via Replit proxy
   - Automatic API key rotation
   - Rate limiting and quota management

3. **PostgreSQL Database** (`server/db.ts`)
   - Neon-backed PostgreSQL with HTTP driver
   - Automatic backups and scaling
   - Migration-free schema updates via `npm run db:push`

## Recent Changes

### October 19, 2025
- **Fixed Three Critical Bugs in Sprite Animation System**:
  - **Bug #1 - Property Name Mismatch**: Fixed demo sprite definitions using `frameRate` instead of `fps` to match SpriteDefinition interface. All 6 animation states (idle, walk, run, attack, hurt, die) now use correct property name.
  - **Bug #2 - Double Frame Indexing**: Fixed SpriteAnimator incorrectly indexing into frames array twice. `currentFrame` already contains the frame number from `animation.frames[frameIndex]`, so removed redundant array access at line 73.
  - **Bug #3 - Double Scaling**: Fixed sprite rendering applying scale twice (once via width/height, once via scaleX/scaleY). Changed scaleX/scaleY to only handle flipping (1 or -1), not scaling. Also fixed offsetX/offsetY to account for scale when flipping.
  - Added missing `defaultAnimation` and `tags` properties to knight sprite definition
  - Animation system now fully functional with correct frame timing, scaling, and flipping
- **Added Swordsman Sprite Sheets**:
  - Integrated three swordsman sprite animations (Idle, Walk, Attack)
  - Each sprite is 64×64 pixels per frame
  - Idle: 12 frames at 10 fps (looping)
  - Walk: 6 frames at 10 fps (looping)
  - Attack: 8 frames at 12 fps (non-looping)
  - All sprites use down-facing direction (row 0) from multi-directional sprite sheets
  - Sprite sheets copied to public/sprites/ directory
  - Now have 4 total sprite definitions available: Knight, Swordsman (Idle), Swordsman (Walk), Swordsman (Attack)
- **Fixed Sprite Collaboration Bug**:
  - Added missing `spritesArray` to Y.js CollaborationService
  - Implemented `addSprite()`, `updateSprite()`, and `deleteSprite()` methods in collaboration service
  - Added sprite observer to sync remote sprite changes to local store
  - Updated store methods to properly notify collaboration service with sprite index
  - Fixed "Unexpected end of array" error when adding sprites to canvas
  - Fixed prop name mismatch in Canvas component (`spriteDef` → `definition`)
  - Added missing store variables to Canvas component (`selectedSpriteId`, `animationPreview`, `updateSprite`)
  - Sprites now fully synchronized across multiple users in real-time
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
- **Tileset Count**: Now 14 total tilesets (7 auto-tiling terrain, 1 variant grid, 6 multi-tile props)
- **Verified Multi-Tile Erase**: Confirmed Plateau Stone (3x6) erases all 18 tiles atomically when any tile is clicked
- **Fixed LSP Errors**: Updated MemStorage demo tilesets to include tilesetType and multiTileConfig fields
- **AI Assistant Object Placement Feature**:
  - Added `placeObject` AI function to place multi-tile prop objects using natural language commands
  - Supports 5 object types: Tree1, Tree2, Tent, Campfire 1, Campfire 2, Plateau Stone
  - Three placement modes:
    - **Single**: Place one object at specific coordinates ("place a tent at 10, 10")
    - **Scatter**: Randomly place 2-5 objects in an area ("scatter campfires around the map")
    - **Grid**: Organize objects in a grid pattern ("place trees in a grid from 0, 0 to 30, 30")
  - Fixed tile index calculation bug in both Canvas component and AI executor
  - Tile index now correctly calculated as `tilePos.y * tileset.columns + tilePos.x`
  - Added bounds validation to prevent invalid tile positions
  - Integrated with Y.js collaboration service for real-time synchronization
- **Added Three New Prop Tilesets**:
  - **Tent**: 2x2 multi-tile object (32x32px, merged from 4 cells with 1px spacing removed)
  - **Campfire Variant 1**: 1x1 multi-tile object (17x16px)
  - **Campfire Variant 2**: 1x1 multi-tile object (17x16px)
- **E2E Testing**: Verified AI object placement with Playwright tests confirming correct tile placement and Y.js synchronization
- **Added Variant Grid Tileset Type**:
  - Created new `variant_grid` tileset type for tilesets that don't use auto-tiling (manual tile variant selection)
  - Added to tilesetTypeEnum: `'auto-tiling' | 'multi-tile' | 'variant_grid'`
  - Updated Grass Field Variants tileset to use variant_grid type
  - Variant grid tilesets paint with the exact tile index the user selects (no auto-tiling algorithm)
  - Fixes issue where Grass Field Variants was incorrectly applying auto-tiling logic
- **Fixed Auto-Tiling Layer Detection Bug**:
  - Updated getNeighborConfig() to accept explicit layer parameter ('terrain' | 'props')
  - Prevents bug where newly painted tiles couldn't determine their layer
  - Ensures terrain tiles correctly recognize ANY terrain tile as a neighbor (cross-tileset)
  - Fixes issue where painting grass on grass incorrectly used edge tiles instead of center tile