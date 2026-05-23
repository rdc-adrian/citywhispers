import type { WhisperResponse } from '@citywhispers/types'

export function getCurrentTimeSlot(): WhisperResponse['timeSlot'] {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}
