import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TilesetPanel } from '@/components/TilesetPanel';
import { SpritePanel } from '@/components/SpritePanel';

export function ResourceSidebar() {
  return (
    <Tabs defaultValue="tiles" className="flex h-full flex-col">
      <TabsList className="grid grid-cols-2">
        <TabsTrigger value="tiles">Tiles</TabsTrigger>
        <TabsTrigger value="sprites">Sprites</TabsTrigger>
      </TabsList>

      <TabsContent value="tiles" className="mt-4 flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <div className="space-y-4 pb-4">
            <TilesetPanel />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="sprites" className="mt-4 flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <div className="space-y-4 pb-4">
            <SpritePanel />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
