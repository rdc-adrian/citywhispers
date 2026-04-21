import React, { useRef, useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useLocation } from '../../hooks/useLocation'
import { useNearbyPois } from '../../hooks/useNearbyPois'
import { useWhisperStore } from '../../store/useWhisperStore'
import { PoiMarker } from '../../components/map/PoiMarker'
import { NearbyBadge } from '../../components/map/NearbyBadge'
import { WhisperCard } from '../../components/whisper/WhisperCard'
import { PoiSummary } from '../../lib/api'

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
  const { data: pois, isLoading: poisLoading } = useNearbyPois({
    lat: location.latitude,
    lng: location.longitude,
  })
  const { setActiveWhisper, discoveredIds } = useWhisperStore()

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
    }
  }, [location.latitude, location.longitude])

  function handlePoiPress(poi: PoiSummary) {
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
          latitude: 1.2966,
          longitude: 103.852,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
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
          <NearbyBadge count={pois.filter((p) => p.hasWhisper).length} />
        )}

        {poisLoading && location.latitude !== null && (
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
      </View>

      <WhisperCard />
    </View>
  )
}