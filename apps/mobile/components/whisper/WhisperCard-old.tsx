import React, { useEffect } from 'react'
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useWhisperStore } from '../../store/useWhisperStore'
import { useWhisper } from '../../hooks/useWhisper'
import { AudioPlayer } from './AudioPlayer'

export function WhisperCard() {
  const { activeWhisper, setActiveWhisper, setAudioOpen, markDiscovered } = useWhisperStore()
  const insets = useSafeAreaInsets()

  const poiId = activeWhisper?.poi.id ?? null
  const { data: whisper, isLoading, isError } = useWhisper(poiId)

  // Mark POI as discovered when whisper loads
  useEffect(() => {
    if (whisper && poiId) markDiscovered(poiId)
  }, [whisper, poiId])

  // Slide up animation
  const translateY = useSharedValue(600)
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const isOpen = activeWhisper !== null

  useEffect(() => {
    translateY.value = withTiming(isOpen ? 0 : 600, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    })
    if (!isOpen) setAudioOpen(false)
  }, [isOpen])

  function close() {
    setActiveWhisper(null)
    setAudioOpen(false)
  }

  const poiName = activeWhisper?.poi.name ?? ''
  const distMeters = activeWhisper?.poi.distanceMeters ?? 0
  const distLabel =
    distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1)} km away` : `${distMeters} m away`

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
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          paddingBottom: insets.bottom + 80,
        },
      ]}
    >
      {/* Drag handle */}
      <View
        style={{
          width: 36,
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 2,
          alignSelf: 'center',
          marginTop: 12,
          marginBottom: 20,
        }}
      />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text
            style={{
              color: '#c8a96e',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 4,
            }}
          >
            Whisper
          </Text>
          <Text style={{ color: '#e8e4dc', fontSize: 20, lineHeight: 26 }} numberOfLines={2}>
            {poiName}
          </Text>
        </View>

        {/* Close button */}
        <Pressable
          onPress={close}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#2a2722',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#a09890', fontSize: 14 }}>X</Text>
        </Pressable>
      </View>

      {/* Whisper text */}
      <ScrollView
        style={{ paddingHorizontal: 24, paddingTop: 20, maxHeight: 200 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator color="#c8a96e" />
            <Text style={{ color: '#5c5650', fontSize: 12, marginTop: 12 }}>
              Summoning the whisper…
            </Text>
          </View>
        )}

        {isError && (
          <Text style={{ color: '#5c5650', fontSize: 14, lineHeight: 22 }}>
            This whisper is out of range. Try again in a moment.
          </Text>
        )}

        {whisper && (
          <Text style={{ color: '#e8e4dc', fontSize: 17, lineHeight: 30 }}>
            {whisper.whisperText}
          </Text>
        )}
      </ScrollView>

      {/* Footer */}
      {whisper && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingTop: 16,
            marginTop: 4,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {/* Distance */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#8a7048',
              }}
            />
            <Text style={{ color: '#5c5650', fontSize: 12 }}>{distLabel}</Text>
          </View>

          {/* Play button */}
          {whisper.audioUrl && (
            <Pressable
              onPress={() => setAudioOpen(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#c8a96e',
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: '#1a1610', fontSize: 13, fontWeight: '500' }}>
                Play whisper
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Audio player sits inside the card */}
      {whisper?.audioUrl && <AudioPlayer audioUrl={whisper.audioUrl} poiName={poiName} />}
    </Animated.View>
  )
}
