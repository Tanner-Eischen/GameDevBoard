import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Trash2, Edit2, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTilesetPacks, useCreateTilesetPack, useUpdateTilesetPack, useDeleteTilesetPack } from '@/hooks/useTilesetPacks';

export function TilesetPackPanel() {
  const { data: packs, isLoading } = useTilesetPacks();
  const createPack = useCreateTilesetPack();
  const updatePack = useUpdateTilesetPack();
  const deletePack = useDeleteTilesetPack();
  const { toast } = useToast();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the tileset pack',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createPack.mutateAsync({
        name: formData.name,
        description: formData.description || null,
        tags: [],
      });

      toast({
        title: 'Pack created',
        description: `Created tileset pack "${formData.name}"`,
      });

      setFormData({ name: '', description: '' });
      setShowCreateForm(false);
    } catch (error) {
      toast({
        title: 'Creation failed',
        description: 'Failed to create tileset pack',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the tileset pack',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updatePack.mutateAsync({
        id,
        updates: {
          name: formData.name,
          description: formData.description || null,
        },
      });

      toast({
        title: 'Pack updated',
        description: `Updated tileset pack "${formData.name}"`,
      });

      setFormData({ name: '', description: '' });
      setEditingPackId(null);
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to update tileset pack',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tileset pack "${name}"?`)) return;

    try {
      await deletePack.mutateAsync(id);
      toast({
        title: 'Pack deleted',
        description: `Deleted tileset pack "${name}"`,
      });
    } catch (error) {
      toast({
        title: 'Deletion failed',
        description: 'Failed to delete tileset pack',
        variant: 'destructive',
      });
    }
  };

  const startEdit = (pack: any) => {
    setEditingPackId(pack.id);
    setFormData({ name: pack.name, description: pack.description || '' });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingPackId(null);
    setFormData({ name: '', description: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Loading packs...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Tileset Packs</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setEditingPackId(null);
            setFormData({ name: '', description: '' });
          }}
          data-testid="button-create-pack"
        >
          {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {showCreateForm && (
            <div className="p-3 bg-muted/30 rounded-md space-y-2" data-testid="form-create-pack">
              <Input
                placeholder="Pack name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-pack-name"
              />
              <Textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="resize-none h-20"
                data-testid="input-pack-description"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={createPack.isPending}
                  data-testid="button-save-pack"
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ name: '', description: '' });
                  }}
                  data-testid="button-cancel-pack"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {packs && packs.length === 0 && !showCreateForm && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tileset packs yet. Create one to group related tilesets.
            </p>
          )}

          {packs?.map((pack) => (
            <div
              key={pack.id}
              className="p-3 bg-card rounded-md border space-y-2"
              data-testid={`pack-item-${pack.id}`}
            >
              {editingPackId === pack.id ? (
                <>
                  <Input
                    placeholder="Pack name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid={`input-edit-pack-name-${pack.id}`}
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="resize-none h-20"
                    data-testid={`input-edit-pack-description-${pack.id}`}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(pack.id)}
                      disabled={updatePack.isPending}
                      data-testid={`button-save-edit-${pack.id}`}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      data-testid={`button-cancel-edit-${pack.id}`}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm" data-testid={`text-pack-name-${pack.id}`}>
                        {pack.name}
                      </h4>
                      {pack.description && (
                        <p className="text-xs text-muted-foreground mt-1" data-testid={`text-pack-description-${pack.id}`}>
                          {pack.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(pack)}
                        data-testid={`button-edit-${pack.id}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleDelete(pack.id, pack.name)}
                        data-testid={`button-delete-${pack.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
