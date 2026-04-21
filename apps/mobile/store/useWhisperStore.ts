import { create } from 'zustand'
import { PoiSummary } from '../lib/api'
import { WhisperResponse } from '@citywhispers/types'

interface ActiveWhisper {
  poi: PoiSummary
  whisper: WhisperResponse
}

interface WhisperStore {
  activeWhisper: ActiveWhisper | null
  setActiveWhisper: (w: ActiveWhisper | null) => void

  audioOpen: boolean
  setAudioOpen: (open: boolean) => void

  discoveredIds: string[]
  markDiscovered: (poiId: string) => void
  isDiscovered: (poiId: string) => boolean
}

export const useWhisperStore = create<WhisperStore>((set, get) => ({
  activeWhisper: null,
  setActiveWhisper: (w) => set({ activeWhisper: w }),

  audioOpen: false,
  setAudioOpen: (open) => set({ audioOpen: open }),

  discoveredIds: [],
  markDiscovered: (poiId) =>
    set((s) => ({
      discoveredIds: s.discoveredIds.includes(poiId)
        ? s.discoveredIds
        : [...s.discoveredIds, poiId],
    })),
  isDiscovered: (poiId) => get().discoveredIds.includes(poiId),
}))
