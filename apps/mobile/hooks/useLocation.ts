import { useEffect, useState } from 'react'
import * as Location from 'expo-location'

interface LocationState {
  latitude: number | null
  longitude: number | null
  granted: boolean
  loading: boolean
  error: string | null
}

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    granted: false,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setState((s) => ({ ...s, loading: false, error: 'Permission denied', granted: false }))
        return
      }

      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setState({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        granted: true,
        loading: false,
        error: null,
      })

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
        (loc) =>
          setState((s) => ({
            ...s,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          }))
      )
    }

    start()
    return () => {
      sub?.remove()
    }
  }, [])

  return state
}
