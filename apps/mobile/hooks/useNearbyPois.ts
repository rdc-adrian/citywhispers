// apps/mobile/hooks/useNearbyPois.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  return useQuery<PoiSummary[], Error>({
    queryKey: ['pois', 'nearby', latitude, longitude, radius, limit],
    queryFn: async () => {
      if (latitude === null || longitude === null) {
        throw new Error('Location is required');
      }

      // POI lookup is public — no auth token, avoids Clerk JWKS verification on the server
      return await fetchNearbyPois({ lat: latitude, lng: longitude, radius, limit });
    },
    enabled: enabled && latitude !== null && longitude !== null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });
}
