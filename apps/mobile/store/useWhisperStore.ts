import { create } from 'zustand'
import { PoiSummary } from '../lib/api'
import { WhisperResponse } from '@citywhispers/types'

interface ActiveWhisper {
  poi: PoiSummary
  whisper: WhisperResponse
}

interface WhisperStore {
  // Which whisper card is open right now
  activeWhisper: ActiveWhisper | null
  setActiveWhisper: (w: ActiveWhisper | null) => void

  // Whether the audio player is showing
  audioOpen: boolean
  setAudioOpen: (open: boolean) => void

  // POI ids the user has already discovered
  discoveredIds: Set<string>
  markDiscovered: (poiId: string) => void
}

export const useWhisperStore = create<WhisperStore>((set) => ({
  activeWhisper: null,
  setActiveWhisper: (w) => set({ activeWhisper: w }),

  audioOpen: false,
  setAudioOpen: (open) => set({ audioOpen: open }),

  discoveredIds: new Set(),
  markDiscovered: (poiId) => set((s) => ({ discoveredIds: new Set([...s.discoveredIds, poiId]) })),
}))
