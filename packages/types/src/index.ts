export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night'
export type PersonaSlug = 'historian' | 'night_wanderer' | 'foodie' | 'default'
export type WhisperSource = 'ai' | 'curated' | 'community'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'

export interface WhisperContext {
  poiId?: string
  geohash6: string
  cityId: string
  personaSlug: PersonaSlug
  timeSlot: TimeSlot
  userId: string
  userCategories: string[]
  languageCode: string
}

export interface WhisperResponse {
  whisperId: string
  whisperText: string
  audioUrl: string | null
  personaId: string
  trailId?: string
  unlocked: boolean
  cached: boolean
}
