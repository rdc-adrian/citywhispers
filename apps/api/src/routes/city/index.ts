import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../lib/errors'
import ngeohash from 'ngeohash'

// Calculate distance between two coordinates in meters
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
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

export async function cityRoutes(app: FastifyInstance) {
  // Register specific routes FIRST (before dynamic /:id routes)
  
  // NOW register the general routes AFTER specific ones
  
  // GET /cities — list all active cities
  app.get('/', async () => {
    const cities = await prisma.city.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    })
    return { data: cities }
  })

  // GET /cities/:id — get a single city with its POIs
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const city = await prisma.city.findUnique({
      where: { id: request.params.id },
      include: {
        pois: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
      },
    })
    if (!city) throw new NotFoundError('City')
    return { data: city }
  })

  // GET /cities/:id/pois — get all POIs for a city
  app.get<{ Params: { id: string } }>('/:id/pois', async (request) => {
    const pois = await prisma.poi.findMany({
      where: {
        cityId: request.params.id,
        active: true,
      },
      include: {
        poiFacts: { where: { verified: true } },
      },
      orderBy: { name: 'asc' },
    })
    return { data: pois }
  })
}
