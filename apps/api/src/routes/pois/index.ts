import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import ngeohash from 'ngeohash'

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export async function poisRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      lat: string
      lng: string
      radius?: string
      limit?: string
      suppressOverlap?: string
    }
  }>('/nearby', async (request) => {
    const lat = parseFloat(request.query.lat)
    const lng = parseFloat(request.query.lng)
    const radius = parseInt(request.query.radius ?? '500')
    const limit = parseInt(request.query.limit ?? '20')
    const suppressOverlap = request.query.suppressOverlap === 'true'

    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Invalid lat/lng')
    }

    const centerHash = ngeohash.encode(lat, lng, 6)
    const neighbours = ngeohash.neighbors(centerHash)
    const searchHashes = [centerHash, ...Object.values(neighbours)]

    const pois = await prisma.poi.findMany({
      where: {
        active: true,
        geohash6: { in: searchHashes },
      },
      include: {
        generatedWhispers: {
          where: { isStale: false, status: 'approved' } as any,
          select: { id: true, audioUrl: true },
          orderBy: { qualityScore: 'desc' },
          take: 1,
        },
      },
      orderBy: { importanceScore: 'desc' },
      take: limit * 2,
    })

    const nearby = pois
      .map((poi) => {
        const distanceMeters = Math.round(
          haversineDistance(lat, lng, poi.latitude, poi.longitude)
        )
        const bestWhisper = poi.generatedWhispers[0] ?? null
        return {
          id: poi.id,
          name: poi.name,
          latitude: poi.latitude,
          longitude: poi.longitude,
          category: poi.category,
          hasWhisper: bestWhisper !== null,
          audioUrl: bestWhisper?.audioUrl ?? null,
          distanceMeters,
          importanceScore: poi.importanceScore,
          visited: false,
          // Sprint H — spatial density fields
          emotionalWeight: poi.emotionalWeight,
          poiCategory: poi.poiCategory,
          minSeparationMeters: poi.minSeparationMeters,
        }
      })
      .filter((poi) => poi.distanceMeters <= radius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit)

    if (!suppressOverlap) {
      return { data: nearby }
    }

    // Server-side overlap suppression: for any two POIs within each other's
    // minSeparationMeters, keep only the one with the higher emotionalWeight.
    const suppressed = new Set<string>()

    for (let i = 0; i < nearby.length; i++) {
      if (suppressed.has(nearby[i].id)) continue

      for (let j = i + 1; j < nearby.length; j++) {
        if (suppressed.has(nearby[j].id)) continue

        const dist = Math.round(
          haversineDistance(
            nearby[i].latitude, nearby[i].longitude,
            nearby[j].latitude, nearby[j].longitude
          )
        )

        const threshold = Math.max(
          nearby[i].minSeparationMeters,
          nearby[j].minSeparationMeters
        )

        if (dist <= threshold) {
          // Higher emotionalWeight wins. On a tie, lower id wins (lexicographic)
          // so the result is deterministic regardless of distance sort order — prevents
          // markers flickering when small user movement swaps the distance ranking.
          const iWins =
            nearby[i].emotionalWeight > nearby[j].emotionalWeight ||
            (nearby[i].emotionalWeight === nearby[j].emotionalWeight &&
              nearby[i].id < nearby[j].id)
          suppressed.add(iWins ? nearby[j].id : nearby[i].id)
        }
      }
    }

    return { data: nearby.filter((p) => !suppressed.has(p.id)) }
  })
}
