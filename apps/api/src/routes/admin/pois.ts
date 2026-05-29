import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import ngeohash from 'ngeohash'
import { checkPoiDensity } from '../../services/density'
import type { PoiCategory } from '@citywhispers/types'

const PoiCategorySchema = z.enum(['anchor', 'drift', 'echo'])

const CreatePoiSchema = z.object({
  cityId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['landmark', 'food', 'park', 'cultural', 'street', 'neighbourhood', 'market', 'religious', 'building', 'waterfront']),
  tags: z.array(z.string()).default([]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  importanceScore: z.number().min(0).max(100).default(50),
  triggerRadius: z.number().min(10).max(500).default(80),
  cooldownMinutes: z.number().min(0).max(1440).default(60),
  active: z.boolean().default(true),
  // Atmospheric fields
  emotionalTone: z.string().optional(),
  ambientProfile: z.string().optional(),
  timeOfDayAffinity: z.enum(['morning', 'afternoon', 'evening', 'night', 'anytime']).optional(),
  movementContext: z.string().optional(),
  intensityLevel: z.number().min(1).max(5).optional(),
  environmentalTexture: z.string().optional(),
  sourceAttribution: z.string().optional(),
  reviewStatus: z.enum(['draft', 'approved', 'needs_review']).default('draft'),
  contentOwner: z.string().optional(),
  // Sprint H — spatial density fields
  emotionalWeight: z.number().min(1).max(10).default(5),
  poiCategory: PoiCategorySchema.default('drift'),
  minSeparationMeters: z.number().min(0).optional(),
  allowCluster: z.boolean().default(false),
  // Creation-time override — not stored
  overrideConflict: z.boolean().optional(),
})

const UpdatePoiSchema = CreatePoiSchema.omit({ overrideConflict: true }).partial()

// Default minSeparationMeters per poiCategory when not explicitly provided
const DEFAULT_SEPARATION: Record<PoiCategory, number> = {
  anchor: 300,
  drift: 120,
  echo: 50,
}

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

  // POST /admin/pois — density-checked single creation
  app.post('/', async (request, reply) => {
    const body = CreatePoiSchema.parse(request.body)
    const { overrideConflict, minSeparationMeters: minSepOverride, ...poiFields } = body

    const resolvedSeparation = minSepOverride ?? DEFAULT_SEPARATION[poiFields.poiCategory]

    const densityResult = await checkPoiDensity(
      poiFields.latitude,
      poiFields.longitude,
      poiFields.poiCategory,
    )

    if (!densityResult.clear && !overrideConflict) {
      return reply.status(409).send({
        error: 'density_conflict',
        message: 'This POI conflicts with nearby content. Review warnings and resubmit with overrideConflict: true to proceed.',
        warnings: densityResult.warnings,
        nearbyPois: densityResult.nearbyPois,
      })
    }

    if (!densityResult.clear && overrideConflict) {
      const adminId = (request as any).adminId ?? 'unknown'
      const conflictMessages = densityResult.warnings.map((w) => w.message).join(', ')
      console.log(
        `[density] Override acknowledged by ${adminId} at ${new Date().toISOString()}. Conflicts: ${conflictMessages}`
      )
    }

    const geohash6 = ngeohash.encode(poiFields.latitude, poiFields.longitude, 6)

    const poi = await prisma.poi.create({
      data: {
        ...poiFields,
        geohash6,
        minSeparationMeters: resolvedSeparation,
      },
    })

    return reply.status(201).send({ data: poi })
  })

  // POST /admin/pois/bulk — import with per-POI density warnings, never aborts
  app.post('/bulk', async (request, reply) => {
    const BulkSchema = z.object({
      pois: z.array(CreatePoiSchema).min(1).max(100),
    })

    const { pois } = BulkSchema.parse(request.body)

    type ConflictEntry = { name: string; warnings: string[] }
    const conflictReport: ConflictEntry[] = []

    const results = await Promise.allSettled(
      pois.map(async (poi) => {
        const { overrideConflict: _override, minSeparationMeters: minSepOverride, ...poiFields } = poi
        const resolvedSeparation = minSepOverride ?? DEFAULT_SEPARATION[poiFields.poiCategory]
        const geohash6 = ngeohash.encode(poiFields.latitude, poiFields.longitude, 6)

        const densityResult = await checkPoiDensity(
          poiFields.latitude,
          poiFields.longitude,
          poiFields.poiCategory,
        )

        if (!densityResult.clear) {
          conflictReport.push({
            name: poiFields.name,
            warnings: densityResult.warnings.map(
              (w) => `${w.severity} conflict with "${w.conflictingPoi.name}" (${w.conflictingPoi.distanceMeters}m, ${w.conflictingPoi.poiCategory})`
            ),
          })
        }

        return prisma.poi.create({
          data: { ...poiFields, geohash6, minSeparationMeters: resolvedSeparation },
        })
      })
    )

    const succeeded = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value)

    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message)

    if (conflictReport.length > 0) {
      console.log('\n--- Density Conflict Report ---')
      console.log(`${conflictReport.length} POI(s) created with conflicts. Review before approving whispers.\n`)
      for (const entry of conflictReport) {
        for (const warning of entry.warnings) {
          console.log(`⚠  "${entry.name}" — ${warning}`)
        }
      }
      console.log('---\n')
    }

    return reply.status(201).send({
      data: {
        succeeded: succeeded.length,
        failed: failed.length,
        errors: failed,
        densityConflicts: conflictReport.length,
      },
    })
  })

  // PATCH /admin/pois/:id
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = UpdatePoiSchema.parse(request.body)

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
