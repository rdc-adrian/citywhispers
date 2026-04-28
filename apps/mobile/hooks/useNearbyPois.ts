// apps/mobile/hooks/useNearbyPois.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { fetchNearbyPois } from '../lib/api';
import type { PoiSummary } from '@citywhispers/types';

interface UseNearbyPoisOptions {
  latitude: number | null;
  longitude: number | null;
  radius?: number;
  limit?: number;
  enabled?: boolean;
}

export function useNearbyPois({
  latitude,
  longitude,
  radius = 2000,
  limit = 10,
  enabled = true,
}: UseNearbyPoisOptions) {
  const { getToken } = useAuth();

  return useQuery<PoiSummary[], Error>({
    queryKey: ['pois', 'nearby', latitude, longitude, radius, limit],
    queryFn: async () => {
      if (latitude === null || longitude === null) {
        throw new Error('Location is required');
      }

      const token = await getToken();

      return await fetchNearbyPois({
        lat: latitude,
        lng: longitude,
        radius,
        limit,
        token,
      });
    },
    enabled: enabled && latitude !== null && longitude !== null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}
