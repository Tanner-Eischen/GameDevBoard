import { useCanvasStore } from '@/store/useCanvasStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const USER_COLORS = [
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(271 81% 56%)',
  'hsl(168 76% 42%)',
  'hsl(24 94% 50%)',
  'hsl(291 64% 42%)',
  'hsl(199 89% 48%)',
];

export function UserPresence() {
  const { users, currentUser } = useCanvasStore();

  const allUsers = [
    ...(currentUser ? [currentUser] : []),
    ...Array.from(users.values()),
  ];

  if (allUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-1 p-2">
      <span className="text-xs text-muted-foreground mr-2">
        {allUsers.length} {allUsers.length === 1 ? 'user' : 'users'}
      </span>
      <div className="flex -space-x-2">
        {allUsers.slice(0, 5).map((user, index) => {
          const initials = user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <Tooltip key={user.id}>
              <TooltipTrigger>
                <Avatar
                  className="h-8 w-8 border-2 border-background"
                  style={{
                    backgroundColor: user.color || USER_COLORS[index % USER_COLORS.length],
                  }}
                  data-testid={`avatar-user-${user.id}`}
                >
                  <AvatarFallback className="text-xs font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.tool}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {allUsers.length > 5 && (
        <span className="text-xs text-muted-foreground ml-1">
          +{allUsers.length - 5}
        </span>
      )}
    </div>
  );
}
