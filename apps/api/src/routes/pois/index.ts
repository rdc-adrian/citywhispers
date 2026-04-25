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
    }
  }>('/nearby', async (request) => {
    const lat = parseFloat(request.query.lat)
    const lng = parseFloat(request.query.lng)
    const radius = parseInt(request.query.radius ?? '500')
    const limit = parseInt(request.query.limit ?? '20')

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
          where: { isStale: false },
          select: { id: true },
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
        return {
          id: poi.id,
          name: poi.name,
          latitude: poi.latitude,
          longitude: poi.longitude,
          category: poi.category,
          hasWhisper: poi.generatedWhispers.length > 0,
          distanceMeters,
          visited: false,
        }
      })
      .filter((poi) => poi.distanceMeters <= radius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit)

    return { data: nearby }
  })
}
