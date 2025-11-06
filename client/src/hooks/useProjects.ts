import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Project, InsertProject } from '@shared/schema';
import { useAuth } from '@/contexts/AuthContext';

export function useProjects() {
  const { user } = useAuth();
  
  return useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: !!user, // Only fetch when user is authenticated
  });
}

export function useProject(id: string | null) {
  return useQuery<Project>({
    queryKey: ['/api/projects', id],
    enabled: !!id,
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: async (data: InsertProject) => {
      return await apiRequest('POST', '/api/projects', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });
}

export function useUpdateProject() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProject> }) => {
      return await apiRequest('PATCH', `/api/projects/${id}`, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
    },
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });
}
