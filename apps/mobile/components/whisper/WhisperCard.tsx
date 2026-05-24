import React, { useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useWhisperStore } from '../../store/useWhisperStore'
import { useAudio } from '../../hooks/useAudio'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.82

// ─── Phase 2: Height expansion constants ──────────────────────────────────────
// The progress bar reveal adds ~68px: bar height (4) + vertical padding (32) + time labels (20) + gap (12)
const PROGRESS_REVEAL_HEIGHT = 68

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  surface: '#141414',
  sep: 'rgba(255,255,255,0.045)',
  textPrimary: '#ede5d4',
  textSecondary: '#7a7370',
  textMuted: '#3d3b39',
  gold: '#c8aa6e',
  goldSoft: 'rgba(200,170,110,0.35)',
  goldDim: 'rgba(200,170,110,0.15)',
  goldBar: 'rgba(200,170,110,0.28)',
}

const TIMING = {
  sheetIn: 480,
  stagger: 80,
  sheetOut: 360,
  progressReveal: 300,
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

const BAR_HEIGHTS = [5, 9, 14, 8, 11, 6, 13, 7, 10, 4]

function WaveformBar({
  height,
  active,
  delay,
}: {
  height: number
  active: boolean
  delay: number
}) {
  const scale = useSharedValue(0.4)

  useEffect(() => {
    if (active) {
      const animate = () => {
        scale.value = withTiming(
          0.3 + Math.random() * 0.7,
          {
            duration: 500 + Math.random() * 600,
            easing: Easing.inOut(Easing.ease),
          },
          (finished) => {
            if (finished) animate()
          }
        )
      }
      scale.value = withDelay(delay, withTiming(1, { duration: 400 }, animate))
    } else {
      scale.value = withTiming(0.4, { duration: 400 })
    }
  }, [active])

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
    backgroundColor: active ? C.goldBar : 'rgba(200,170,110,0.12)',
  }))

  return (
    <Animated.View
      style={[{ width: 3, height, borderRadius: 2, transformOrigin: 'bottom' }, style]}
    />
  )
}

function WaveformBars({ active }: { active: boolean }) {
  return (
    <View style={s.waveform}>
      {BAR_HEIGHTS.map((h, i) => (
        <WaveformBar key={i} height={h} active={active} delay={i * 55} />
      ))}
    </View>
  )
}

// ─── Breath ring ──────────────────────────────────────────────────────────────

function BreathRing({ active }: { active: boolean }) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (active) {
      opacity.value = withTiming(1, { duration: 300 })
      const breathe = () => {
        scale.value = withTiming(
          1.3,
          { duration: 1100, easing: Easing.inOut(Easing.ease) },
          () => {
            scale.value = withTiming(
              1,
              { duration: 1100, easing: Easing.inOut(Easing.ease) },
              (finished) => { if (finished) breathe() }
            )
          }
        )
      }
      breathe()
    } else {
      opacity.value = withTiming(0, { duration: 300 })
      scale.value = withTiming(1, { duration: 300 })
    }
  }, [active])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return <Animated.View pointerEvents="none" style={[s.breathRing, style]} />
}

// ─── Progress bar reveal ──────────────────────────────────────────────────────
// Mounted always (when audioUrl exists), hidden via opacity + translateY.
// Sheet grows to accommodate it when isPlaying becomes true.

type ProgressRevealProps = {
  visible: boolean
  progress: number
  positionSeconds: number
  durationSeconds: number
  onReplay: () => void
}

