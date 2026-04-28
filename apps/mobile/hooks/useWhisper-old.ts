import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { fetchWhisper } from '../lib/api'
import { getCurrentTimeSlot } from '../lib/time'
import { WhisperResponse } from '@citywhispers/types'

const MOCK_WHISPERS: Record<string, WhisperResponse> = {
  'raffles-city': {
    whisperId: 'w-raffles-city',
    whisperText: 'Stand at the corner of Stamford Road and look up. The aluminum and glass panels catch the afternoon light in the way I.M. Pei intended — geometry doing the work: triangles, squares, concrete beneath it all. Opened in October 1986, this was among Singapore\'s first large-scale integrated developments. The ground you walk through was once a school compound — Raffles Institution stood here from 1823 until 1972.',
    audioUrl: null,
    personaId: 'default',
    unlocked: true,
    cached: true,
  },
  'esplanade': {
    whisperId: 'w-esplanade',
    whisperText: 'The durian shells face Marina Bay — not a whim but a function. Each of the 7,000 aluminium sunshades pivots slightly, tracking the angle of light. Walk the bridge at dusk and watch the shells glow amber. The building opened in 2002. Before it: open ground, a car park, a view unobstructed since the 1800s.',
    audioUrl: null,
    personaId: 'default',
    unlocked: true,
    cached: true,
  },
  'fullerton': {
    whisperId: 'w-fullerton',
    whisperText: 'The columns are original — 1928, Doric order, Palladian face turned toward the river. This was the General Post Office for sixty-eight years. Telegrams passed through here. Ships cleared customs here. The atrium lobby was once an open courtyard, and the floors above held government offices that no longer exist.',
    audioUrl: null,
    personaId: 'default',
    unlocked: true,
    cached: true,
  },
}

export function useWhisper(poiId: string | null) {
  const { getToken } = useAuth()
  const timeSlot = getCurrentTimeSlot()

  return useQuery<WhisperResponse>({
    queryKey: ['whisper', poiId, timeSlot],
    enabled: poiId !== null,
    staleTime: Infinity,
    queryFn: async () => {
      // Return mock data during development
      if (poiId && MOCK_WHISPERS[poiId]) {
        return MOCK_WHISPERS[poiId]
      }

      // Uncomment below when API is running:
      // const token = await getToken()
      // return fetchWhisper({ poiId: poiId!, timeSlot, token: token ?? '' })

      throw new Error('Whisper not found')
    },
  })
}