import { WhisperResponse } from '@citywhispers/types'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export interface PoiSummary {
  id: string
  name: string
  latitude: number
  longitude: number
  category: string
  hasWhisper: boolean
  distanceMeters: number
  visited: boolean
}

export interface NearbyPoisParams {
  lat: number
  lng: number
  radiusMeters?: number
  limit?: number
  token: string
}

export function fetchNearbyPois({
  lat,
  lng,
  radiusMeters = 500,
  limit = 20,
  token,
}: NearbyPoisParams): Promise<PoiSummary[]> {
  const qs = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters),
    limit: String(limit),
  })
  return request<PoiSummary[]>(`/pois/nearby?${qs}`, { token })
}

export interface FetchWhisperParams {
  poiId: string
  timeSlot: string
  token: string
}

export function fetchWhisper({
  poiId,
  timeSlot,
  token,
}: FetchWhisperParams): Promise<WhisperResponse> {
  const qs = new URLSearchParams({ time_slot: timeSlot })
  return request<WhisperResponse>(`/whisper/${poiId}?${qs}`, { token })
}

export interface AudioUrlResponse {
  url: string
  durationSeconds: number
}

export function fetchAudioUrl({
  whisperId,
  token,
}: {
  whisperId: string
  token: string
}): Promise<AudioUrlResponse> {
  return request<AudioUrlResponse>(`/whisper/${whisperId}/audio`, { token })
}

export interface DiscoveredWhisper {
  whisperId: string
  poiId: string
  poiName: string
  whisperText: string
  audioUrl: string | null
  discoveredAt: string
}

export function fetchDiscoveredWhispers({
  token,
}: {
  token: string
}): Promise<DiscoveredWhisper[]> {
  return request<DiscoveredWhisper[]>('/user/discovered', { token })
}

export interface UserPreferences {
  autoplay: boolean
  radiusMeters: number
  showVisited: boolean
  darkMode: boolean
  language: string
  notifications: boolean
}

export function patchUserPreferences({
  prefs,
  token,
}: {
  prefs: Partial<UserPreferences>
  token: string
}): Promise<UserPreferences> {
  return request<UserPreferences>('/user/preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
    token,
  })
}