function ProgressReveal({
  visible,
  progress,
  positionSeconds,
  durationSeconds,
  onReplay,
}: ProgressRevealProps) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(10)

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: TIMING.progressReveal })
      translateY.value = withSpring(0, { damping: 20, stiffness: 180 })
    } else {
      opacity.value = withTiming(0, { duration: 180 })
      translateY.value = withTiming(10, { duration: 180 })
    }
  }, [visible])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={[s.progressReveal, style]} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableOpacity
        onPress={onReplay}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={s.replayIcon}>↺</Text>
      </TouchableOpacity>

      <Text style={s.timeText}>{formatTime(positionSeconds)}</Text>

      <View style={s.progressLine}>
        <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <Text style={s.timeText}>
        {durationSeconds > 0 ? formatTime(durationSeconds) : '--:--'}
      </Text>
    </Animated.View>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${meters} m`
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  onNearbyPress?: (poiId: string) => void
  isRevisit?: boolean
}

export function WhisperCard({ onNearbyPress, isRevisit: _isRevisit }: Props) {
  const { activeWhisper, isOpen, closeWhisper } = useWhisperStore()
  const insets = useSafeAreaInsets()

  // ── Animation values ────────────────────────────────────────────────────────
  // Overlay opacity lives in MapOverlay — not owned here.
  const sheetY = useSharedValue(SHEET_MAX_HEIGHT)
  const contentOpacity = useSharedValue(0)
  const titleY = useSharedValue(12)
  const whisperY = useSharedValue(16)

  // Phase 2: extra bottom padding that grows when progress bar reveals.
  // Animating the ScrollView's contentContainer paddingBottom means the sheet
  // itself doesn't need a fixed height — content grows downward naturally.
  const extraPadding = useSharedValue(0)

  const { playbackState, positionSeconds, durationSeconds, progress, play, pause, replay } =
    useAudio({
      uri: activeWhisper?.audioUrl ?? null,
      whisperId: activeWhisper?.whisperId,
      poiId: activeWhisper?.poiId,
    })

  const isPlaying = playbackState === 'playing'
  const isLoading = playbackState === 'loading'

  // ── Phase 2: Expand / collapse sheet padding on playback state ──────────────
  useEffect(() => {
    if (isPlaying) {
      extraPadding.value = withSpring(PROGRESS_REVEAL_HEIGHT, {
        damping: 22,
        stiffness: 140,
        mass: 0.8,
      })
    } else {
      extraPadding.value = withSpring(0, {
        damping: 22,
        stiffness: 180,
        mass: 0.8,
      })
    }
  }, [isPlaying])

  // ── Open / close animations ─────────────────────────────────────────────────

  const animateOpen = useCallback(() => {
    // TODO(Sprint-E): diverge revisit animation here — use isRevisit for a quieter entry
    // Overlay fade is handled by MapOverlay, which reacts to isOpen on the same frame.
    sheetY.value = withSpring(0, { damping: 18, stiffness: 120 })
    contentOpacity.value = withDelay(TIMING.stagger, withTiming(1, { duration: 320 }))
    titleY.value = withDelay(TIMING.stagger, withSpring(0, { damping: 20, stiffness: 180 }))
    whisperY.value = withDelay(TIMING.stagger * 2, withSpring(0, { damping: 20, stiffness: 160 }))
  }, [])

  const animateClose = useCallback((onDone?: () => void) => {
    // Overlay fade-out is handled by MapOverlay on the same frame.
    contentOpacity.value = withTiming(0, { duration: 200 })
    titleY.value = withTiming(8, { duration: 200 })
    whisperY.value = withTiming(12, { duration: 200 })
    // Collapse extra padding immediately on close
    extraPadding.value = withTiming(0, { duration: 200 })
    sheetY.value = withTiming(
      SHEET_MAX_HEIGHT,
      { duration: TIMING.sheetOut, easing: Easing.in(Easing.ease) },
      (finished) => { if (finished && onDone) runOnJS(onDone)() }
    )
  }, [])

  useEffect(() => {
    if (isOpen) {
      animateOpen()
    } else {
      animateClose(() => {
        useWhisperStore.setState({ activeWhisper: null })
      })
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    if (isPlaying) pause()
    closeWhisper()
  }, [isPlaying, pause, closeWhisper])

  const handlePlayPause = useCallback(() => {
    isPlaying ? pause() : play()
  }, [isPlaying, play, pause])

  // ── Phase 2: Drag-down dismiss via PanResponder on the drag pill ─────────────
  // Using a ref for handleClose so the PanResponder (created once) always calls
  // the latest version and avoids stale closure over isPlaying / pause.
  const handleCloseRef = useRef(handleClose)
  useEffect(() => {
    handleCloseRef.current = handleClose
  }, [handleClose])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 48) {
          handleCloseRef.current()
        }
      },
    })
  ).current

  // ── Animated styles ─────────────────────────────────────────────────────────

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }))
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }))
  const titleStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: titleY.value }],
  }))
  const whisperStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: whisperY.value }],
  }))
  const scrollContentStyle = useAnimatedStyle(() => ({
    paddingBottom: 8 + extraPadding.value,
  }))

  if (!activeWhisper) return null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { maxHeight: SHEET_MAX_HEIGHT, paddingBottom: insets.bottom + 16 },
          sheetStyle,
        ]}
      >
        {/* Drag pill — owns top padding; pan responder for dismiss gesture */}
        <View style={s.dragPillWrap} {...panResponder.panHandlers}>
          <View style={s.dragPill} />
        </View>

        <Animated.ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scrollContentStyle}
        >
          {/* Header */}
          <Animated.View style={[s.header, titleStyle]}>
            <Text style={s.locationLine}>
              {activeWhisper.ambientLabel}
            </Text>
            <Text style={s.poiName}>{activeWhisper.poiName}</Text>
            <Text style={s.categoryLabel}>{activeWhisper.category}</Text>
          </Animated.View>

          {/* Whisper text */}
          <Animated.View style={[s.whisperBlock, whisperStyle]}>
            <Text style={s.whisperEyebrow}>whisper</Text>
            <Text style={s.whisperBody}>{activeWhisper.whisperText}</Text>
          </Animated.View>

          {/* Audio — only render if audioUrl exists */}
          {activeWhisper.audioUrl ? (
            <Animated.View style={[s.audioZone, contentStyle]}>
              {/* Play row */}
              <View style={s.audioRow}>
                <View style={s.playWrap}>
                  <BreathRing active={isPlaying} />
                  <TouchableOpacity
                    style={s.playBtn}
                    onPress={handlePlayPause}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={s.playIcon}>
                      {isLoading ? '···' : isPlaying ? '⏸' : '▶'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <WaveformBars active={isPlaying} />
              </View>

              {/* Phase 2: Progress bar slides in below play row when playing */}
              <ProgressReveal
                visible={isPlaying}
                progress={progress}
                positionSeconds={positionSeconds}
                durationSeconds={durationSeconds}
                onReplay={replay}
              />
            </Animated.View>
          ) : (
            // No audio — show a quiet placeholder
            <Animated.View style={[s.noAudioZone, contentStyle]}>
              <Text style={s.noAudioText}>no audio for this whisper yet</Text>
            </Animated.View>
          )}

          {/* Nearby */}
          {activeWhisper.nearby.length > 0 && (
            <Animated.View style={[s.nearbyZone, contentStyle]}>
              <Text style={s.nearbyEyebrow}>elsewhere nearby</Text>
              {activeWhisper.nearby.slice(0, 2).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.nearbyItem}
                  activeOpacity={0.6}
                  onPress={() => onNearbyPress?.(item.id)}
                >
                  <View style={s.nearbyDot} />
                  <Text style={s.nearbyName}>{item.name}</Text>
                  <Text style={s.nearbyDist}>{formatDistance(item.distanceMeters)}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </Animated.ScrollView>
      </Animated.View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Drag pill — larger hit area so the gesture is easy to trigger
  dragPillWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dragPill: {
    width: 28,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: C.textMuted,
    opacity: 0.5,
  },

  // Header
  header: {
    paddingHorizontal: 26,
    paddingTop: 10, // reduced — dragPillWrap now owns top spacing
    paddingBottom: 24,
  },
  locationLine: {
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.gold,
    marginBottom: 8,
    opacity: 0.8,
  },
  poiName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28,
    fontWeight: '300',
    color: C.textPrimary,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  categoryLabel: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 6,
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },

  // Whisper text
  whisperBlock: {
    paddingHorizontal: 26,
    paddingBottom: 28,
    marginTop: 4,
  },
  whisperEyebrow: {
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 18,
  },
  whisperBody: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '300',
    color: C.textPrimary,
    lineHeight: 42,
    letterSpacing: 0.3,
  },

  // Audio
  audioZone: {
    paddingHorizontal: 26,
    paddingBottom: 22,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  playWrap: { position: 'relative', flexShrink: 0 },
  breathRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 0.5,
    borderColor: C.goldDim,
    top: -2,
    left: -2,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0.5,
    borderColor: C.goldSoft,
    backgroundColor: C.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: C.gold,
    fontSize: 14,
    lineHeight: 16,
  },
  replayIcon: {
    color: C.textMuted,
    fontSize: 16,
    lineHeight: 18,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 20,
    flex: 1,
  },

  // Phase 2: Progress reveal row (slides in below play row)
  progressReveal: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 10.5,
    color: C.textMuted,
    fontWeight: '300',
    letterSpacing: 0.4,
    marginHorizontal: 10,
  },
  progressLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(200,170,110,0.4)',
    borderRadius: 1,
  },

  // No audio
  noAudioZone: {
    paddingHorizontal: 26,
    paddingBottom: 22,
  },
  noAudioText: {
    fontSize: 11,
    color: C.textMuted,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },

  // Nearby
  nearbyZone: { paddingHorizontal: 26 },
  nearbyEyebrow: {
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 16,
    opacity: 0.7,
  },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderColor: C.sep,
    gap: 14,
  },
  nearbyDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.textMuted,
    opacity: 0.6,
  },
  nearbyName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 16,
    fontStyle: 'italic',
    fontWeight: '300',
    color: C.textSecondary,
    flex: 1,
  },
  nearbyDist: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '300',
    opacity: 0.5,
    letterSpacing: 0.4,
  },
})
