import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { TilesetData, InsertTileset } from '@shared/schema';
import { useAuth } from '@/contexts/AuthContext';

export function useTilesets() {
  const { user } = useAuth();
  
  return useQuery<TilesetData[]>({
    queryKey: ['/api/tilesets'],
    // Always enabled - API will return built-in tilesets for unauthenticated users
    // and all tilesets for authenticated users
    queryFn: async () => {
      return await apiRequest('GET', '/api/tilesets');
    },
  });
}

export function useTileset(id: string | null) {
  return useQuery<TilesetData>({
    queryKey: ['/api/tilesets', id],
    enabled: !!id,
    queryFn: async () => {
      return await apiRequest('GET', `/api/tilesets/${id}`);
    },
  });
}

export function useCreateTileset() {
  return useMutation({
    mutationFn: async (data: InsertTileset) => {
      return await apiRequest('POST', '/api/tilesets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tilesets'] });
    },
  });
}

export function useDeleteTileset() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/tilesets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tilesets'] });
    },
  });
}
