import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useWhisperStore } from '../../store/useWhisperStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATION = 320 // ms — must match WhisperCard TIMING.overlayIn / overlayOut

// ─── MapOverlay ───────────────────────────────────────────────────────────────
// Sits in z-order between the map (and top-bar chrome) and the WhisperCard
// sheet. Fades in when a whisper is opened, fades out when it is dismissed.
//
// Rules:
//   • pointerEvents="none" always — must never intercept map or UI touches
//   • Easing.linear, strictly deterministic — no spring, no bounce
//   • Driven by isOpen so the fade-out begins on the same frame as card dismiss
//   • Stays mounted while activeWhisper is non-null (i.e. during the
//     close animation) and unmounts automatically once the store clears it

export function MapOverlay() {
  const { activeWhisper, isOpen } = useWhisperStore()
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (isOpen) {
      opacity.value = withTiming(1, { duration: DURATION, easing: Easing.linear })
    } else {
      opacity.value = withTiming(0, { duration: DURATION, easing: Easing.linear })
    }
  }, [isOpen])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  // Only render while a whisper is in flight — avoids a stale invisible layer
  // sitting over the map at all times.
  if (!activeWhisper) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, s.overlay, animatedStyle]}
    />
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    // Target: 0.55 on OLED/indoor. If it reads as blackout outdoors, lower to
    // 0.45–0.50. Validate in direct sunlight before adjusting.
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
})
