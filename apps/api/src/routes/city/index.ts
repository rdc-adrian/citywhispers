import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../lib/errors'

export async function cityRoutes(app: FastifyInstance) {
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
        poiFacts: {
          where: { verified: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    return { data: pois }
  })
}