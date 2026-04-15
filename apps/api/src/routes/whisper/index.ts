import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../lib/errors'
import { z } from 'zod'

const TriggerSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  userId: z.string(),
  personaId: z.string().optional(),
  cityId: z.string(),
})

export async function whisperRoutes(app: FastifyInstance) {
  // GET /whispers/:id — get a single whisper
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const whisper = await prisma.generatedWhisper.findUnique({
      where: { id: request.params.id },
      include: { persona: true, poi: true },
    })
    if (!whisper) throw new NotFoundError('Whisper')
    return { data: whisper }
  })

  // POST /whispers/trigger — GPS trigger entry point
  // This will connect to the AI layer in the next phase
  app.post('/trigger', async (request) => {
    const body = TriggerSchema.parse(request.body)

    // Phase 1: return nearest existing whisper for this location
    // Phase 2: this will call WhisperOrchestrator
    const whisper = await prisma.generatedWhisper.findFirst({
      where: {
        cityId: body.cityId,
        isStale: false,
      },
      include: { persona: true },
      orderBy: { createdAt: 'desc' },
    })

    return {
      data: whisper,
      cached: true,
      unlocked: true,
    }
  })

  // GET /whispers/city/:cityId — all whispers for a city
  app.get<{ Params: { cityId: string } }>('/city/:cityId', async (request) => {
    const whispers = await prisma.generatedWhisper.findMany({
      where: {
        cityId: request.params.cityId,
        isStale: false,
      },
      include: { persona: true, poi: true },
      orderBy: { createdAt: 'desc' },
    })
    return { data: whispers }
  })
}