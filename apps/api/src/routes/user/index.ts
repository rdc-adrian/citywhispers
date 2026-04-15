import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../lib/errors'
import { z } from 'zod'

const PreferencesSchema = z.object({
  personaId: z.string().optional(),
  languageCode: z.string().default('en'),
  preferredCategories: z.array(z.string()).default([]),
  notificationsOn: z.boolean().default(true),
})

export async function userRoutes(app: FastifyInstance) {
  // GET /users/:id — get user profile
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      include: { preferences: true },
    })
    if (!user) throw new NotFoundError('User')
    return { data: user }
  })

  // PUT /users/:id/preferences — update preferences
  app.put<{ Params: { id: string } }>('/:id/preferences', async (request) => {
    const body = PreferencesSchema.parse(request.body)
    const preferences = await prisma.userPreference.upsert({
      where: { userId: request.params.id },
      update: { ...body },
      create: { userId: request.params.id, ...body },
    })
    return { data: preferences }
  })

  // GET /users/:id/history — whisper history
  app.get<{ Params: { id: string } }>('/:id/history', async (request) => {
    const events = await prisma.userWhisperEvent.findMany({
      where: { userId: request.params.id },
      include: {
        whisper: {
          include: { persona: true, poi: true },
        },
      },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
    })
    return { data: events }
  })
}