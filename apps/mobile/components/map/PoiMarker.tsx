import React, { useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { Marker } from 'react-native-maps'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated'
import type { PoiSummary } from '@citywhispers/types'

interface Props {
  poi: PoiSummary
  onPress: (poi: PoiSummary) => void
  isLoading?: boolean
  isDiscovered: boolean
}

export function PoiMarker({ poi, onPress, isLoading = false, isDiscovered }: Props) {
  const isActive = isLoading

  // Quiet withdrawal of energy — not a new visual, just a reduction of presence
  const energy = useSharedValue(isDiscovered ? 0.5 : 1)

  // Pulse scale — breathing continues, just slower and quieter when discovered
  const pulse = useSharedValue(1)

  useEffect(() => {
    energy.value = withTiming(isDiscovered ? 0.5 : 1, {
      duration: 800,
      easing: Easing.out(Easing.ease),
    })
  }, [isDiscovered])

  useEffect(() => {
    const pulseMax = isDiscovered ? 1.06 : 1.15
    const pulseDuration = isDiscovered ? 2800 : 1800
    pulse.value = withRepeat(
      withTiming(pulseMax, { duration: pulseDuration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [isDiscovered])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: energy.value,
  }))

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }))

  return (
    <Marker
      coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
      onPress={() => onPress(poi)}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={isLoading}
    >
      <Animated.View style={[{ alignItems: 'center' }, animatedStyle]}>
        {/* Pin body — pulses gently */}
        <Animated.View
          style={[
            {
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
            },
            pinStyle,
          ]}
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
        </Animated.View>

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
      </Animated.View>
    </Marker>
  )
}
