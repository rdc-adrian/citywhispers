import { FastifyInstance } from 'fastify'
import { getAuth, type SessionAuthObject } from '@clerk/fastify'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../lib/errors'
import { z } from 'zod'

function getClerkId(request: Parameters<typeof getAuth>[0]): string | null {
  const auth = getAuth(request) as SessionAuthObject
  return auth.userId ?? null
}

const TriggerSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  userId: z.string(),
  personaId: z.string().optional(),
  cityId: z.string(),
})

export async function whisperRoutes(app: FastifyInstance) {
  // GET /whisper/:id — get a single whisper by whisper id
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const whisper = await prisma.generatedWhisper.findUnique({
      where: { id: request.params.id },
      include: { persona: true, poi: true },
    })
    if (!whisper) throw new NotFoundError('Whisper')
    return { data: whisper }
  })

  // GET /whisper/poi/:poiId — get whisper for a specific POI
  app.get<{
    Params: { poiId: string }
    Querystring: { time_slot?: string }
  }>('/poi/:poiId', async (request) => {
    const { poiId } = request.params
    const timeSlot = request.query.time_slot ?? 'morning'

    // Try to find an exact time slot match first
    let whisper = await prisma.generatedWhisper.findFirst({
      where: {
        poiId,
        timeSlot,
        isStale: false,
      },
      include: { persona: true },
      orderBy: { qualityScore: 'desc' },
    })

    // Fall back to any whisper for this POI
    if (!whisper) {
      whisper = await prisma.generatedWhisper.findFirst({
        where: { poiId, isStale: false },
        include: { persona: true },
        orderBy: { qualityScore: 'desc' },
      })
    }

    if (!whisper) throw new NotFoundError('Whisper')

    const userId = getClerkId(request)
    if (userId) {
      try {
        await prisma.userWhisperEvent.upsert({
          where: {
            userId_whisperId: {
              userId,
              whisperId: whisper.id,
            },
          },
          create: {
            userId,
            whisperId: whisper.id,
            triggeredAt: new Date(),
          },
          update: {},
        })
      } catch (err) {
        request.log.warn({ err }, 'Failed to write discovery event — non-fatal')
      }
    }

    return {
      id: whisper.id,
      poiId,
      whisperText: whisper.whisperText,
      audioUrl: whisper.audioUrl,
      timeSlot: whisper.timeSlot,
      personaSlug: whisper.persona?.slug ?? '',
      createdAt: whisper.createdAt,
    }
  })

  // POST /whispers/trigger
  app.post('/trigger', async (request) => {
    const body = TriggerSchema.parse(request.body)
    const whisper = await prisma.generatedWhisper.findFirst({
      where: { cityId: body.cityId, isStale: false },
      include: { persona: true },
      orderBy: { createdAt: 'desc' },
    })
    return { data: whisper, cached: true, unlocked: true }
  })

  // GET /whispers/city/:cityId
  app.get<{ Params: { cityId: string } }>('/city/:cityId', async (request) => {
    const whispers = await prisma.generatedWhisper.findMany({
      where: { cityId: request.params.cityId, isStale: false },
      include: { persona: true, poi: true },
      orderBy: { createdAt: 'desc' },
    })
    return { data: whispers }
  })
}
