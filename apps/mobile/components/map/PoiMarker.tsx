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

/**
 * Visual hierarchy by POI category.
 * Hierarchy is communicated through size and opacity only.
 * No colour changes. No animation. No badges or labels.
 * Default to 'drift' for any unknown or missing category.
 *
 * Rules:
 *  anchor — slight gravitational weight. Stable presence.
 *  drift  — standard. Unremarkable.
 *  echo   — peripheral. Almost discovered accidentally.
 */
const CATEGORY_STYLE: Record<string, { size: number; glowOpacity: number; dotOpacity: number }> = {
  anchor: { size: 10, glowOpacity: 0.35, dotOpacity: 1.0  },
  drift:  { size: 8,  glowOpacity: 0.18, dotOpacity: 0.85 },
  echo:   { size: 6,  glowOpacity: 0.08, dotOpacity: 0.60 },
}

const DEFAULT_CATEGORY_STYLE = CATEGORY_STYLE.drift

interface Props {
  poi: PoiSummary
  onPress: (poi: PoiSummary) => void
  isLoading?: boolean
  isDiscovered: boolean
}

export function PoiMarker({ poi, onPress, isLoading = false, isDiscovered }: Props) {
  const isActive = isLoading
  const catStyle = CATEGORY_STYLE[poi.poiCategory ?? 'drift'] ?? DEFAULT_CATEGORY_STYLE

  // Quiet withdrawal of energy — not a new visual, just a reduction of presence.
  // Discovered state compounds with category opacity rather than replacing it.
  const energy = useSharedValue(isDiscovered ? catStyle.dotOpacity * 0.3 : catStyle.dotOpacity)

  // Pulse scale — breathing continues, just slower and quieter when discovered
  const pulse = useSharedValue(1)

  useEffect(() => {
    energy.value = withTiming(isDiscovered ? catStyle.dotOpacity * 0.3 : catStyle.dotOpacity, {
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
              shadowOpacity: isActive ? 0.6 : catStyle.glowOpacity,
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
                width: catStyle.size,
                height: catStyle.size,
                borderRadius: catStyle.size / 2,
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
