import { create } from 'zustand'
import type { WhisperResponse } from '@citywhispers/types'

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
}

export const useWhisperStore = create<WhisperStore>((set) => ({
  activeWhisper: null,
  isOpen: false,

  openWhisper: (whisper) => set({ activeWhisper: whisper, isOpen: true }),

  closeWhisper: () => set({ isOpen: false }),
}))
