import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { TilesetPack, InsertTilesetPack } from '@shared/schema';

export function useTilesetPacks() {
  return useQuery<TilesetPack[]>({
    queryKey: ['/api/tileset-packs'],
  });
}

export function useCreateTilesetPack() {
  return useMutation({
    mutationFn: async (pack: InsertTilesetPack) => {
      const response = await apiRequest('POST', '/api/tileset-packs', pack);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tileset-packs'] });
    },
  });
}

export function useUpdateTilesetPack() {
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsertTilesetPack> }) => {
      const response = await apiRequest('PUT', `/api/tileset-packs/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tileset-packs'] });
    },
  });
}

export function useDeleteTilesetPack() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/tileset-packs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tileset-packs'] });
    },
  });
}
