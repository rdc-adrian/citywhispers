import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import ngeohash from 'ngeohash'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const adapter = new PrismaPg({
  connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!,
  ssl: { rejectUnauthorized: false },
} as any)

const prisma = new PrismaClient({ adapter })

// ── Types ────────────────────────────────────────────────────────────────────

interface PoiJsonEntry {
  poi: {
    name: string
    slug: string
    citySlug: string
    description: string
    lat: number
    lng: number
    triggerRadiusMeters: number
    category: string
    imageUrl: string
    atmosphere: {
      emotionalTone: string
      ambientProfile: string
      timeOfDayAffinity: string
      movementContext: string
      intensityLevel: number
      environmentalTexture: string
      sourceAttribution: string
      reviewStatus: string
      contentOwner: string
    }
  }
  facts: Array<{
    factType: string
    content: string
    verified: boolean
    sourceUrl: string | null
  }>
  whisper: {
    text: string
    audioScript: string
    voice: string
    durationSeconds: number
    audioFileName: string
  }
}

interface ConflictWarning {
  poi: string
  severity: 'low' | 'medium' | 'high'
  conflictingWith: string
  distance: number
  poiCategory: string
  neighborCategory: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// waterfront and landmark POIs occupy a wide emotional territory → anchor
function derivePoiCategory(category: string): 'anchor' | 'drift' | 'echo' {
  if (category === 'waterfront' || category === 'landmark') return 'anchor'
  return 'drift'
}

function deriveMinSeparationMeters(poiCategory: string, triggerRadiusMeters: number): number {
  if (poiCategory === 'anchor') return 300
  if (triggerRadiusMeters >= 120) return 200
  return 120
}

function mapTimeSlot(affinity: string): string {
  const map: Record<string, string> = {
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening',
    night: 'night',
    anytime: 'morning',
  }
  return map[affinity] ?? 'morning'
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🇸🇬  Singapore Production Seed\n')

  // Singapore city — match the id from seed.ts; create if missing
  const city = await prisma.city.upsert({
    where: { id: 'city-singapore' },
    update: {},
    create: {
      id: 'city-singapore',
      name: 'Singapore',
      countryCode: 'SG',
      timezone: 'Asia/Singapore',
      status: 'active',
    },
  })
  console.log(`City: ${city.name} (${city.id})`)

  // Persona — prefer declan-sage (matches Singapore voice direction); fall back to any active
  const persona =
    (await prisma.persona.findUnique({ where: { slug: 'declan-sage' } })) ??
    (await prisma.persona.findFirst({ where: { active: true } }))
  if (!persona) throw new Error('No active persona found — run seed.ts first.')
  console.log(`Persona: ${persona.name} (${persona.slug})\n`)

  const resourceDir = path.join(__dirname, '../../../resources/pois')
  const POI_FILES = fs.readdirSync(resourceDir)
    .filter(f => f.endsWith('.json'))
    .sort()
  const conflicts: ConflictWarning[] = []
  let created = 0
  let skipped = 0

  for (const fileName of POI_FILES) {
    const entries: PoiJsonEntry[] = JSON.parse(
      fs.readFileSync(path.join(resourceDir, fileName), 'utf-8')
    )
    console.log(`📂  ${fileName} — ${entries.length} entries`)

    for (const entry of entries) {
      const { poi, facts, whisper } = entry
      const poiId = poi.slug // slug used as stable DB id — same pattern as existing seeds

      // Primary guard: skip if the slug-based id already exists
      const existingById = await prisma.poi.findUnique({ where: { id: poiId } })

      // Secondary guard: catch pre-existing records at the same coordinates seeded under a
      // different id (e.g., from an earlier seed run with a different id scheme). Without this,
      // the neighbor query below would return the old record, producing a false self-conflict.
      const existingByCoords = existingById
        ? null
        : await prisma.poi.findFirst({
            where: { cityId: city.id, latitude: poi.lat, longitude: poi.lng, active: true },
          })

      if (existingById || existingByCoords) {
        const reason = existingById
          ? 'id match'
          : `coords match (existing: "${existingByCoords!.name}")`
        console.log(`    ⏭  ${poi.name} — skipped (${reason})`)
        skipped++
        continue
      }

      const poiCategory = derivePoiCategory(poi.category)
      const emotionalWeight = poi.atmosphere.intensityLevel
      const minSeparationMeters = deriveMinSeparationMeters(poiCategory, poi.triggerRadiusMeters)
      const geohash6 = ngeohash.encode(poi.lat, poi.lng, 6)

      // ── Density conflict check — runs BEFORE create so no self-exclusion needed ──────────
      // Bounding box pre-filter: 0.003° ≈ 333m — covers the widest anchor threshold (300m)
      const BBOX = 0.003
      const neighbors = await prisma.poi.findMany({
        where: {
          active: true,
          latitude: { gte: poi.lat - BBOX, lte: poi.lat + BBOX },
          longitude: { gte: poi.lng - BBOX, lte: poi.lng + BBOX },
        },
      })

      for (const neighbor of neighbors) {
        const dist = Math.round(
          haversine(poi.lat, poi.lng, neighbor.latitude, neighbor.longitude)
        )
        const effectiveSep = Math.max(minSeparationMeters, neighbor.minSeparationMeters)
        if (dist > effectiveSep) continue

        const neighborCategory = neighbor.poiCategory as 'anchor' | 'drift' | 'echo'
        const severity: ConflictWarning['severity'] =
          neighbor.allowCluster
            ? 'low'
            : poiCategory === 'anchor' || neighborCategory === 'anchor'
              ? 'high'
              : 'medium'

        conflicts.push({
          poi: poi.name,
          severity,
          conflictingWith: neighbor.name,
          distance: dist,
          poiCategory,
          neighborCategory,
        })
      }

      // ── Create POI ────────────────────────────────────────────────────────────────────────
      await prisma.poi.create({
        data: {
          id: poiId,
          cityId: city.id,
          name: poi.name,
          category: poi.category,
          tags: [],
          geohash6,
          latitude: poi.lat,
          longitude: poi.lng,
          active: true,
          importanceScore: emotionalWeight * 20,
          triggerRadius: poi.triggerRadiusMeters,
          cooldownMinutes: 60,
          // Atmospheric metadata
          emotionalTone: poi.atmosphere.emotionalTone,
          ambientProfile: poi.atmosphere.ambientProfile,
          timeOfDayAffinity: poi.atmosphere.timeOfDayAffinity,
          movementContext: poi.atmosphere.movementContext,
          intensityLevel: poi.atmosphere.intensityLevel,
          environmentalTexture: poi.atmosphere.environmentalTexture,
          sourceAttribution: poi.atmosphere.sourceAttribution,
          reviewStatus: poi.atmosphere.reviewStatus,
          contentOwner: poi.atmosphere.contentOwner,
          // Sprint H density fields
          emotionalWeight,
          poiCategory,
          minSeparationMeters,
          allowCluster: false,
        },
      })

      console.log(
        `    ✅  ${poi.name} — ${poiCategory}, weight: ${emotionalWeight}, sep: ${minSeparationMeters}m`
      )
      created++

      // Facts — POI is brand-new so no duplicates possible; plain createMany is safe
      await prisma.poiFact.createMany({
        data: facts.map((f) => ({
          poiId,
          factType: f.factType,
          body: f.content,
          verified: f.verified,
          sourceUrl: f.sourceUrl,
        })),
      })

      // Whisper — draft until audio is generated and approved
      const promptHash = crypto
        .createHash('sha256')
        .update(whisper.text)
        .digest('hex')
        .slice(0, 16)

      await prisma.generatedWhisper.upsert({
        where: { id: `w-${poiId}` },
        update: {},
        create: {
          id: `w-${poiId}`,
          poiId,
          cityId: city.id,
          personaId: persona.id,
          geohash6,
          timeSlot: mapTimeSlot(poi.atmosphere.timeOfDayAffinity),
          whisperText: whisper.text,
          audioUrl: null,
          modelUsed: 'curated',
          promptHash,
          source: 'curated',
          status: 'draft',
          isStale: false,
        },
      })
    }

    console.log()
  }

  // ── Density Conflict Report ────────────────────────────────────────────────
  console.log('--- Density Conflict Report ---')
  const poisWithConflicts = new Set(conflicts.map((c) => c.poi)).size
  console.log(
    `${poisWithConflicts} POIs created with conflicts. Review before approving whispers.`
  )

  for (const c of conflicts) {
    const icon = c.severity === 'high' ? '🔴' : c.severity === 'medium' ? '⚠ ' : 'ℹ '
    console.log(
      `${icon}  "${c.poi}" — ${c.severity} conflict with "${c.conflictingWith}" ` +
      `(${c.distance}m, ${c.poiCategory} → ${c.neighborCategory})`
    )
  }
  console.log('---\n')

  console.log('📊  Summary')
  console.log(`    ${created} created`)
  console.log(`    ${skipped} skipped (already existed)`)
  console.log(`    ${conflicts.length} density warnings`)
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
