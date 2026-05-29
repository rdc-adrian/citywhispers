import { prisma } from '../lib/prisma'
import type { NarrativeConflictWarning, DensityCheckResult, PoiCategory } from '@citywhispers/types'

// Default min-separation thresholds per category (used for the incoming POI)
const CATEGORY_SEPARATION: Record<PoiCategory, number> = {
  anchor: 300,
  drift: 120,
  echo: 50,
}

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Bounding box pre-filter: max possible separation across all categories is 300m.
// ~0.003 degrees latitude ≈ 333m at equator — safe upper bound.
const BOUNDING_BOX_DEGREES = 0.003

export async function checkPoiDensity(
  lat: number,
  lng: number,
  poiCategory: PoiCategory,
  excludePoiId?: string
): Promise<DensityCheckResult> {
  const incomingSeparation = CATEGORY_SEPARATION[poiCategory]

  // Bounding box pre-filter (cheap DB query)
  const existingPois = await prisma.poi.findMany({
    where: {
      active: true,
      latitude: { gte: lat - BOUNDING_BOX_DEGREES, lte: lat + BOUNDING_BOX_DEGREES },
      longitude: { gte: lng - BOUNDING_BOX_DEGREES, lte: lng + BOUNDING_BOX_DEGREES },
      ...(excludePoiId ? { id: { not: excludePoiId } } : {}),
    },
  })

  const warnings: NarrativeConflictWarning[] = []
  const nearbyPois: typeof existingPois = []

  for (const existing of existingPois) {
    const distance = Math.round(
      haversineDistance(lat, lng, existing.latitude, existing.longitude)
    )

    // Conflict if within either threshold — an anchor's 300m exclusion zone
    // applies regardless of the incoming category's own threshold.
    const effectiveSeparation = Math.max(incomingSeparation, existing.minSeparationMeters)
    if (distance > effectiveSeparation) continue

    nearbyPois.push(existing)

    const existingCategory = existing.poiCategory as PoiCategory
    const existingWeight = existing.emotionalWeight

    let severity: NarrativeConflictWarning['severity']
    let message: string

    if (existing.allowCluster) {
      severity = 'low'
      message = 'Intentional cluster — override acknowledged'
    } else if (poiCategory === 'anchor' && existingCategory === 'anchor') {
      severity = 'high'
      message = 'High-density anchor conflict'
    } else if (existingCategory === 'anchor') {
      severity = 'high'
      message = 'High-density anchor conflict'
    } else if (poiCategory === existingCategory) {
      severity = 'medium'
      message = 'Nearby atmospheric overlap'
    } else {
      severity = 'medium'
      message = 'Possible narrative cannibalization'
    }

    warnings.push({
      severity,
      message,
      conflictingPoi: {
        id: existing.id,
        name: existing.name,
        distanceMeters: distance,
        poiCategory: existingCategory,
        emotionalWeight: existingWeight,
      },
    })
  }

  return {
    clear: warnings.length === 0,
    warnings,
    nearbyPois: nearbyPois.map((p) => ({
      id: p.id,
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      category: p.category,
      importanceScore: p.importanceScore,
      emotionalWeight: p.emotionalWeight,
      poiCategory: p.poiCategory as PoiCategory,
      minSeparationMeters: p.minSeparationMeters,
    })),
  }
}
