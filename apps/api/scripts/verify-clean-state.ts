/**
 * Phase 4 — Verify Clean State
 *
 * Checks:
 *   1. All content tables are empty (or persona-only for Persona)
 *   2. No stale audioUrl references remain
 *   3. API routes return correct empty/default responses
 *
 * Run from apps/api with the API server already running on port 3001:
 *   npx tsx scripts/verify-clean-state.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg(
  { connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, ssl: { rejectUnauthorized: false } } as any
)
const prisma = new PrismaClient({ adapter })

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001'
const RESULTS: { check: string; pass: boolean; detail: string }[] = []

function record(check: string, pass: boolean, detail: string) {
  RESULTS.push({ check, pass, detail })
  console.log(`  ${pass ? '✅' : '❌'} ${check}: ${detail}`)
}

// ─── DB checks ─────────────────────────────────────────────────────────────

async function checkDb() {
  console.log('\n── Database ──')

  const [pois, whispers, facts, cities, trails, trailStops, events, jobs] = await Promise.all([
    prisma.poi.count(),
    prisma.generatedWhisper.count(),
    prisma.poiFact.count(),
    prisma.city.count(),
    prisma.trail.count(),
    prisma.trailStop.count(),
    prisma.userWhisperEvent.count(),
    prisma.generationJob.count(),
  ])

  record('Poi empty',               pois === 0,      `${pois} rows`)
  record('GeneratedWhisper empty',  whispers === 0,  `${whispers} rows`)
  record('PoiFact empty',           facts === 0,     `${facts} rows`)
  record('City empty',              cities === 0,    `${cities} rows`)
  record('Trail empty',             trails === 0,    `${trails} rows`)
  record('TrailStop empty',         trailStops === 0,`${trailStops} rows`)
  record('UserWhisperEvent empty',  events === 0,    `${events} rows`)
  record('GenerationJob empty',     jobs === 0,      `${jobs} rows`)

  const orphanAudio = await prisma.generatedWhisper.count({ where: { audioUrl: { not: null } } })
  record('No orphan audioUrls',     orphanAudio === 0, `${orphanAudio} records with non-null audioUrl`)

  const personas = await prisma.persona.findMany({ select: { name: true, slug: true, active: true } })
  record('Personas intact',         personas.length > 0, `${personas.length} personas: ${personas.map(p => p.slug).join(', ')}`)

  const declan = personas.find(p => p.slug === 'declan-sage')
  record('Declan Sage present',     !!declan, declan ? `active: ${declan.active}` : 'NOT FOUND')
}

// ─── API route checks ───────────────────────────────────────────────────────

async function checkRoute(
  label: string,
  path: string,
  expectedStatus: number,
  validate?: (body: any) => { ok: boolean; detail: string }
) {
  try {
    const resp = await fetch(`${API_BASE}${path}`)
    const body = await resp.json().catch(() => null)

    if (resp.status !== expectedStatus) {
      record(label, false, `expected ${expectedStatus}, got ${resp.status}`)
      return
    }

    if (validate) {
      const { ok, detail } = validate(body)
      record(label, ok, detail)
    } else {
      record(label, true, `${resp.status} OK`)
    }
  } catch (err: any) {
    record(label, false, `request failed: ${err.message} — is the API running on ${API_BASE}?`)
  }
}

async function checkApiRoutes() {
  console.log(`\n── API routes (${API_BASE}) ──`)

  // GET /pois/nearby → 200, data array empty
  await checkRoute(
    'GET /pois/nearby → 200 empty array',
    '/pois/nearby?lat=1.3&lng=103.8',
    200,
    (body) => {
      const arr = body?.data ?? body
      const isEmpty = Array.isArray(arr) && arr.length === 0
      return { ok: isEmpty, detail: isEmpty ? 'empty array' : `got ${JSON.stringify(arr).slice(0, 80)}` }
    }
  )

  // GET /whisper/poi/:id → 404 (no POIs exist)
  await checkRoute(
    'GET /whisper/poi/nonexistent → 404',
    '/whisper/poi/nonexistent-id',
    404,
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  CityWhispers — Phase 4: Verify Clean State               ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  await checkDb()
  await checkApiRoutes()

  const passed = RESULTS.filter(r => r.pass).length
  const failed = RESULTS.filter(r => !r.pass).length

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`  RESULT: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log('\n  Failed checks:')
    RESULTS.filter(r => !r.pass).forEach(r => console.log(`    ❌ ${r.check}: ${r.detail}`))
  } else {
    console.log('\n  ✅ All automated checks passed.')
  }

  console.log('\n  Manual checks still required:')
  console.log('  □  Mobile app cold start — map loads with no markers, no Metro errors')
  console.log('  □  Journal/Collected screen shows empty state UI')
  console.log('  □  GET /user/discovered → 200 empty array  (requires auth token)')
  console.log('  □  GET /user/preferences → 200 defaults    (requires auth token)')
  console.log('  □  Team lead signs off → proceed to Phase 6')
  console.log('═══════════════════════════════════════════════════════════')
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
