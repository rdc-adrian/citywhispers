import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { fetchWhisper } from '../lib/api'
import { getCurrentTimeSlot } from '../lib/time'
import { WhisperResponse } from '@citywhispers/types'

export function useWhisper(poiId: string | null) {
  const { getToken } = useAuth()
  const timeSlot = getCurrentTimeSlot()

  return useQuery<WhisperResponse>({
    queryKey: ['whisper', poiId, timeSlot],
    enabled: poiId !== null,
    staleTime: Infinity,
    queryFn: async () => {
      const token = await getToken()
      return fetchWhisper({
        poiId: poiId!,
        timeSlot,
        token: token ?? '',
      })
    },
  })
}
