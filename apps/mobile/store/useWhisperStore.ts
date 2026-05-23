import { create } from 'zustand'
import type { WhisperResponse, DiscoveredWhisper } from '@citywhispers/types'

// Combined shape built from PoiSummary + WhisperResponse after marker tap
export interface ActiveWhisper {
  // From PoiSummary
  poiId: string
  poiName: string
  category: string
  // From WhisperResponse
  whisperId: string
  whisperText: string
  audioUrl: string | null
  timeSlot: WhisperResponse['timeSlot']
  personaSlug: string
  // Derived at call site
  ambientLabel: string
  nearby: Array<{ id: string; name: string; distanceMeters: number }>
}

type WhisperStore = {
  activeWhisper: ActiveWhisper | null
  isOpen: boolean
  openWhisper: (whisper: ActiveWhisper) => void
  closeWhisper: () => void

  // — Discovery state —
  discoveredPoiIds: Set<string>
  completedWhisperIds: Set<string>
  hydrateDiscovered: (whispers: DiscoveredWhisper[]) => void
  markCompleted: (whisperId: string, poiId: string) => void
}

// Base store implementation (not exported under the public name)
const baseWhisperStore = create<WhisperStore>((set) => ({
  activeWhisper: null,
  isOpen: false,

  openWhisper: (whisper) => set({ activeWhisper: whisper, isOpen: true }),

  closeWhisper: () => set({ isOpen: false }),

  // — Discovery state —
  discoveredPoiIds: new Set<string>(),
  completedWhisperIds: new Set<string>(),

  hydrateDiscovered: (whispers) => set(() => ({
    discoveredPoiIds: new Set(whispers.map(w => w.poiId)),
    completedWhisperIds: new Set(
      whispers.filter(w => w.completedAt !== null).map(w => w.whisperId)
    ),
  })),

  markCompleted: (whisperId, poiId) => set((state) => ({
    completedWhisperIds: new Set([...state.completedWhisperIds, whisperId]),
    discoveredPoiIds: new Set([...state.discoveredPoiIds, poiId]),
  })),
}))

// Backwards-compatibility: expose legacy names used across older components
export type WhisperStoreLegacy = WhisperStore & {
  audioOpen: boolean
  setAudioOpen: (v: boolean) => void
  setActiveWhisper: (w: ActiveWhisper | null) => void
  markDiscovered: (poiId: string) => void
}

// Wrap original to include legacy helpers
export const useWhisperStoreLegacy = create<WhisperStoreLegacy>((set) => ({
  activeWhisper: null,
  isOpen: false,
  openWhisper: (whisper) => set({ activeWhisper: whisper, isOpen: true }),
  closeWhisper: () => set({ isOpen: false }),

  // — Discovery state —
  discoveredPoiIds: new Set<string>(),
  completedWhisperIds: new Set<string>(),

  hydrateDiscovered: (whispers) => set(() => ({
    discoveredPoiIds: new Set(whispers.map(w => w.poiId)),
    completedWhisperIds: new Set(
      whispers.filter(w => w.completedAt !== null).map(w => w.whisperId)
    ),
  })),

  markCompleted: (whisperId, poiId) => set((state) => ({
    completedWhisperIds: new Set([...state.completedWhisperIds, whisperId]),
    discoveredPoiIds: new Set([...state.discoveredPoiIds, poiId]),
  })),

  // legacy
  audioOpen: false,
  setAudioOpen: (v) => set({ audioOpen: v }),
  setActiveWhisper: (w) => set({ activeWhisper: w, isOpen: !!w }),
  markDiscovered: (_poiId: string) => {
    // noop placeholder; real implementation may persist discovery elsewhere
    return
  },
}))

// Ensure the commonly imported name `useWhisperStore` provides the legacy-compatible API
export const useWhisperStore = useWhisperStoreLegacy
