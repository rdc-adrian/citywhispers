import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import ngeohash from 'ngeohash'

const CreatePoiSchema = z.object({
  cityId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['landmark', 'food', 'park', 'cultural', 'street']),
  tags: z.array(z.string()).default([]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  importanceScore: z.number().min(0).max(100).default(50),
  triggerRadius: z.number().min(10).max(500).default(80),
  cooldownMinutes: z.number().min(0).max(1440).default(60),
  active: z.boolean().default(true),
})

const UpdatePoiSchema = CreatePoiSchema.partial()

export async function adminPoiRoutes(app: FastifyInstance) {
  // GET /admin/pois?cityId=xxx
  app.get<{ Querystring: { cityId?: string } }>('/', async (request) => {
    const { cityId } = request.query
    const pois = await prisma.poi.findMany({
      where: cityId ? { cityId } : undefined,
      include: {
        _count: { select: { poiFacts: true, generatedWhispers: true } },
      },
      orderBy: [{ importanceScore: 'desc' }, { name: 'asc' }],
    })
    return { data: pois }
  })

  // GET /admin/pois/:id
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const poi = await prisma.poi.findUnique({
      where: { id: request.params.id },
      include: {
        poiFacts: true,
        generatedWhispers: {
          include: { persona: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!poi) return { error: 'POI not found' }
    return { data: poi }
  })

  // POST /admin/pois — auto-calculates geohash
  app.post('/', async (request, reply) => {
    const body = CreatePoiSchema.parse(request.body)

    // Auto-calculate geohash from coordinates
    const geohash6 = ngeohash.encode(body.latitude, body.longitude, 6)

    const poi = await prisma.poi.create({
      data: { ...body, geohash6 },
    })

    return reply.status(201).send({ data: poi })
  })

  // POST /admin/pois/bulk — import multiple POIs at once
  app.post('/bulk', async (request, reply) => {
    const BulkSchema = z.object({
      pois: z.array(CreatePoiSchema).min(1).max(100),
    })

    const { pois } = BulkSchema.parse(request.body)

    const results = await Promise.allSettled(
      pois.map(async (poi) => {
        const geohash6 = ngeohash.encode(poi.latitude, poi.longitude, 6)
        return prisma.poi.create({ data: { ...poi, geohash6 } })
      })
    )

    const succeeded = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value)

    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message)

    return reply.status(201).send({
      data: { succeeded: succeeded.length, failed: failed.length, errors: failed },
    })
  })

  // PATCH /admin/pois/:id
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = UpdatePoiSchema.parse(request.body)

    // Recalculate geohash if coordinates changed
    let geohash6: string | undefined
    if (body.latitude !== undefined && body.longitude !== undefined) {
      geohash6 = ngeohash.encode(body.latitude, body.longitude, 6)
    }

    const poi = await prisma.poi.update({
      where: { id: request.params.id },
      data: { ...body, ...(geohash6 ? { geohash6 } : {}) },
    })
    return { data: poi }
  })

  // DELETE /admin/pois/:id — soft delete
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await prisma.poi.update({
      where: { id: request.params.id },
      data: { active: false },
    })
    return reply.status(204).send()
  })
}