import React, { useRef, useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useLocation } from '../../hooks/useLocation'
import { useNearbyPois } from '../../hooks/useNearbyPois'
import { useWhisperStore } from '../../store/useWhisperStore'
import { PoiMarker } from '../../components/map/PoiMarker'
import { NearbyBadge } from '../../components/map/NearbyBadge'
import { WhisperCard } from '../../components/whisper/WhisperCard'
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

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const location = useLocation()
  
  // Track map center position for fetching POIs
  const [mapCenter, setMapCenter] = useState({
    latitude: 37.5665,   // Seoul
    longitude: 126.9780, // Seoul
  })
  
  const { data: pois, isLoading: poisLoading, error: poisError } = useNearbyPois({
    latitude: mapCenter.latitude,
    longitude: mapCenter.longitude,
  })
  const { activeWhisper, setActiveWhisper, discoveredIds } = useWhisperStore()

  // Debug logging
  useEffect(() => {
    console.log('🗺️ Map state:', {
      location: { lat: location.latitude, lng: location.longitude },
      mapCenter: { lat: mapCenter.latitude, lng: mapCenter.longitude },
      poisCount: pois?.length ?? 0,
      poisLoading,
      poisError: poisError?.message,
    })
  }, [location.latitude, location.longitude, mapCenter, pois, poisLoading, poisError])

  // Animate to user's location when available (but don't force it)
  useEffect(() => {
    if (location.latitude && location.longitude && !mapCenter.latitude) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800
      )
      setMapCenter({ latitude: location.latitude, longitude: location.longitude })
    }
  }, [location.latitude, location.longitude])

  // Handle map region changes (when user pans)
  function handleRegionChangeComplete(region: Region) {
    console.log('🗺️ Region changed to:', region.latitude, region.longitude)
    setMapCenter({
      latitude: region.latitude,
      longitude: region.longitude,
    })
  }

  function handlePoiPress(poi: PoiSummary) {
    console.log('📍 POI tapped:', poi.name)
    setActiveWhisper({
      poi: { ...poi, visited: discoveredIds.includes(poi.id) },
      whisper: null as any,
    })
  }

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
          latitude: 37.5665,   // Seoul instead of Singapore
          longitude: 126.9780, // Seoul instead of Singapore
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {pois?.map((poi) => (
          <PoiMarker
            key={poi.id}
            poi={{ ...poi, visited: discoveredIds.includes(poi.id) }}
            onPress={handlePoiPress}
          />
        ))}
      </MapView>

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
          <View
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
              Error loading POIs: {poisError.message}
            </Text>
          </View>
        )}
      </View>

      {activeWhisper && (
        <WhisperCard
          poi={activeWhisper.poi}
          onClose={() => setActiveWhisper(null as any)}
        />
      )}
    </View>
  )
}