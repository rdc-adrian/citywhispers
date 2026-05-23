// apps/mobile/hooks/useWhisper.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { fetchWhisper } from '../lib/api';
import { getCurrentTimeSlot } from '../lib/time';
import type { WhisperResponse } from '@citywhispers/types';

interface UseWhisperOptions {
  poiId: string | null | undefined;
  timeSlot?: 'morning' | 'afternoon' | 'evening' | 'night';
  enabled?: boolean;
}

export function useWhisper({
  poiId,
  timeSlot,
  enabled = true,
}: UseWhisperOptions) {
  const { getToken } = useAuth();
  const currentTimeSlot = timeSlot ?? getCurrentTimeSlot();

  return useQuery<WhisperResponse, Error>({
    queryKey: ['whisper', poiId, currentTimeSlot],
    queryFn: async () => {
      if (!poiId) {
        throw new Error('POI ID is required');
      }

      const token = await getToken();
      const result = await fetchWhisper(poiId, currentTimeSlot, token);
      return result;
    },
    enabled: enabled && Boolean(poiId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}
