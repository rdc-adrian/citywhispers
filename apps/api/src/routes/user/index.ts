import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { z } from 'zod'

const PreferencesSchema = z.object({
  autoplay: z.boolean().optional(),
  radiusMeters: z.number().optional(),
  showVisited: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  language: z.string().optional(),
  notifications: z.boolean().optional(),
})

export async function userRoutes(app: FastifyInstance) {
  // GET /user/discovered — whisper history for current user
  app.get('/discovered', async (request) => {
    const clerkId = (request as any).user?.sub
    if (!clerkId) return { data: [] }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    })
    if (!user) return { data: [] }

    const events = await prisma.userWhisperEvent.findMany({
      where: { userId: user.id },
      include: {
        whisper: {
          include: { poi: true },
        },
      },
      orderBy: { triggeredAt: 'desc' },
    })

    return {
      data: events.map((e) => ({
        whisperId: e.whisperId,
        poiId: e.whisper.poiId,
        poiName: e.whisper.poi?.name ?? 'Unknown',
        whisperText: e.whisper.whisperText,
        audioUrl: e.whisper.audioUrl,
        discoveredAt: e.triggeredAt,
      })),
    }
  })

  // PATCH /user/preferences
  app.patch('/preferences', async (request) => {
    const prefs = PreferencesSchema.parse(request.body)
    const clerkId = (request as any).user?.sub
    if (!clerkId) throw new Error('Unauthorized')

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new Error('User not found')

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {
        notificationsOn: prefs.notifications,
        languageCode: prefs.language,
      },
      create: {
        userId: user.id,
        notificationsOn: prefs.notifications ?? true,
        languageCode: prefs.language ?? 'en',
      },
    })

    return { data: prefs }
  })

  // GET /user/:id (legacy)
  app.get<{ Params: { id: string } }>('/:id', async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      include: { preferences: true },
    })
    return { data: user }
  })
}
