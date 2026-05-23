// packages/types/src/index.ts
// ========================================
// POI Types
// ========================================
export interface PoiSummary {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distance?: number; // Distance from user in meters
  importanceScore: number;
}
export interface PoiDetail extends PoiSummary {
  cityId: string;
  geohash6: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
// ========================================
// Whisper Types
// ========================================
export interface WhisperResponse {
  id: string;
  poiId: string;
  whisperText: string;
  audioUrl: string | null;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  personaSlug: string;
  createdAt: Date;
}
export interface WhisperContext {
  poiName: string;
  cityName: string;
  category: string;
  timeSlot: string;
  weather?: string;
  nearbyPois?: string[];
}
// ========================================
// User Types
// ========================================
export interface UserPreferences {
  autoplay: boolean;
  radiusMeters: number;
  showVisited: boolean;
  darkMode: boolean;
  language: string;
  notifications: boolean;
}
export interface DiscoveredWhisper {
  id: string;
  whisperId: string;
  poiId: string;
  poiName: string;
  cityName: string;
  whisperText: string;
  audioUrl: string | null;
  discoveredAt: string;       // ISO 8601 — serialised from DB Date by Fastify
  completedAt: string | null; // null until audio plays to end
}
export interface CompleteWhisperBody {
  // currently empty — whisperId comes from the URL param
  // reserved for future fields e.g. listenDurationSeconds
}
// ========================================
// City Types
// ========================================
export interface City {
  id: string;
  name: string;
  countryCode: string;
  timezone: string;
  status: 'active' | 'inactive' | 'coming_soon';
  createdAt: Date;
  updatedAt: Date;
}
export interface CityWithPois extends City {
  pois: PoiSummary[];
}
// ========================================
// Persona Types
// ========================================
export interface Persona {
  id: string;
  slug: string;
  name: string;
  tonePrompt: string;
}
// ========================================
// API Response Types
// ========================================
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
