import { FastifyInstance } from 'fastify'
import { getAuth, type SessionAuthObject } from '@clerk/fastify'
import { prisma } from '../../lib/prisma'
import { z } from 'zod'

function getClerkId(request: Parameters<typeof getAuth>[0]): string | null {
  const auth = getAuth(request) as SessionAuthObject
  return auth.userId ?? null
}

const PreferencesSchema = z.object({
  autoplay: z.boolean().optional(),
  radiusMeters: z.number().optional(),
  showVisited: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  language: z.string().optional(),
  notifications: z.boolean().optional(),
})

// Shape of the JSON blob we persist in prefs_json
interface PrefsJson {
  autoplay?: boolean
  radiusMeters?: number
  showVisited?: boolean
  darkMode?: boolean
}

// Cast helper — works around Prisma v7 type generation path mismatch
function asPrefsJson(val: unknown): PrefsJson {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as PrefsJson
  }
  return {}
}

export async function userRoutes(app: FastifyInstance) {
  // Temporary auth debug endpoint — remove after confirming Clerk works on Render
  app.get('/auth-check', async (request) => {
    const auth = getAuth(request) as SessionAuthObject
    return {
      userId: auth.userId ?? null,
      hasAuthHeader: !!(request.headers.authorization),
      authHeaderPrefix: request.headers.authorization?.slice(0, 15) ?? null,
    }
  })

  // GET /user/discovered — whisper history for current user
  app.get('/discovered', async (request) => {
    const clerkId = getClerkId(request)
    if (!clerkId) return { data: [] }

    const user = await prisma.user.findUnique({
      where: { clerkId },
    })
    if (!user) return { data: [] }

    const events = await prisma.userWhisperEvent.findMany({
      where: { userId: user.id },
      include: {
        whisper: {
          include: {
            poi: {
              include: {
                city: true,
              },
            },
          },
        },
      },
      orderBy: { triggeredAt: 'desc' },
    })

    return {
      data: events.map((e) => ({
        id: e.id,
        whisperId: e.whisperId,
        poiId: e.whisper.poiId,
        poiName: e.whisper.poi?.name ?? 'Unknown',
        cityName: e.whisper.poi?.city?.name ?? 'Unknown',
        whisperText: e.whisper.whisperText,
        audioUrl: e.whisper.audioUrl,
        discoveredAt: e.triggeredAt,
      })),
    }
  })

  // GET /user/preferences — fetch current user's saved preferences
  app.get('/preferences', async (request) => {
    const clerkId = getClerkId(request)
    request.log.info({ clerkId, hasAuth: !!request.headers.authorization }, 'GET /user/preferences')
    if (!clerkId) throw new Error('Unauthorized')

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { preferences: true },
    })

    if (!user || !user.preferences) {
      return {
        data: {
          autoplay: false,
          radiusMeters: 500,
          showVisited: true,
          darkMode: true,
          language: 'English',
          notifications: false,
        },
      }
    }

    const p = user.preferences
    const json = asPrefsJson((p as any).prefsJson)

    return {
      data: {
        autoplay: json.autoplay ?? false,
        radiusMeters: json.radiusMeters ?? 500,
        showVisited: json.showVisited ?? true,
        darkMode: json.darkMode ?? true,
        language: p.languageCode === 'en' ? 'English' : p.languageCode,
        notifications: p.notificationsOn,
      },
    }
  })

  // PATCH /user/preferences — save all preference fields
  app.patch('/preferences', async (request) => {
    const prefs = PreferencesSchema.parse(request.body)
    const clerkId = getClerkId(request)
    if (!clerkId) throw new Error('Unauthorized')

    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { preferences: true },
    })
    if (!user) throw new Error('User not found')

    const existingJson = asPrefsJson((user.preferences as any)?.prefsJson)
    const updatedJson: PrefsJson = {
      ...existingJson,
      ...(prefs.autoplay !== undefined && { autoplay: prefs.autoplay }),
      ...(prefs.radiusMeters !== undefined && { radiusMeters: prefs.radiusMeters }),
      ...(prefs.showVisited !== undefined && { showVisited: prefs.showVisited }),
      ...(prefs.darkMode !== undefined && { darkMode: prefs.darkMode }),
    }

    const prefsData = {
      notificationsOn: prefs.notifications ?? user.preferences?.notificationsOn,
      languageCode: prefs.language ?? user.preferences?.languageCode,
      prefsJson: updatedJson as any,
    }

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: prefsData,
      create: {
        userId: user.id,
        notificationsOn: prefs.notifications ?? true,
        languageCode: prefs.language ?? 'en',
        prefsJson: updatedJson as any,
      },
    })

    return {
      data: {
        autoplay: updatedJson.autoplay ?? false,
        radiusMeters: updatedJson.radiusMeters ?? 500,
        showVisited: updatedJson.showVisited ?? true,
        darkMode: updatedJson.darkMode ?? true,
        language: prefs.language ?? (user.preferences?.languageCode === 'en' ? 'English' : user.preferences?.languageCode ?? 'English'),
        notifications: prefs.notifications ?? user.preferences?.notificationsOn ?? false,
      },
    }
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
