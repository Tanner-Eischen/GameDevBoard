import { useCanvasStore } from '@/store/useCanvasStore';
import { MousePointer2 } from 'lucide-react';

export function CursorOverlay() {
  const { users, currentUser, zoom, pan } = useCanvasStore();

  // Don't render if no users
  if (users.size === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
      {Array.from(users.values()).map((user) => {
        // Skip current user and users without cursor positions
        if (!user.cursor || user.id === currentUser?.id) return null;

        // Transform cursor position to screen coordinates
        const screenX = (user.cursor.x * zoom) + pan.x;
        const screenY = (user.cursor.y * zoom) + pan.y;

        return (
          <div
            key={user.id}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: screenX,
              top: screenY,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Cursor Arrow */}
            <MousePointer2
              className="drop-shadow-md"
              style={{
                color: user.color,
                fill: user.color,
                width: 20,
                height: 20,
              }}
            />
            
            {/* User Label */}
            <div
              className="ml-5 -mt-1 px-2 py-1 rounded text-xs font-medium text-white shadow-md whitespace-nowrap"
              style={{
                backgroundColor: user.color,
              }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
