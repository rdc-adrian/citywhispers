import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const CreatePoiFactSchema = z.object({
  poiId: z.string().min(1),
  factType: z.enum(['historical', 'cultural', 'food', 'architectural']),
  body: z.string().min(10).max(500),
  sourceUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
})

const CreateBulkPoiFactSchema = z.object({
  facts: z.array(CreatePoiFactSchema).min(1).max(50),
})

export async function adminPoiFactRoutes(app: FastifyInstance) {
  // GET /admin/poi-facts?poiId=xxx
  app.get<{ Querystring: { poiId?: string } }>('/', async (request) => {
    const { poiId } = request.query
    const facts = await prisma.poiFact.findMany({
      where: poiId ? { poiId } : undefined,
      include: { poi: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { data: facts }
  })

  // POST /admin/poi-facts — single fact
  app.post('/', async (request, reply) => {
    const body = CreatePoiFactSchema.parse(request.body)
    const fact = await prisma.poiFact.create({ data: body })
    return reply.status(201).send({ data: fact })
  })

  // POST /admin/poi-facts/bulk — multiple facts
  app.post('/bulk', async (request, reply) => {
    const { facts } = CreateBulkPoiFactSchema.parse(request.body)
    const created = await prisma.poiFact.createMany({
      data: facts,
      skipDuplicates: true,
    })
    return reply.status(201).send({ data: { count: created.count } })
  })

  // PATCH /admin/poi-facts/:id
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = CreatePoiFactSchema.partial().parse(request.body)
    const fact = await prisma.poiFact.update({
      where: { id: request.params.id },
      data: body,
    })
    return { data: fact }
  })

  // PATCH /admin/poi-facts/:id/verify — quick verify toggle
  app.patch<{ Params: { id: string } }>('/:id/verify', async (request) => {
    const fact = await prisma.poiFact.update({
      where: { id: request.params.id },
      data: { verified: true },
    })
    return { data: fact }
  })

  // DELETE /admin/poi-facts/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await prisma.poiFact.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}