import React from 'react'
import { View, Text } from 'react-native'
import { Marker } from 'react-native-maps'
import { PoiSummary } from '../../lib/api'

interface Props {
  poi: PoiSummary
  onPress: (poi: PoiSummary) => void
}

export function PoiMarker({ poi, onPress }: Props) {
  return (
    <Marker
      key={poi.id}
      coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
      onPress={() => onPress(poi)}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
    >
      <View style={{ alignItems: 'center' }}>
        {/* Pin body */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: poi.visited ? '#27241f' : '#c8a96e',
            borderWidth: poi.visited ? 1 : 0,
            borderColor: '#8a7048',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#c8a96e',
            shadowOpacity: poi.visited ? 0 : 0.4,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: poi.visited ? '#8a7048' : '#1a1610',
            }}
          />
        </View>
        {/* Label */}
        <View
          style={{
            marginTop: 4,
            backgroundColor: 'rgba(15,14,12,0.9)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: '#a09890', fontSize: 10 }} numberOfLines={1}>
            {poi.name}
          </Text>
        </View>
      </View>
    </Marker>
  )
}
