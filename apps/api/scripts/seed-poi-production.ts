/**
 * Seed: <poi-file.json> → DB
 *
 * Reads the production POI submission format defined in CLAUDE.md and seeds:
 *   - Singapore city (upsert)
 *   - Personas referenced by whispers (upsert)
 *   - POIs with full atmospheric metadata
 *   - PoiFacts
 *   - GeneratedWhisper stubs (audioUrl null until Phase 8 audio generation)
 *
 * Usage (from repo root):
 *   npx tsx apps/api/scripts/seed-poi-production.ts <path-to-json>
 *
 * Usage (from apps/api):
 *   npx tsx scripts/seed-poi-production.ts ../../resources/pois/poi-production-1.json
 *   npm run db:seed-pois -- ../../resources/pois/poi-production-1.json
 *
 * Path is resolved relative to the current working directory (where you run the command).
 * Omitting the path falls back to <repo-root>/poi-production.json (legacy behaviour).
 *
 * Source JSON format:
 *   { poi: { slug, name, lat, lng, category, triggerRadiusMeters, atmosphere: {...} },
 *     facts: [{ factType, content, verified, sourceUrl }],
 *     whisper: { text, voice, durationSeconds, audioFileName } }
 *
 * Safe to re-run — all operations are upserts keyed on slug.
 * audioUrl is intentionally left null — written in Phase 8 after ElevenLabs generation.
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

// ─── Types matching poi-production.json structure ─────────────────────────

interface ProductionEntry {
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

// ─── Helpers ──────────────────────────────────────────────────────────────

// Source URLs arrive as "[https://url.com](https://google...)" — extract the real URL
function extractUrl(raw: string | null): string | null {
  if (!raw) return null
  const match = raw.match(/\[([^\]]+)\]/)
  return match ? match[1] : raw
}

// Map voice name to persona slug
function voiceToSlug(voice: string): string {
  return voice.toLowerCase().replace(/\s+/g, '-')
}

// Map timeOfDayAffinity to GeneratedWhisper timeSlot (no "anytime" in whisper schema)
function affinityToTimeSlot(
  affinity: string
): 'morning' | 'afternoon' | 'evening' | 'night' {
  const map: Record<string, 'morning' | 'afternoon' | 'evening' | 'night'> = {
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening',
    night: 'night',
    anytime: 'morning', // "anytime" POIs default to morning slot
  }
  return map[affinity.toLowerCase()] ?? 'morning'
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  // ── Resolve input file ──────────────────────────────────────────────────────
  // Accept a path argument; fall back to legacy root-level poi-production.json
  const arg = process.argv[2]
  let jsonPath: string

  if (arg) {
    jsonPath = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg)
  } else {
    jsonPath = path.resolve(__dirname, '..', '..', '..', 'poi-production.json')
    console.warn('⚠️  No file argument given — falling back to <repo-root>/poi-production.json')
    console.warn('   Usage: npx tsx scripts/seed-poi-production.ts <path-to-json>\n')
  }

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`)
    process.exit(1)
  }

  console.log(`🌱 Seeding ${path.basename(jsonPath)}`)
  console.log(`   ${jsonPath}\n`)

  const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as ProductionEntry[]
  console.log(`  Loaded ${entries.length} POIs\n`)

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

  // ── Ensure required personas exist ─────────────────────────────────────
  const personaMap: Record<string, string> = {} // slug → id

  const declan = await prisma.persona.findUnique({ where: { slug: 'declan-sage' } })
  if (!declan) throw new Error('Declan Sage persona missing — run seed-persona-declan.ts first')
  personaMap['declan-sage'] = declan.id

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
  personaMap['arabella'] = arabella.id
  console.log(`  ✅ Personas: Declan Sage, Arabella\n`)

  // ── POIs ────────────────────────────────────────────────────────────────
  let poiCount = 0
  let factCount = 0
  let whisperCount = 0

  for (const entry of entries) {
    const { poi: p, facts, whisper: w } = entry
    const dbPoiId = `poi-${p.slug}`
    const geohash = ngeohash.encode(p.lat, p.lng, 6)
    const personaSlug = voiceToSlug(w.voice)
    const personaId = personaMap[personaSlug]
    const timeSlot = affinityToTimeSlot(p.atmosphere.timeOfDayAffinity)

    if (!personaId) {
      console.warn(`  ⚠️  Unknown voice "${w.voice}" for ${p.slug} — skipping`)
      continue
    }

    // POI — PM approval overrides reviewStatus from JSON
    const poi = await prisma.poi.upsert({
      where: { id: dbPoiId },
      update: {
        name: p.name,
        latitude: p.lat,
        longitude: p.lng,
        geohash6: geohash,
        triggerRadius: p.triggerRadiusMeters,
        emotionalTone:        p.atmosphere.emotionalTone,
        ambientProfile:       p.atmosphere.ambientProfile,
        timeOfDayAffinity:    p.atmosphere.timeOfDayAffinity,
        movementContext:      p.atmosphere.movementContext,
        intensityLevel:       p.atmosphere.intensityLevel,
        environmentalTexture: p.atmosphere.environmentalTexture,
        sourceAttribution:    p.atmosphere.sourceAttribution,
        reviewStatus:         'approved', // PM approved — override JSON default of "draft"
        contentOwner:         p.atmosphere.contentOwner,
      },
      create: {
        id: dbPoiId,
        cityId: singapore.id,
        name: p.name,
        category: p.category,
        tags: [
          p.atmosphere.emotionalTone.toLowerCase(),
          p.atmosphere.movementContext.toLowerCase(),
        ],
        geohash6: geohash,
        latitude: p.lat,
        longitude: p.lng,
        active: true,
        importanceScore: 80,
        triggerRadius: p.triggerRadiusMeters,
        cooldownMinutes: 60,
        emotionalTone:        p.atmosphere.emotionalTone,
        ambientProfile:       p.atmosphere.ambientProfile,
        timeOfDayAffinity:    p.atmosphere.timeOfDayAffinity,
        movementContext:      p.atmosphere.movementContext,
        intensityLevel:       p.atmosphere.intensityLevel,
        environmentalTexture: p.atmosphere.environmentalTexture,
        sourceAttribution:    p.atmosphere.sourceAttribution,
        reviewStatus:         'approved',
        contentOwner:         p.atmosphere.contentOwner,
      },
    })
    poiCount++

    // Facts — wipe and rewrite so re-runs stay in sync with the JSON
    await prisma.poiFact.deleteMany({ where: { poiId: poi.id } })
    await prisma.poiFact.createMany({
      data: facts.map((fact) => ({
        poiId: poi.id,
        factType: fact.factType,
        body: fact.content,
        verified: fact.verified,
        sourceUrl: extractUrl(fact.sourceUrl),
      })),
    })
    factCount += facts.length

    // GeneratedWhisper stub — audioUrl null until Phase 8
    const whisperId = `whisper-${p.slug}-${timeSlot}-v1`
    await prisma.generatedWhisper.upsert({
      where: { id: whisperId },
      update: {},
      create: {
        id: whisperId,
        poiId: poi.id,
        cityId: singapore.id,
        personaId,
        geohash6: geohash,
        timeSlot,
        whisperText: w.text,
        audioUrl: null,
        modelUsed: 'curated',
        promptHash: `curated-${p.slug}-${timeSlot}-v1`,
        tokenCount: w.text.split(/\s+/).length,
        source: 'curated',
        qualityScore: null,
        isFeatured: false,
        isStale: false,
      },
    })
    whisperCount++

    console.log(`  ✅ ${p.slug}`)
    console.log(`       ${p.name}`)
    console.log(`       ${p.lat}, ${p.lng} | ${p.category} | radius: ${p.triggerRadiusMeters}m`)
    console.log(`       voice: ${w.voice} | slot: ${timeSlot} | tone: ${p.atmosphere.emotionalTone}`)
    console.log(`       audio: ${w.audioFileName} (pending Phase 8)`)
    console.log()
  }

  console.log('─────────────────────────────────────────────────────────')
  console.log(`  POIs seeded:     ${poiCount}`)
  console.log(`  Facts seeded:    ${factCount}`)
  console.log(`  Whispers seeded: ${whisperCount} (audioUrl: null — pending Phase 8)`)
  console.log('\n✅ Seed complete.')
  console.log('\n  Next: Phase 8 — generate ElevenLabs audio, upload to whisper-audio bucket,')
  console.log('  then PATCH each GeneratedWhisper.audioUrl via admin API.')
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
