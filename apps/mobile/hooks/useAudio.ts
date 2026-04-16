import { useEffect, useRef, useState, useCallback } from 'react'
import { Audio } from 'expo-av'

interface AudioState {
  isPlaying: boolean
  positionMs: number
  durationMs: number
  isLoading: boolean
  error: string | null
}

interface UseAudioReturn extends AudioState {
  play: () => Promise<void>
  pause: () => Promise<void>
  togglePlay: () => Promise<void>
  seekTo: (ms: number) => Promise<void>
  seekBy: (deltaMs: number) => Promise<void>
  unload: () => Promise<void>
}

export function useAudio(url: string | null): UseAudioReturn {
  const soundRef = useRef<Audio.Sound | null>(null)
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    isLoading: false,
    error: null,
  })

  const load = useCallback(async (audioUrl: string) => {
    try {
      setState((s) => ({ ...s, isLoading: true, error: null }))
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })

      if (soundRef.current) {
        await soundRef.current.unloadAsync()
        soundRef.current = null
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        (status) => {
          if (!status.isLoaded) return
          setState({
            isPlaying: status.isPlaying,
            positionMs: status.positionMillis,
            durationMs: status.durationMillis ?? 0,
            isLoading: false,
            error: null,
          })
        }
      )
      soundRef.current = sound
      setState((s) => ({ ...s, isLoading: false }))
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false, error: 'Failed to load audio' }))
    }
  }, [])

  useEffect(() => {
    if (url) load(url)
    return () => {
      soundRef.current?.unloadAsync()
      soundRef.current = null
    }
  }, [url, load])

  const play = useCallback(async () => {
    await soundRef.current?.playAsync()
  }, [])

  const pause = useCallback(async () => {
    await soundRef.current?.pauseAsync()
  }, [])

  const togglePlay = useCallback(async () => {
    if (state.isPlaying) await pause()
    else await play()
  }, [state.isPlaying, play, pause])

  const seekTo = useCallback(async (ms: number) => {
    await soundRef.current?.setPositionAsync(ms)
  }, [])

  const seekBy = useCallback(
    async (deltaMs: number) => {
      const next = Math.max(0, Math.min(state.durationMs, state.positionMs + deltaMs))
      await soundRef.current?.setPositionAsync(next)
    },
    [state.positionMs, state.durationMs]
  )

  const unload = useCallback(async () => {
    await soundRef.current?.unloadAsync()
    soundRef.current = null
    setState({ isPlaying: false, positionMs: 0, durationMs: 0, isLoading: false, error: null })
  }, [])

  return { ...state, play, pause, togglePlay, seekTo, seekBy, unload }
}
