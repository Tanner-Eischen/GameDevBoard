import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useProjects, useCreateProject, useUpdateProject } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, FolderOpen, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ProjectManager() {
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [projectName, setProjectName] = useState('');
  const { currentProjectName, currentProjectId, setCurrentProject, shapes, tiles, zoom, pan, gridSize } = useCanvasStore();
  const { toast } = useToast();

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const handleSave = async () => {
    const canvasState = {
      shapes,
      selectedIds: [],
      tool: 'select' as const,
      zoom,
      pan,
      gridSize,
      gridVisible: true,
      snapToGrid: false,
    };

    const tileMap = {
      gridSize,
      tiles,
    };

    const name = projectName || currentProjectName;

    try {
      if (currentProjectId) {
        await updateProject.mutateAsync({
          id: currentProjectId,
          data: { name },
        });
        toast({
          title: 'Project Updated',
          description: `"${name}" has been updated successfully.`,
        });
      } else {
        const project = await createProject.mutateAsync({
          name,
        });
        setCurrentProject(project.id, project.name);
        toast({
          title: 'Project Saved',
          description: `"${name}" has been saved successfully.`,
        });
      }
      setShowSave(false);
      setProjectName('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save project. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleLoad = async (projectId: string) => {
    // Project loading will update the canvas state
    const project = projects?.find(p => p.id === projectId);
    if (project) {
      // For projects with boards, load the first board's state
      const projectWithBoards = project as any;
      if (projectWithBoards.boards && projectWithBoards.boards.length > 0) {
        const firstBoard = projectWithBoards.boards[0];
        useCanvasStore.setState({
          shapes: firstBoard.canvasState?.shapes || [],
          tiles: firstBoard.tileMap?.tiles || [],
          zoom: firstBoard.canvasState?.zoom || 1,
          pan: firstBoard.canvasState?.pan || { x: 0, y: 0 },
          gridSize: firstBoard.canvasState?.gridSize || 32,
        });
      } else {
        // Fallback for legacy projects without boards
        useCanvasStore.setState({
          shapes: [],
          tiles: [],
          zoom: 1,
          pan: { x: 0, y: 0 },
          gridSize: 32,
        });
      }
      setCurrentProject(project.id, project.name);
      
      // Sync loaded data to collaboration document
      if ((window as any).__collaborationService) {
        (window as any).__collaborationService.syncFromLocal();
      }
      
      toast({
        title: 'Project Loaded',
        description: `"${project.name}" has been loaded successfully.`,
      });
      setShowLoad(false);
    }
  };

  const handleExport = () => {
    const state = useCanvasStore.getState();
    const data = {
      shapes: state.shapes,
      tiles: state.tiles,
      canvasState: {
        shapes: state.shapes,
        sprites: state.sprites,
        selectedIds: state.selectedIds,
        tool: state.tool,
        zoom: state.zoom,
        pan: state.pan,
        gridSize: state.gridSize,
        gridVisible: state.gridVisible,
        snapToGrid: state.snapToGrid,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProjectName || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Project Exported',
      description: 'Your project has been downloaded as JSON.',
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" data-testid="button-save-project">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Project</DialogTitle>
            <DialogDescription>
              Give your project a name to save it
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="My Awesome Map"
                value={projectName || currentProjectName}
                onChange={(e) => setProjectName(e.target.value)}
                data-testid="input-project-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSave(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-confirm-save">
              Save Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoad} onOpenChange={setShowLoad}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" data-testid="button-load-project">
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Project</DialogTitle>
            <DialogDescription>
              Select a project to load
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-auto space-y-2">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : projects && projects.length > 0 ? (
              projects.map((project) => (
                <Button
                  key={project.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleLoad(project.id)}
                  data-testid={`button-load-project-${project.id}`}
                >
                  <div className="flex flex-col items-start">
                    <span>{project.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No saved projects yet. Create and save your first project!
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLoad(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button size="sm" variant="ghost" onClick={handleExport} data-testid="button-export-project">
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    </div>
  );
}
