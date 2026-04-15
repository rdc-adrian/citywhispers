import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const CreateWhisperSchema = z.object({
  poiId: z.string().optional(),
  cityId: z.string().min(1),
  personaId: z.string().min(1),
  geohash6: z.string().length(6),
  timeSlot: z.enum(['morning', 'afternoon', 'evening', 'night']),
  whisperText: z.string().min(10).max(1000),
  source: z.enum(['ai', 'curated', 'community']).default('curated'),
  qualityScore: z.number().min(0).max(1).optional(),
  isFeatured: z.boolean().default(false),
})

export async function adminWhisperRoutes(app: FastifyInstance) {
  // GET /admin/whispers?cityId=xxx&personaId=xxx&timeSlot=xxx
  app.get<{
    Querystring: {
      cityId?: string
      personaId?: string
      timeSlot?: string
      isFeatured?: string
    }
  }>('/', async (request) => {
    const { cityId, personaId, timeSlot, isFeatured } = request.query
    const whispers = await prisma.generatedWhisper.findMany({
      where: {
        ...(cityId ? { cityId } : {}),
        ...(personaId ? { personaId } : {}),
        ...(timeSlot ? { timeSlot } : {}),
        ...(isFeatured ? { isFeatured: isFeatured === 'true' } : {}),
      },
      include: {
        persona: { select: { slug: true, name: true } },
        poi: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { data: whispers }
  })

  // POST /admin/whispers — create curated whisper
  app.post('/', async (request, reply) => {
    const body = CreateWhisperSchema.parse(request.body)
    const whisper = await prisma.generatedWhisper.create({
      data: {
        ...body,
        modelUsed: 'curated',
        promptHash: `curated-${body.geohash6}-${body.personaId}-${body.timeSlot}-${Date.now()}`,
      },
    })
    return reply.status(201).send({ data: whisper })
  })

  // PATCH /admin/whispers/:id
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = CreateWhisperSchema.partial().parse(request.body)
    const whisper = await prisma.generatedWhisper.update({
      where: { id: request.params.id },
      data: body,
    })
    return { data: whisper }
  })

  // PATCH /admin/whispers/:id/feature — toggle featured
  app.patch<{ Params: { id: string } }>('/:id/feature', async (request) => {
    const { isFeatured } = z.object({
      isFeatured: z.boolean(),
    }).parse(request.body)

    const whisper = await prisma.generatedWhisper.update({
      where: { id: request.params.id },
      data: { isFeatured },
    })
    return { data: whisper }
  })

  // PATCH /admin/whispers/:id/stale — mark as stale
  app.patch<{ Params: { id: string } }>('/:id/stale', async (_, reply) => {
    const { id } = _ .params as { id: string }
    const whisper = await prisma.generatedWhisper.update({
      where: { id },
      data: { isStale: true },
    })
    return { data: whisper }
  })

  // DELETE /admin/whispers/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await prisma.generatedWhisper.delete({
      where: { id: request.params.id },
    })
    return reply.status(204).send()
  })
}