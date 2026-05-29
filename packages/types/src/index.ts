// packages/types/src/index.ts
// ========================================
// POI Types
// ========================================

export type PoiCategory = 'anchor' | 'drift' | 'echo'

export type NarrativeConflictWarning = {
  severity: 'high' | 'medium' | 'low'
  message: string
  conflictingPoi: {
    id: string
    name: string
    distanceMeters: number
    poiCategory: PoiCategory
    emotionalWeight: number
  }
}

export type DensityCheckResult = {
  clear: boolean
  warnings: NarrativeConflictWarning[]
  nearbyPois: PoiSummary[]
}

export interface PoiSummary {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  /** Distance from user in meters (returned by /pois/nearby as distanceMeters) */
  distanceMeters?: number;
  /** @deprecated Use distanceMeters instead */
  distance?: number;
  importanceScore: number;
  /** Set when the POI has an approved whisper with audio ready — used for preloading */
  audioUrl?: string | null;
  hasWhisper?: boolean;
  visited?: boolean;
  // Sprint H — spatial density fields
  emotionalWeight?: number;
  poiCategory?: PoiCategory;
  minSeparationMeters?: number;
}
export interface PoiAtmosphere {
  /** Dominant emotional register e.g. "Obsolescence", "Isolation" */
  emotionalTone: string | null;
  /** Sensory/atmospheric summary for AI prompt context */
  ambientProfile: string | null;
  /** Optimal trigger window: morning | afternoon | evening | night | anytime */
  timeOfDayAffinity: 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime' | null;
  /** Physical mode e.g. "standing", "slow walk", "passing through" */
  movementContext: string | null;
  /** Emotional weight 1 (subtle) → 5 (overwhelming) */
  intensityLevel: number | null;
  /** Physical texture description e.g. "wet concrete, rusted iron, dense canopy" */
  environmentalTexture: string | null;
  /** Research credit or origin note */
  sourceAttribution: string | null;
  /** Content pipeline state */
  reviewStatus: 'draft' | 'approved' | 'needs_review';
  /** Team member responsible for this POI's content */
  contentOwner: string | null;
}

export interface PoiDetail extends PoiSummary, PoiAtmosphere {
  cityId: string;
  geohash6: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Sprint H — spatial density fields (non-optional on full detail)
  emotionalWeight: number;
  poiCategory: PoiCategory;
  minSeparationMeters: number;
  allowCluster: boolean;
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
  category: string;           // from poi.category — e.g. "waterfront", "market"
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night'; // from generated_whisper.time_slot
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
