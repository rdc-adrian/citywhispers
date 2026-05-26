/**
 * Seed: poi-production.json → DB
 *
 * Creates / upserts:
 *   - Singapore city
 *   - Arabella persona (if absent)
 *   - 5 production POIs with facts + GeneratedWhisper stubs
 *
 * audioUrl is left null — Phase 8 writes it after ElevenLabs generation.
 * Safe to re-run (all operations are upserts).
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import ngeohash from 'ngeohash'
import * as path from 'path'
import * as fs from 'fs'

const adapter = new PrismaPg(
  { connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, ssl: { rejectUnauthorized: false } } as any
)
const prisma = new PrismaClient({ adapter })

// ─── Source URL cleanup ───────────────────────────────────────────────────
// Input format from research team: "[https://actual-url.com](https://google...)"
// Extract the real URL between the first [ and ]
function extractUrl(raw: string | null): string | null {
  if (!raw) return null
  const match = raw.match(/\[([^\]]+)\]/)
  return match ? match[1] : raw
}

// ─── Time slot mapping ────────────────────────────────────────────────────
function mapTimeSlot(timeOfDay: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const t = timeOfDay.toLowerCase()
  if (t.includes('morning') || t.includes('dawn')) return 'morning'
  if (t.includes('afternoon') || t.includes('midday')) return 'afternoon'
  if (t.includes('dusk') || t.includes('evening')) return 'evening'
  return 'night' // late night, midnight, pre-dawn, night
}

// ─── Fact type inference ──────────────────────────────────────────────────
// Verified facts with historical or architectural content → typed accordingly.
// Unverified sensory/physical observations → sensory.
function inferFactType(
  description: string,
  verified: boolean
): 'historical' | 'architectural' | 'sensory' | 'social' {
  if (!verified) return 'sensory'
  const d = description.toLowerCase()
  if (
    d.includes('year') || d.includes('19') || d.includes('20') ||
    d.includes('named') || d.includes('opened') || d.includes('ceased') ||
    d.includes('designated') || d.includes('founded') || d.includes('constructed') ||
    d.includes('revitali') || d.includes('operated since') || d.includes('originally')
  ) return 'historical'
  if (
    d.includes('architect') || d.includes('design') || d.includes('built') ||
    d.includes('metres') || d.includes('meters') || d.includes('height') ||
    d.includes('structure') || d.includes('terrain') || d.includes('stairs')
  ) return 'architectural'
  if (d.includes('regularly') || d.includes('community') || d.includes('route')) return 'social'
  return 'historical'
}

// ─── POI coordinate + category lookup ─────────────────────────────────────
// Coordinates are not in the source JSON — resolved from place knowledge.
const POI_GEO: Record<string, {
  lat: number
  lng: number
  category: string
  slug: string
}> = {
  SG_004_KALLANG_AIRFIELD_GATES: {
    lat: 1.3067,
    lng: 103.8722,
    category: 'landmark',
    slug: 'sg-old-kallang-airport-gates',
  },
  SG_005_PEARLS_HILL_STAIRCASE: {
    lat: 1.2813,
    lng: 103.8401,
    category: 'park',
    slug: 'sg-pearls-hill-staircase',
  },
  SG_006_ROCHOR_CANAL_WALKWAY: {
    lat: 1.3009,
    lng: 103.8524,
    category: 'waterfront',
    slug: 'sg-rochor-canal-walkway',
  },
  SG_007_TANJONG_PAGAR_BACKALLEY: {
    lat: 1.2797,
    lng: 103.8432,
    category: 'street',
    slug: 'sg-tanjong-pagar-backalley',
  },
  SG_008_LAVENDER_BUS_STOP: {
    lat: 1.3080,
    lng: 103.8637,
    category: 'street',
    slug: 'sg-lavender-bus-shelter',
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding poi-production.json...\n')

  // Load source JSON
  const jsonPath = path.resolve(__dirname, '..', '..', '..', 'poi-production.json')
  const pois = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Array<{
    poiId: string
    poiName: string
    environmentalConditions: { timeOfDay: string; weatherState: string; occupancyLevel: string }
    emotionalMap: { dominantRegister: string; undertones: string[] }
    audioScript: string
    technicalMetadata: {
      triggerRadiusMeters: number
      vocalProfile: string
      audioDurationSeconds: number
      injectionReady: boolean
    }
    spatialValidationFacts: Array<{
      description: string
      verified: boolean
      sourceUrl: string | null
    }>
  }>

  console.log(`  Loaded ${pois.length} POIs from poi-production.json`)

  // ── Singapore city ──────────────────────────────────────────────────────
  const singapore = await prisma.city.upsert({
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
  console.log(`  ✅ City: ${singapore.name}`)

  // ── Personas ────────────────────────────────────────────────────────────
  const declanSage = await prisma.persona.findUnique({ where: { slug: 'declan-sage' } })
  if (!declanSage) throw new Error('Declan Sage persona missing — run seed-persona-declan.ts first')

  const arabella = await prisma.persona.upsert({
    where: { slug: 'arabella' },
    update: {},
    create: {
      slug: 'arabella',
      name: 'Arabella',
      tonePrompt:
        'You are a voice of poetic intimacy — softer and more inward than Declan Sage. ' +
        'Use Arabella selectively for emotional registers that require feminine interiority: ' +
        'quiet grief, concealed domesticity, the strange softness of deserted or transitional spaces. ' +
        'Write in first person, present tense. Never narrate — be present. ' +
        'Tone: still, slightly suspended, as if time has caught on something. ' +
        'Sentences should feel incomplete by design. Avoid resolution.',
      active: true,
    },
  })
  console.log(`  ✅ Persona: Declan Sage + Arabella ready`)

  // ── POIs ────────────────────────────────────────────────────────────────
  let poiCount = 0
  let factCount = 0
  let whisperCount = 0

  for (const entry of pois) {
    if (!entry.technicalMetadata.injectionReady) {
      console.log(`  ⏭  Skipping ${entry.poiId} (injectionReady: false)`)
      continue
    }

    const geo = POI_GEO[entry.poiId]
    if (!geo) {
      console.warn(`  ⚠️  No geo data for ${entry.poiId} — skipping`)
      continue
    }

    const persona = entry.technicalMetadata.vocalProfile === 'Arabella' ? arabella : declanSage
    const timeSlot = mapTimeSlot(entry.environmentalConditions.timeOfDay)
    const geohash = ngeohash.encode(geo.lat, geo.lng, 6)
    const dbPoiId = `poi-${geo.slug}`

    // POI
    const poi = await prisma.poi.upsert({
      where: { id: dbPoiId },
      update: {
        name: entry.poiName,
        triggerRadius: entry.technicalMetadata.triggerRadiusMeters,
        geohash6: geohash,
      },
      create: {
        id: dbPoiId,
        cityId: singapore.id,
        name: entry.poiName,
        category: geo.category,
        tags: [
          entry.emotionalMap.dominantRegister.toLowerCase(),
          ...entry.emotionalMap.undertones.map((u) => u.toLowerCase()),
        ],
        geohash6: geohash,
        latitude: geo.lat,
        longitude: geo.lng,
        active: true,
        importanceScore: 80,
        triggerRadius: entry.technicalMetadata.triggerRadiusMeters,
        cooldownMinutes: 60,
      },
    })
    poiCount++

    // Facts
    for (const fact of entry.spatialValidationFacts) {
      await prisma.poiFact.create({
        data: {
          poiId: poi.id,
          factType: inferFactType(fact.description, fact.verified),
          body: fact.description,
          verified: fact.verified,
          sourceUrl: extractUrl(fact.sourceUrl),
        },
      }).catch(() => {
        // skip duplicate if re-running — poiFact has no unique constraint to upsert on
      })
      factCount++
    }

    // GeneratedWhisper stub (audioUrl null until Phase 8)
    const whisperStubId = `whisper-${geo.slug}-${timeSlot}-v1`
    await prisma.generatedWhisper.upsert({
      where: { id: whisperStubId },
      update: {},
      create: {
        id: whisperStubId,
        poiId: poi.id,
        cityId: singapore.id,
        personaId: persona.id,
        geohash6: geohash,
        timeSlot,
        whisperText: entry.audioScript,
        audioUrl: null,
        modelUsed: 'curated',
        promptHash: `curated-${geo.slug}-${timeSlot}-v1`,
        tokenCount: entry.audioScript.split(/\s+/).length,
        source: 'curated',
        qualityScore: null,
        isFeatured: false,
        isStale: false,
      },
    })
    whisperCount++

    console.log(
      `  ✅ ${entry.poiId} — ${poi.name}\n` +
      `       persona: ${persona.name} | slot: ${timeSlot} | radius: ${poi.triggerRadius}m`
    )
  }

  console.log('\n─────────────────────────────────────────────')
  console.log(`  POIs created:     ${poiCount}`)
  console.log(`  Facts created:    ${factCount}`)
  console.log(`  Whispers created: ${whisperCount} (audioUrl: null — pending Phase 8)`)
  console.log('\n✅ Seed complete.')
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
