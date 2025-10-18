# Game Development Board - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Professional Productivity Tools)

**Primary References:** Figma (canvas-focused design tools), Linear (clean productivity UI), VS Code (developer aesthetic)

**Design Philosophy:** Create a professional, performance-focused collaborative workspace that prioritizes clarity, efficiency, and seamless multi-user interaction. The interface should feel powerful yet approachable, with visual elements that enhance rather than distract from the creative work.

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background: 220 13% 9% (deep slate)
- Surface: 220 13% 13% (raised panels)
- Surface Elevated: 220 13% 16% (floating UI)
- Border: 220 13% 20% (subtle dividers)
- Text Primary: 220 13% 95%
- Text Secondary: 220 9% 65%
- Primary Brand: 217 91% 60% (vibrant blue for actions)
- Success: 142 71% 45% (operation confirmations)
- Warning: 38 92% 50% (caution states)
- Danger: 0 84% 60% (destructive actions)
- Canvas Background: 220 13% 11% (workspace area)

**User Presence Colors:** (for collaborative cursors/selections)
- Set of 8 distinct, vibrant colors: 217 91% 60%, 142 71% 45%, 38 92% 50%, 271 81% 56%, 168 76% 42%, 24 94% 50%, 291 64% 42%, 199 89% 48%

### B. Typography

**Font Families:**
- Primary: 'Inter' (UI elements, labels, buttons)
- Monospace: 'JetBrains Mono' (coordinates, numerical inputs, code)

**Scale:**
- Headings: 600 weight, 16px (panel titles)
- Body: 400 weight, 14px (labels, descriptions)
- Small: 400 weight, 12px (hints, metadata)
- Mono: 400 weight, 13px (inputs, values)

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16 for consistent rhythm
- Tight spacing: p-2, gap-2 (toolbar items, icon groups)
- Standard: p-4, gap-4 (panel sections, form fields)
- Generous: p-8, gap-8 (major panel separations)

**Grid System:**
- Application shell uses CSS Grid with fixed sidebars
- Left sidebar: 280px (tools, layers)
- Right sidebar: 320px (properties, assets)
- Canvas: flex-1 (remaining space)
- Responsive breakpoint: Collapse sidebars to overlay panels below 1280px

### D. Component Library

**Navigation & Controls:**
- Top Toolbar: h-14 with glass morphism effect (backdrop-blur-md bg-surface/80)
- Tool Palette: Vertical icon grid with active state (ring-2 ring-primary)
- Contextual Menus: Dropdown panels with shadow-2xl
- Breadcrumbs: Canvas path/zoom level indicator

**Canvas UI:**
- Grid Overlay: Subtle dotted pattern (opacity-20)
- Ruler Guides: Top and left edges with measurement marks
- Selection Handles: 6px squares in primary color with white border
- Bounding Box: 2px dashed border in primary
- User Cursors: SVG arrows with username label below

**Panels & Inspectors:**
- Panel Headers: Collapsible with chevron icon, uppercase 11px tracking-wide text
- Property Rows: label + control pairs with gap-3
- Accordion Sections: Grouped properties with subtle dividers
- Tabs: Underlined active state with primary color

**Input Controls:**
- Text Fields: Rounded border, focus ring in primary, h-9
- Number Inputs: Inline steppers with +/- buttons
- Sliders: Track height 4px, thumb 14px circle
- Color Pickers: Swatch preview + hex input + full picker popover
- Dropdowns: Chevron indicator, max-height with scroll

**Tile & Asset Management:**
- Tileset Grid: Auto-grid with gap-2, hover scale effect
- Tile Preview: 64x64 or 96x96 squares with border on hover
- Asset Cards: Image preview + name label + metadata
- Drag Handles: Dotted outline during drag operation

**Collaboration UI:**
- User Avatar Stack: Overlapping circles (-ml-2) in top-right
- Active User List: Expandable panel with colored presence dots
- Cursor Labels: Name tag with background matching user color
- Selection Overlay: Semi-transparent fill with user color (opacity-10)

**Buttons & Actions:**
- Primary: bg-primary text-white rounded-md h-9 px-4
- Secondary: bg-surface-elevated border border-subtle
- Icon Buttons: 9x9 square, rounded hover:bg-surface-elevated
- Tool Buttons: Toggle state with ring indicator
- Floating Action Button: Bottom-right corner for primary actions

**Data Display:**
- Layer List: Drag-drop reorderable with eye icon for visibility
- History Timeline: Vertical list with undo/redo indicators
- Coordinates Display: Fixed bottom-left showing mouse position
- Zoom Level: Bottom-right percentage with +/- controls

**Feedback & Overlays:**
- Toast Notifications: Top-right, slide-in animation, 4s auto-dismiss
- Loading States: Skeleton screens for async panels
- Empty States: Icon + message + CTA for blank panels
- Confirmation Modals: Center overlay with backdrop blur

### E. Animations

**Minimal & Purposeful:**
- Panel Transitions: duration-200 ease-out for expand/collapse
- Hover Effects: scale-105 for interactive elements
- Tool Selection: Quick fade-in for active ring (duration-100)
- No gratuitous animations on canvas operations
- Smooth cursor tracking for collaborative users (requestAnimationFrame)

## Special Considerations

**Canvas Optimization:**
- Use neutral backgrounds to reduce eye strain during long sessions
- Implement anti-aliasing for crisp shape rendering
- Subtle grid that doesn't compete with content
- High contrast selection states for visibility

**Collaboration Indicators:**
- Each user gets consistent color assignment
- Show user activity with subtle pulse on their cursor
- Display usernames on hover to avoid clutter
- Indicate locked objects with padlock icon overlay

**Performance Visual Feedback:**
- Show loading spinner for tile uploads
- Display sync status icon in toolbar
- Indicate connection state with dot indicator (green/yellow/red)
- Progressive rendering feedback for large maps

**Accessibility:**
- Maintain 4.5:1 contrast ratios for text
- Keyboard shortcuts visible in tooltips
- Focus indicators on all interactive elements
- Screen reader labels for icon-only controls

This design creates a professional, efficient workspace that balances powerful functionality with visual clarity, ensuring users can focus on their creative work while seamlessly collaborating with team members.