import { useEffect, useRef, useCallback, useState } from 'react'
import { Audio } from 'expo-av'

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

type UseAudioOptions = {
  uri: string | null
  onEnd?: () => void
}

export type UseAudioReturn = {
  playbackState: PlaybackState
  positionSeconds: number
  durationSeconds: number
  progress: number // 0–1
  play: () => Promise<void>
  pause: () => Promise<void>
  replay: () => Promise<void>
}

export function useAudio({ uri, onEnd }: UseAudioOptions): UseAudioReturn {
  const soundRef = useRef<Audio.Sound | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const [positionSeconds, setPositionSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)

  // Unload when uri changes or component unmounts
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {})
      soundRef.current = null
    }
  }, [uri])

  // Reset position when a new uri is set
  useEffect(() => {
    setPlaybackState('idle')
    setPositionSeconds(0)
    setDurationSeconds(0)
  }, [uri])

  const loadSound = useCallback(async (): Promise<Audio.Sound | null> => {
    if (!uri) return null
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
      })

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 500 },
        (status) => {
          if (!status.isLoaded) return
          setPositionSeconds(status.positionMillis / 1000)
          if (status.durationMillis) {
            setDurationSeconds(status.durationMillis / 1000)
          }
          if (status.didJustFinish) {
            setPlaybackState('idle')
            setPositionSeconds(0)
            onEnd?.()
          }
        }
      )

      soundRef.current = sound
      return sound
    } catch {
      setPlaybackState('error')
      return null
    }
  }, [uri, onEnd])

  const play = useCallback(async () => {
    try {
      setPlaybackState('loading')
      let sound = soundRef.current

      if (!sound) {
        sound = await loadSound()
        if (!sound) return
      }

      await sound.playAsync()
      setPlaybackState('playing')
    } catch {
      setPlaybackState('error')
    }
  }, [loadSound])

  const pause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync()
      setPlaybackState('paused')
    } catch {
      setPlaybackState('error')
    }
  }, [])

  const replay = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0)
        await soundRef.current.playAsync()
        setPlaybackState('playing')
        setPositionSeconds(0)
      } else {
        await play()
      }
    } catch {
      setPlaybackState('error')
    }
  }, [play])

  const progress =
    durationSeconds > 0 ? Math.min(positionSeconds / durationSeconds, 1) : 0

  return {
    playbackState,
    positionSeconds,
    durationSeconds,
    progress,
    play,
    pause,
    replay,
  }
}
