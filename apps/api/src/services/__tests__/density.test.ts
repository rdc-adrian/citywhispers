/**
 * Sprint H — density service unit tests
 *
 * Prisma is mocked so no DB connection is required.
 * Each test describes a distinct scenario from the spec.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before importing the service under test
vi.mock('../../lib/prisma', () => ({
  prisma: {
    poi: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../lib/prisma'
import { checkPoiDensity } from '../density'

// Helpers to build minimal Poi-shaped objects
function makePoi(overrides: {
  id?: string
  name?: string
  latitude?: number
  longitude?: number
  poiCategory?: string
  emotionalWeight?: number
  minSeparationMeters?: number
  allowCluster?: boolean
}) {
  return {
    id: overrides.id ?? 'poi-1',
    name: overrides.name ?? 'Test POI',
    latitude: overrides.latitude ?? 1.2966,
    longitude: overrides.longitude ?? 103.852,
    poiCategory: overrides.poiCategory ?? 'drift',
    emotionalWeight: overrides.emotionalWeight ?? 5,
    minSeparationMeters: overrides.minSeparationMeters ?? 120,
    allowCluster: overrides.allowCluster ?? false,
    // Other required Poi fields (not used by density logic)
    cityId: 'city-1',
    category: 'landmark',
    tags: [],
    geohash6: 'w21z3q',
    address: null,
    active: true,
    importanceScore: 50,
    triggerRadius: 80,
    cooldownMinutes: 60,
    createdAt: new Date(),
    emotionalTone: null,
    ambientProfile: null,
    timeOfDayAffinity: null,
    movementContext: null,
    intensityLevel: null,
    environmentalTexture: null,
    sourceAttribution: null,
    reviewStatus: 'draft',
    contentOwner: null,
  }
}

// Singapore coordinates — ~80 m apart (roughly 0.00072 degrees latitude)
const BASE_LAT = 1.2966
const BASE_LNG = 103.852

// Offset helpers — approximate degrees for known meter distances
const OFFSET_80M_LAT = 0.00072   // ~80 m north
const OFFSET_200M_LAT = 0.0018   // ~200 m north
const OFFSET_250M_LAT = 0.00225  // ~250 m north
const OFFSET_500M_LAT = 0.0045   // ~500 m north

describe('checkPoiDensity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('two drift POIs 80m apart → one medium warning "Nearby atmospheric overlap"', async () => {
    const existingPoi = makePoi({
      id: 'existing-1',
      latitude: BASE_LAT + OFFSET_80M_LAT,
      longitude: BASE_LNG,
      poiCategory: 'drift',
      minSeparationMeters: 120,
    })
    ;(prisma.poi.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([existingPoi])

    const result = await checkPoiDensity(BASE_LAT, BASE_LNG, 'drift')

    expect(result.clear).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].severity).toBe('medium')
    expect(result.warnings[0].message).toBe('Nearby atmospheric overlap')
  })

  it('one anchor, one drift 200m apart → one high warning (anchor threshold is 300m)', async () => {
    const existingPoi = makePoi({
      id: 'existing-anchor',
      latitude: BASE_LAT + OFFSET_200M_LAT,
      longitude: BASE_LNG,
      poiCategory: 'anchor',
      minSeparationMeters: 300,
    })
    ;(prisma.poi.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([existingPoi])

    const result = await checkPoiDensity(BASE_LAT, BASE_LNG, 'drift')

    expect(result.clear).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].severity).toBe('high')
    expect(result.warnings[0].message).toBe('High-density anchor conflict')
  })

  it('conflict POI has allowCluster: true → one low warning', async () => {
    const existingPoi = makePoi({
      id: 'existing-cluster',
      latitude: BASE_LAT + OFFSET_80M_LAT,
      longitude: BASE_LNG,
      poiCategory: 'drift',
      minSeparationMeters: 120,
      allowCluster: true,
    })
    ;(prisma.poi.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([existingPoi])

    const result = await checkPoiDensity(BASE_LAT, BASE_LNG, 'drift')

    expect(result.clear).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].severity).toBe('low')
    expect(result.warnings[0].message).toBe('Intentional cluster — override acknowledged')
  })

  it('any two POIs 500m apart → clear with no warnings', async () => {
    const existingPoi = makePoi({
      id: 'far-away',
      latitude: BASE_LAT + OFFSET_500M_LAT,
      longitude: BASE_LNG,
      poiCategory: 'anchor',
      minSeparationMeters: 300,
    })
    ;(prisma.poi.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([existingPoi])

    const result = await checkPoiDensity(BASE_LAT, BASE_LNG, 'drift')

    expect(result.clear).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('incoming anchor + existing anchor 250m apart → high warning "High-density anchor conflict"', async () => {
    const existingPoi = makePoi({
      id: 'existing-anchor-2',
      latitude: BASE_LAT + OFFSET_250M_LAT,
      longitude: BASE_LNG,
      poiCategory: 'anchor',
      minSeparationMeters: 300,
    })
    ;(prisma.poi.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([existingPoi])

    const result = await checkPoiDensity(BASE_LAT, BASE_LNG, 'anchor')

    expect(result.clear).toBe(false)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].severity).toBe('high')
    expect(result.warnings[0].message).toBe('High-density anchor conflict')
  })
})
