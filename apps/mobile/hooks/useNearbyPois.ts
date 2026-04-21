import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { fetchNearbyPois, PoiSummary } from '../lib/api'

// Mock data for development — remove when API is running
const MOCK_POIS: PoiSummary[] = [
  {
    id: 'raffles-city',
    name: 'Raffles City',
    latitude: 1.2931,
    longitude: 103.8534,
    category: 'landmark',
    hasWhisper: true,
    distanceMeters: 340,
    visited: false,
  },
  {
    id: 'esplanade',
    name: 'Esplanade',
    latitude: 1.2899,
    longitude: 103.8553,
    category: 'landmark',
    hasWhisper: true,
    distanceMeters: 820,
    visited: false,
  },
  {
    id: 'fullerton',
    name: 'The Fullerton',
    latitude: 1.2868,
    longitude: 103.8519,
    category: 'landmark',
    hasWhisper: true,
    distanceMeters: 180,
    visited: false,
  },
]

interface Params {
  lat: number | null
  lng: number | null
  radiusMeters?: number
}

export function useNearbyPois({ lat, lng, radiusMeters = 500 }: Params) {
  const { getToken } = useAuth()

  return useQuery<PoiSummary[]>({
    queryKey: ['pois', 'nearby', lat, lng, radiusMeters],
    enabled: lat !== null && lng !== null,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      // Return mock data during development
      return MOCK_POIS

      // Uncomment below when API is running:
      // const token = await getToken()
      // return fetchNearbyPois({ lat: lat!, lng: lng!, radiusMeters, token: token ?? '' })
    },
  })
}