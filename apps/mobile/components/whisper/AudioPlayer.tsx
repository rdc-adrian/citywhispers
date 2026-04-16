import React, { useEffect } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useAudio } from '../../hooks/useAudio'
import { useWhisperStore } from '../../store/useWhisperStore'

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface Props {
  audioUrl: string | null
  poiName: string
}

export function AudioPlayer({ audioUrl, poiName }: Props) {
  const { audioOpen, setAudioOpen } = useWhisperStore()
  const audio = useAudio(audioOpen ? audioUrl : null)

  const translateY = useSharedValue(120)
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  useEffect(() => {
    translateY.value = withTiming(audioOpen ? 0 : 120, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    })
    if (!audioOpen) audio.unload()
  }, [audioOpen])

  const progress = audio.durationMs > 0 ? audio.positionMs / audio.durationMs : 0

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#171613',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.1)',
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 32,
        },
      ]}
    >
      {/* POI name */}
      <Text style={{ color: '#e8e4dc', fontSize: 15, marginBottom: 2 }} numberOfLines={1}>
        {poiName}
      </Text>
      <Text
        style={{
          color: '#5c5650',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          marginBottom: 14,
        }}
      >
        Now playing
      </Text>

      {/* Progress track */}
      <View
        style={{
          height: 2,
          backgroundColor: '#2a2722',
          borderRadius: 1,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: '#c8a96e',
            borderRadius: 1,
          }}
        />
      </View>

      {/* Times */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Text style={{ color: '#5c5650', fontSize: 10 }}>{fmt(audio.positionMs)}</Text>
        <Text style={{ color: '#5c5650', fontSize: 10 }}>{fmt(audio.durationMs)}</Text>
      </View>

      {/* Controls */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        {/* Skip back 15s */}
        <Pressable onPress={() => audio.seekBy(-15000)} style={{ padding: 8 }}>
          <Text style={{ color: '#a09890', fontSize: 12 }}>−15s</Text>
        </Pressable>

        {/* Play / Pause */}
        <Pressable
          onPress={audio.togglePlay}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#c8a96e',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {audio.isLoading ? (
            <ActivityIndicator color="#1a1610" size="small" />
          ) : (
            <Text style={{ color: '#1a1610', fontSize: 18 }}>{audio.isPlaying ? '⏸' : '▶'}</Text>
          )}
        </Pressable>

        {/* Skip forward 15s */}
        <Pressable onPress={() => audio.seekBy(15000)} style={{ padding: 8 }}>
          <Text style={{ color: '#a09890', fontSize: 12 }}>+15s</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}
