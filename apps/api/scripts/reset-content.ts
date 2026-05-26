/**
 * Phase 3 — Full Database Content Reset
 *
 * Deletes all content rows in FK-safe order. Does NOT touch:
 *   Persona, User, UserPreference, migrations, auth tables.
 *
 * Safe by default: dry run unless --execute flag is passed.
 *
 * Usage:
 *   npx tsx scripts/reset-content.ts              ← dry run (shows row counts only)
 *   npx tsx scripts/reset-content.ts --execute    ← actually deletes
 *
 * Deletion order (child → parent, respecting foreign keys):
 *   1. UserWhisperEvent
 *   2. TrailStop
 *   3. Trail
 *   4. GenerationJob
 *   5. GeneratedWhisper
 *   6. PoiFact
 *   7. Poi
 *   8. City  ← optional; skipped unless --include-cities flag is passed
 *
 * After deletion the script:
 *   - Confirms each target table is empty
 *   - Confirms Persona table is intact (Declan Sage record present)
 *   - Runs a smoke check: GET /pois/nearby should return empty array (manual step)
 *
 * Writes run log to:
 *   <repo-root>/archive/full-reset-<date>/db-reset-log.txt
 *
 * Required env vars:
 *   DATABASE_URL / DIRECT_URL
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--execute')
const INCLUDE_CITIES = process.argv.includes('--include-cities')
const DATE_STAMP = new Date().toISOString().slice(0, 10)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const ARCHIVE_DIR = path.join(REPO_ROOT, 'archive', `full-reset-${DATE_STAMP}`)
const LOG_LINES: string[] = []

// ─── Logging ───────────────────────────────────────────────────────────────

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  LOG_LINES.push(line)
}

function warn(msg: string) {
  const line = `[${new Date().toISOString()}] ⚠️  ${msg}`
  console.warn(line)
  LOG_LINES.push(line)
}

function fail(msg: string) {
  const line = `[${new Date().toISOString()}] ❌ ${msg}`
  console.error(line)
  LOG_LINES.push(line)
}

// ─── Prisma ────────────────────────────────────────────────────────────────

function buildPrisma() {
  const connectionString = (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!
  if (!connectionString) throw new Error('DATABASE_URL / DIRECT_URL not set')
  const adapter = new PrismaPg(
    { connectionString, ssl: { rejectUnauthorized: false } } as any
  )
  return new PrismaClient({ adapter })
}

// ─── Count helper ──────────────────────────────────────────────────────────

type TableName =
  | 'userWhisperEvent'
  | 'trailStop'
  | 'trail'
  | 'generationJob'
  | 'generatedWhisper'
  | 'poiFact'
  | 'poi'
  | 'purchase'
  | 'cityPack'
  | 'city'

async function countRows(prisma: PrismaClient, table: TableName): Promise<number> {
  // Prisma doesn't have a generic count — delegate per-model
  switch (table) {
    case 'userWhisperEvent':  return prisma.userWhisperEvent.count()
    case 'trailStop':         return prisma.trailStop.count()
    case 'trail':             return prisma.trail.count()
    case 'generationJob':     return prisma.generationJob.count()
    case 'generatedWhisper':  return prisma.generatedWhisper.count()
    case 'poiFact':           return prisma.poiFact.count()
    case 'poi':               return prisma.poi.count()
    case 'purchase':          return prisma.purchase.count()
    case 'cityPack':          return prisma.cityPack.count()
    case 'city':              return prisma.city.count()
  }
}

// ─── Delete step ───────────────────────────────────────────────────────────

async function deleteTable(
  prisma: PrismaClient,
  table: TableName,
  label: string,
  dryRun: boolean
): Promise<{ before: number; after: number }> {
  const before = await countRows(prisma, table)
  log(`  ${label}: ${before} rows ${dryRun ? '(would delete)' : '→ deleting...'}`)

  if (dryRun || before === 0) {
    return { before, after: before }
  }

  switch (table) {
    case 'userWhisperEvent':  await prisma.userWhisperEvent.deleteMany(); break
    case 'trailStop':         await prisma.trailStop.deleteMany(); break
    case 'trail':             await prisma.trail.deleteMany(); break
    case 'generationJob':     await prisma.generationJob.deleteMany(); break
    case 'generatedWhisper':  await prisma.generatedWhisper.deleteMany(); break
    case 'poiFact':           await prisma.poiFact.deleteMany(); break
    case 'poi':               await prisma.poi.deleteMany(); break
    case 'purchase':          await prisma.purchase.deleteMany(); break
    case 'cityPack':          await prisma.cityPack.deleteMany(); break
    case 'city':              await prisma.city.deleteMany(); break
  }

  const after = await countRows(prisma, table)
  if (after === 0) {
    log(`    ✅ Cleared (${before} rows deleted)`)
  } else {
    fail(`    ${after} rows remain after delete — check for FK constraint or trigger`)
  }

  return { before, after }
}

// ─── Persona integrity check ───────────────────────────────────────────────

async function verifyPersonas(prisma: PrismaClient) {
  log('')
  log('Verifying Persona table is intact...')

  const personas = await prisma.persona.findMany({
    select: { id: true, slug: true, name: true, active: true },
  })

  if (personas.length === 0) {
    warn('No personas found — Declan Sage record is missing!')
    warn('Re-seed personas before continuing: npx tsx prisma/seed.ts')
    return false
  }

  for (const p of personas) {
    log(`  ✅ ${p.name} (${p.slug}) — active: ${p.active}`)
  }

  const declan = personas.find(
    (p) => p.name.toLowerCase().includes('declan') || p.slug.includes('declan')
  )
  if (!declan) {
    warn('Declan Sage persona not found by name/slug — verify manually in Prisma Studio.')
  } else {
    log(`  ✅ Declan Sage confirmed: ${declan.slug}`)
  }

  return true
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  log('╔═══════════════════════════════════════════════════════════╗')
  log('║  CityWhispers — Phase 3: Database Content Reset           ║')
  log(`║  Date: ${DATE_STAMP}                                        ║`)
  log(`║  Mode: ${DRY_RUN ? 'DRY RUN (pass --execute to delete)  ' : 'LIVE — DELETING FOR REAL         '}  ║`)
  log(`║  Cities: ${INCLUDE_CITIES ? 'INCLUDED (--include-cities)         ' : 'PRESERVED (default)                '}  ║`)
  log('╚═══════════════════════════════════════════════════════════╝')
  log('')

  if (!DRY_RUN) {
    log('⚠️  LIVE MODE — database rows will be permanently deleted.')
    log('Ensure Phase 1 backup and Phase 2 storage cleanup are complete.')
    log('You have 5 seconds to Ctrl+C if this is wrong...')
    await new Promise((r) => setTimeout(r, 5000))
    log('Proceeding.')
    log('')
  }

  const prisma = buildPrisma()

  try {
    log('Pre-delete row counts:')
    log('──────────────────────────────────────────────')

    // Ordered steps: children first, parents last
    const steps: { table: TableName; label: string }[] = [
      { table: 'userWhisperEvent', label: 'UserWhisperEvent' },
      { table: 'trailStop',        label: 'TrailStop' },
      { table: 'trail',            label: 'Trail' },
      { table: 'generationJob',    label: 'GenerationJob' },
      { table: 'generatedWhisper', label: 'GeneratedWhisper' },
      { table: 'poiFact',          label: 'PoiFact' },
      { table: 'poi',              label: 'Poi' },
    ]

    if (INCLUDE_CITIES) {
      // Purchase → CityPack must precede City (city_packs_city_id_fkey)
      steps.push({ table: 'purchase',  label: 'Purchase' })
      steps.push({ table: 'cityPack',  label: 'CityPack' })
      steps.push({ table: 'city',      label: 'City' })
    } else {
      const cityCount = await countRows(prisma, 'city')
      log(`  City: ${cityCount} rows — PRESERVED (pass --include-cities to reset)`)
    }

    const results: Record<string, { before: number; after: number }> = {}

    for (const step of steps) {
      const result = await deleteTable(prisma, step.table, step.label, DRY_RUN)
      results[step.label] = result
    }

    // ── Persona integrity check ──────────────────────────────────────────
    await verifyPersonas(prisma)

    // ── Summary ──────────────────────────────────────────────────────────
    log('')
    log('═══════════════════════════════════════════════════════════')
    log(`  PHASE 3 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`)
    log('═══════════════════════════════════════════════════════════')

    let allClear = true
    for (const [label, { before, after }] of Object.entries(results)) {
      if (DRY_RUN) {
        log(`  ${label}: ${before} rows would be deleted`)
      } else {
        const ok = after === 0
        if (!ok) allClear = false
        log(`  ${ok ? '✅' : '❌'} ${label}: ${before} → ${after} rows`)
      }
    }

    if (!DRY_RUN) {
      log('')
      if (allClear) {
        log('  ✅ All target tables cleared')
      } else {
        fail('  Some tables still have rows — check errors above')
      }

      log('')
      log('  PHASE 3 COMPLETION CHECKLIST:')
      log('  □  Prisma Studio confirms 0 rows in all target tables above')
      log('  □  Persona table has Declan Sage record (confirmed above)')
      log('  □  npx prisma migrate status → clean (no pending migrations)')
      log('  □  API smoke: GET /pois/nearby → 200 empty array (manual)')
      log('  □  Team lead signs off → proceed to Phase 4 verify')
    } else {
      log('')
      log('  Re-run with --execute to perform deletion:')
      log('    npx tsx scripts/reset-content.ts --execute')
      log('  or with cities:')
      log('    npx tsx scripts/reset-content.ts --execute --include-cities')
    }

    log('═══════════════════════════════════════════════════════════')

  } finally {
    await prisma.$disconnect()

    fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
    const logFile = path.join(
      ARCHIVE_DIR,
      `db-reset-log${DRY_RUN ? '-dry-run' : ''}.txt`
    )
    fs.writeFileSync(logFile, LOG_LINES.join('\n') + '\n', 'utf-8')
    console.log(`\nRun log written to: ${logFile}`)
  }
}

main().catch((err) => {
  fail(`Fatal: ${err.message}`)
  if (err.stack) fail(err.stack)
  process.exitCode = 1
})
