// apps/mobile/lib/api.ts
import type {
  PoiSummary,
  WhisperResponse,
  DiscoveredWhisper,
  UserPreferences,
} from '@citywhispers/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
console.log('[api] BASE_URL =', BASE_URL);

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

function getAuthHeaders(token?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ========================================
// POI Endpoints
// ========================================

interface FetchNearbyPoisParams {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
  token?: string | null;
  suppressOverlap?: boolean;
}

export async function fetchNearbyPois({
  lat,
  lng,
  radius = 2000,
  limit = 10,
  token,
  suppressOverlap = true,
}: FetchNearbyPoisParams): Promise<PoiSummary[]> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radius: radius.toString(),
    limit: limit.toString(),
    suppressOverlap: suppressOverlap.toString(),
  });

  const response = await fetchWithTimeout(`${BASE_URL}/pois/nearby?${params}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to fetch nearby POIs: ${response.status} ${body}`)
  }

  const result = await response.json();
  return result.data;
}

// ========================================
// Whisper Endpoints
// ========================================

export async function fetchWhisper(
  poiId: string,
  timeSlot?: 'morning' | 'afternoon' | 'evening' | 'night',
  token?: string | null
): Promise<WhisperResponse> {
  const params = timeSlot ? `?time_slot=${timeSlot}` : '';

  const response = await fetch(`${BASE_URL}/whisper/poi/${poiId}${params}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch whisper: ${response.statusText}`);
  }

  return response.json();
}

// ========================================
// User Endpoints
// ========================================

export async function fetchDiscoveredWhispers(
  token?: string | null
): Promise<DiscoveredWhisper[]> {
  const response = await fetch(`${BASE_URL}/user/discovered`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch discovered whispers: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

export async function completeWhisper(whisperId: string, token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/whisper/${whisperId}/complete`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to mark whisper complete');
}

export async function fetchUserPreferences(
  token?: string | null
): Promise<UserPreferences> {
  const response = await fetch(`${BASE_URL}/user/preferences`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch preferences: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

export async function patchUserPreferences(
  preferences: Partial<UserPreferences>,
  token?: string | null
): Promise<UserPreferences> {
  const response = await fetch(`${BASE_URL}/user/preferences`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(preferences),
  })

  if (!response.ok) {
    const body = await response.text()
    console.error('[api] PATCH error — status:', response.status, '| body:', body)
    throw new Error(`Failed to update preferences: ${response.status} — ${body}`)
  }

  const result = await response.json()
  return result.data
}

// ========================================
// City Endpoints
// ========================================

export async function fetchCities(token?: string | null) {
  const response = await fetch(`${BASE_URL}/cities`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cities: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchCityById(cityId: string, token?: string | null) {
  const response = await fetch(`${BASE_URL}/cities/${cityId}`, {
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch city: ${response.statusText}`);
  }

  return response.json();
}
