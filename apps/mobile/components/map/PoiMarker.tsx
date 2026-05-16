import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { Marker } from 'react-native-maps'
import type { PoiSummary } from '@citywhispers/types'

interface Props {
  poi: PoiSummary
  onPress: (poi: PoiSummary) => void
  isLoading?: boolean
}

export function PoiMarker({ poi, onPress, isLoading = false }: Props) {
  const isActive = isLoading

  return (
    <Marker
      key={poi.id}
      coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
      onPress={() => onPress(poi)}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={isLoading} // only re-render when loading state changes
    >
      <View style={{ alignItems: 'center' }}>
        {/* Pin body */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isActive ? '#1a1610' : '#c8a96e',
            borderWidth: isActive ? 1 : 0,
            borderColor: '#c8a96e',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#c8a96e',
            shadowOpacity: isActive ? 0.6 : 0.4,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#c8a96e" />
          ) : (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#1a1610',
              }}
            />
          )}
        </View>

        {/* Label */}
        <View
          style={{
            marginTop: 4,
            backgroundColor: isActive
              ? 'rgba(200,169,110,0.15)'
              : 'rgba(15,14,12,0.9)',
            borderWidth: 1,
            borderColor: isActive
              ? 'rgba(200,169,110,0.4)'
              : 'rgba(255,255,255,0.1)',
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              color: isActive ? '#c8a96e' : '#a09890',
              fontSize: 10,
            }}
            numberOfLines={1}
          >
            {poi.name}
          </Text>
        </View>
      </View>
    </Marker>
  )
}
