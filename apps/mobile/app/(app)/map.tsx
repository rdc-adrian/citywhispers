import React, { useRef, useEffect, useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native'
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '@clerk/clerk-expo'
import { useLocation } from '../../hooks/useLocation'
import { useNearbyPois } from '../../hooks/useNearbyPois'
import { useWhisperStore } from '../../store/useWhisperStore'
import { PoiMarker } from '../../components/map/PoiMarker'
import { NearbyBadge } from '../../components/map/NearbyBadge'
import { fetchWhisper } from '../../lib/api'
import { getCurrentTimeSlot } from '../../lib/time'
import type { PoiSummary } from '@citywhispers/types'

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f0e0c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5c5650' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f0e0c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f1d19' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#272420' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0908' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

// Subtle time-of-day label shown as the gold eyebrow on the card
function getAmbientLabel(): string {
  const hour = new Date().getHours()
  if (hour >= 22 || hour < 2) return 'Near midnight'
  if (hour >= 2 && hour < 5) return 'Dead of night'
  if (hour >= 5 && hour < 7) return 'Before dawn'
  if (hour >= 7 && hour < 11) return 'Morning light'
  if (hour >= 11 && hour < 14) return 'High noon'
  if (hour >= 14 && hour < 17) return 'Afternoon heat'
  if (hour >= 17 && hour < 20) return 'Golden hour'
  return 'After dark'
}

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const location = useLocation()
  const { getToken } = useAuth()

  // Round to 4 dp (~11 m) so GPS noise doesn't create a new query key on
  // every location tick or sub-pixel map movement.
  function roundCoord(n: number) { return Math.round(n * 10000) / 10000 }

  const [mapCenter, setMapCenter] = useState({
    latitude: 1.2966,
    longitude: 103.852,
  })

  // Track which POI is currently loading so we can show a spinner on the marker
  const [loadingPoiId, setLoadingPoiId] = useState<string | null>(null)

  const { data: pois, isLoading: poisLoading, error: poisError, refetch: refetchPois } = useNearbyPois({
    latitude: mapCenter.latitude,
    longitude: mapCenter.longitude,
  })

  const openWhisper = useWhisperStore((s) => s.openWhisper)
  const discoveredPoiIds = useWhisperStore((s) => s.discoveredPoiIds)

  // Animate to user location on first GPS fix
  useEffect(() => {
    if (location.latitude && location.longitude) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800
      )
      setMapCenter({
        latitude: roundCoord(location.latitude),
        longitude: roundCoord(location.longitude),
      })
    }
  }, [location.latitude, location.longitude])

  function handleRegionChangeComplete(region: Region) {
    setMapCenter({ latitude: roundCoord(region.latitude), longitude: roundCoord(region.longitude) })
  }

  // Tap a marker → fetch whisper → open card
  const handlePoiPress = useCallback(async (poi: PoiSummary) => {
    if (loadingPoiId === poi.id) return

    const isRevisit = discoveredPoiIds.has(poi.id)

    try {
      setLoadingPoiId(poi.id)
      const token = await getToken()
      const timeSlot = getCurrentTimeSlot()
      const whisper = await fetchWhisper(poi.id, timeSlot, token)

      // Build nearby list from the other visible POIs (closest 2, excluding self)
      const nearby = (pois ?? [])
        .filter((p) => p.id !== poi.id)
        .slice(0, 2)
        .map((p) => ({
          id: p.id,
          name: p.name,
          distanceMeters: p.distance ?? 150,
        }))

      openWhisper({
        poiId: poi.id,
        poiName: poi.name,
        category: poi.category,
        whisperId: whisper.id,
        whisperText: whisper.whisperText,
        audioUrl: whisper.audioUrl,
        timeSlot: whisper.timeSlot,
        personaSlug: whisper.personaSlug,
        ambientLabel: getAmbientLabel(),
        nearby,
        isRevisit,
      })
    } catch (err) {
      console.warn('⚠️ Failed to fetch whisper for', poi.name, err)
      // Open card with text-only fallback so the user sees something
      openWhisper({
        poiId: poi.id,
        poiName: poi.name,
        category: poi.category,
        whisperId: '',
        whisperText: 'No whisper available for this location yet.',
        audioUrl: null,
        timeSlot: getCurrentTimeSlot(),
        personaSlug: '',
        ambientLabel: getAmbientLabel(),
        nearby: [],
        isRevisit,
      })
    } finally {
      setLoadingPoiId(null)
    }
  }, [pois, getToken, openWhisper, loadingPoiId, discoveredPoiIds])

  // Nearby whisper tap inside the card — look up and open
  const handleNearbyPress = useCallback(async (poiId: string) => {
    const target = pois?.find((p) => p.id === poiId)
    if (target) handlePoiPress(target)
  }, [pois, handlePoiPress])

  // Register the nearby-press handler in the store so WhisperCard (now mounted
  // in the layout) can call it when a nearby suggestion is tapped.
  // Cleared on unmount so Journal-opened whispers don't inherit a stale callback.
  const setNearbyPressHandler = useWhisperStore((s) => s.setNearbyPressHandler)
  useEffect(() => {
    setNearbyPressHandler(handleNearbyPress)
    return () => setNearbyPressHandler(null)
  }, [handleNearbyPress])

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0e0c' }}>
      <StatusBar style="light" />

      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        customMapStyle={MAP_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude: 1.2966,
          longitude: 103.852,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {pois?.map((poi) => (
          <PoiMarker
            key={poi.id}
            poi={poi}
            isDiscovered={discoveredPoiIds.has(poi.id)}
            onPress={handlePoiPress}
            isLoading={loadingPoiId === poi.id}
          />
        ))}
      </MapView>

      {/* Top bar */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'rgba(23,22,19,0.92)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#5c5650', fontSize: 14 }}>Search places...</Text>
        </View>

        {!poisLoading && pois && pois.length > 0 && (
          <NearbyBadge count={pois.length} />
        )}

        {poisLoading && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(23,22,19,0.8)',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              alignSelf: 'flex-start',
            }}
          >
            <ActivityIndicator size="small" color="#c8a96e" />
            <Text style={{ color: '#5c5650', fontSize: 11 }}>Finding whispers...</Text>
          </View>
        )}

        {location.error && (
          <View
            style={{
              backgroundColor: 'rgba(23,22,19,0.92)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text style={{ color: '#a09890', fontSize: 13, textAlign: 'center' }}>
              Location unavailable. Enable location to discover whispers nearby.
            </Text>
          </View>
        )}

        {poisError && (
          <TouchableOpacity
            onPress={() => refetchPois()}
            style={{
              backgroundColor: 'rgba(139,0,0,0.8)',
              borderWidth: 1,
              borderColor: 'rgba(255,0,0,0.3)',
              borderRadius: 12,
              padding: 16,
              marginTop: 12,
            }}
          >
            <Text style={{ color: '#ffcccc', fontSize: 13, textAlign: 'center' }}>
              {poisError.message} — Tap to retry
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MapOverlay and WhisperCard are now mounted in (app)/_layout.tsx
          so they overlay all tabs. No render needed here. */}
    </View>
  )
}
