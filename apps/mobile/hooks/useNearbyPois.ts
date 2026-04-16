import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { fetchNearbyPois, PoiSummary } from '../lib/api'

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
      const token = await getToken()
      return fetchNearbyPois({
        lat: lat!,
        lng: lng!,
        radiusMeters,
        token: token ?? '',
      })
    },
  })
}
