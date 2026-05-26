/**
 * Phase 1 — Full Backup Snapshot
 *
 * Exports a timestamped, restorable archive before any content reset.
 *
 * Outputs to: <repo-root>/archive/full-reset-<date>/
 *   - pois.json              — all POIs with coordinates, slugs, facts
 *   - whisper-scripts.json   — all GeneratedWhisper text + metadata
 *   - audio-metadata.json    — audioUrl, duration, slugs for every whisper
 *   - storage-manifest.json  — listing of every object in every storage bucket
 *   - backup-<date>.sql      — pg_dump of the full database (if pg_dump available)
 *   - run-log.txt            — timestamped log of this script's execution
 *
 * Required env vars:
 *   DATABASE_URL / DIRECT_URL        — Postgres connection (uses DIRECT_URL if present)
 *   SUPABASE_PROJECT_REF             — e.g. "abcxyzabcxyz" (from Supabase dashboard URL)
 *   SUPABASE_S3_ACCESS_KEY_ID        — From Supabase: Storage > S3 Access Keys
 *   SUPABASE_S3_SECRET_ACCESS_KEY    — From Supabase: Storage > S3 Access Keys
 *   SUPABASE_STORAGE_REGION          — e.g. "ap-southeast-1" (optional, defaults to ap-southeast-1)
 *
 * Run from apps/api:
 *   npx tsx scripts/backup-snapshot.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  S3Client,
  ListObjectsV2Command,
  ListBucketsCommand,
} from '@aws-sdk/client-s3'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

// ─── Config ────────────────────────────────────────────────────────────────

const DATE_STAMP = new Date().toISOString().slice(0, 10) // e.g. 2026-05-26
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const ARCHIVE_DIR = path.join(REPO_ROOT, 'archive', `full-reset-${DATE_STAMP}`)
const STORAGE_DIR = path.join(ARCHIVE_DIR, 'storage')
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

// ─── Prisma setup ──────────────────────────────────────────────────────────

function buildPrisma() {
  const connectionString = (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!
  if (!connectionString) throw new Error('DATABASE_URL / DIRECT_URL not set')
  const adapter = new PrismaPg(
    { connectionString, ssl: { rejectUnauthorized: false } } as any
  )
  return new PrismaClient({ adapter })
}

// ─── S3 setup ──────────────────────────────────────────────────────────────

function buildS3Client(): S3Client | null {
  const projectRef = process.env.SUPABASE_PROJECT_REF
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY

  if (!projectRef || !accessKeyId || !secretAccessKey) {
    warn(
      'SUPABASE_PROJECT_REF / SUPABASE_S3_ACCESS_KEY_ID / SUPABASE_S3_SECRET_ACCESS_KEY ' +
      'not set — storage export will be skipped. ' +
      'Find S3 credentials in Supabase dashboard: Storage > S3 Access Keys.'
    )
    return null
  }

  const region = process.env.SUPABASE_STORAGE_REGION ?? 'ap-southeast-1'
  const endpoint = `https://${projectRef}.supabase.co/storage/v1/s3`

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for Supabase S3-compatible API
  })
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  const sizeKb = (fs.statSync(filePath).size / 1024).toFixed(1)
  log(`  ✅ ${path.basename(filePath)} — ${sizeKb} KB`)
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

// ─── Phase 1a: Export POIs + Facts ─────────────────────────────────────────

async function exportPois(prisma: PrismaClient) {
  log('Exporting POIs...')

  const pois = await prisma.poi.findMany({
    include: {
      city: { select: { name: true, countryCode: true, status: true } },
      poiFacts: {
        select: {
          id: true,
          factType: true,
          body: true,
          verified: true,
          sourceUrl: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ city: { name: 'asc' } }, { name: 'asc' }],
  })

  const summary = {
    exportedAt: new Date().toISOString(),
    totalPois: pois.length,
    totalFacts: pois.reduce((n, p) => n + p.poiFacts.length, 0),
    byCity: Object.fromEntries(
      Object.entries(
        pois.reduce<Record<string, number>>((acc, p) => {
          const key = p.city.name
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {})
      )
    ),
    pois,
  }

  writeJson(path.join(ARCHIVE_DIR, 'pois.json'), summary)
  log(`  ${pois.length} POIs across ${Object.keys(summary.byCity).length} cities`)
}

// ─── Phase 1b: Export Whisper Scripts ──────────────────────────────────────

async function exportWhisperScripts(prisma: PrismaClient) {
  log('Exporting whisper scripts...')

  const whispers = await prisma.generatedWhisper.findMany({
    include: {
      poi: { select: { name: true, latitude: true, longitude: true } },
      city: { select: { name: true, countryCode: true } },
      persona: { select: { slug: true, name: true } },
    },
    orderBy: [{ city: { name: 'asc' } }, { createdAt: 'desc' }],
  })

  const summary = {
    exportedAt: new Date().toISOString(),
    totalWhispers: whispers.length,
    byCity: Object.fromEntries(
      Object.entries(
        whispers.reduce<Record<string, number>>((acc, w) => {
          const key = w.city.name
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {})
      )
    ),
    whispers: whispers.map((w) => ({
      id: w.id,
      poiName: w.poi?.name ?? null,
      cityName: w.city.name,
      countryCode: w.city.countryCode,
      personaSlug: w.persona.slug,
      timeSlot: w.timeSlot,
      whisperText: w.whisperText,
      audioUrl: w.audioUrl,
      durationEstimate: null, // not stored in current schema
      source: w.source,
      qualityScore: w.qualityScore,
      isFeatured: w.isFeatured,
      isStale: w.isStale,
      createdAt: w.createdAt,
    })),
  }

  writeJson(path.join(ARCHIVE_DIR, 'whisper-scripts.json'), summary)
  log(`  ${whispers.length} whispers exported`)
}

// ─── Phase 1c: Export Audio Metadata ───────────────────────────────────────

async function exportAudioMetadata(prisma: PrismaClient) {
  log('Exporting audio metadata...')

  const whispers = await prisma.generatedWhisper.findMany({
    where: { audioUrl: { not: null } },
    select: {
      id: true,
      audioUrl: true,
      whisperText: true,
      timeSlot: true,
      createdAt: true,
      poi: { select: { name: true, latitude: true, longitude: true } },
      city: { select: { name: true, countryCode: true } },
      persona: { select: { slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const summary = {
    exportedAt: new Date().toISOString(),
    totalWithAudio: whispers.length,
    audioFiles: whispers.map((w) => ({
      whisperId: w.id,
      audioUrl: w.audioUrl,
      // Derive filename from URL if possible
      audioFileName: w.audioUrl ? w.audioUrl.split('/').at(-1) ?? null : null,
      // Estimate duration: ~2.5 words/second for slow narration
      estimatedDurationSeconds: w.whisperText
        ? Math.round(w.whisperText.split(/\s+/).length / 2.5)
        : null,
      wordCount: w.whisperText ? w.whisperText.split(/\s+/).length : null,
      poiName: w.poi?.name ?? null,
      cityName: w.city.name,
      personaSlug: w.persona.slug,
      timeSlot: w.timeSlot,
      createdAt: w.createdAt,
    })),
  }

  writeJson(path.join(ARCHIVE_DIR, 'audio-metadata.json'), summary)
  log(`  ${whispers.length} audio records exported`)
}

// ─── Phase 1d: Export Storage Bucket Manifest ──────────────────────────────

async function exportStorageManifest(s3: S3Client) {
  log('Listing storage buckets...')

  let buckets: string[] = []

  try {
    const bucketsResp = await s3.send(new ListBucketsCommand({}))
    buckets = (bucketsResp.Buckets ?? []).map((b) => b.Name!).filter(Boolean)
    log(`  Found buckets: ${buckets.join(', ') || '(none)'}`)
  } catch (err: any) {
    warn(`Could not list buckets: ${err.message}`)
    warn('Falling back to known bucket name: whisper-audio')
    buckets = ['whisper-audio']
  }

  const manifest: Record<string, { key: string; size: number; lastModified: string }[]> = {}
  let totalObjects = 0

  for (const bucket of buckets) {
    log(`  Scanning bucket: ${bucket}`)
    const objects: { key: string; size: number; lastModified: string }[] = []
    let continuationToken: string | undefined

    do {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        })
      )

      for (const obj of resp.Contents ?? []) {
        objects.push({
          key: obj.Key!,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? '',
        })
      }

      continuationToken = resp.NextContinuationToken
    } while (continuationToken)

    manifest[bucket] = objects
    totalObjects += objects.length
    log(`    ${objects.length} objects in ${bucket}`)

    // Write a per-bucket listing into storage/ subfolder for easy reference
    ensureDir(STORAGE_DIR)
    writeJson(
      path.join(STORAGE_DIR, `${bucket}-manifest.json`),
      { bucket, exportedAt: new Date().toISOString(), objectCount: objects.length, objects }
    )
  }

  const summary = {
    exportedAt: new Date().toISOString(),
    totalBuckets: buckets.length,
    totalObjects,
    buckets: manifest,
  }

  writeJson(path.join(ARCHIVE_DIR, 'storage-manifest.json'), summary)
  log(`  ${totalObjects} total objects across ${buckets.length} buckets`)
}

// ─── Phase 1e: pg_dump ─────────────────────────────────────────────────────

async function runPgDump() {
  log('Running pg_dump...')

  const connectionString = (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!
  const dumpFile = path.join(ARCHIVE_DIR, `backup-${DATE_STAMP}.sql`)

  // Check if pg_dump is available
  try {
    await execAsync('pg_dump --version')
  } catch {
    warn(
      'pg_dump not found in PATH — skipping SQL dump. ' +
      'To include a SQL backup, install PostgreSQL client tools and re-run. ' +
      'The JSON exports above are sufficient for content recovery.'
    )
    return
  }

  try {
    // pg_dump writes to stdout; we capture and write to file
    const { stdout, stderr } = await execAsync(
      `pg_dump --no-owner --no-acl --format=plain "${connectionString}"`,
      { maxBuffer: 512 * 1024 * 1024 } // 512 MB buffer
    )

    if (stderr && !stderr.includes('WARNING')) {
      warn(`pg_dump stderr: ${stderr.slice(0, 500)}`)
    }

    fs.writeFileSync(dumpFile, stdout, 'utf-8')
    const sizeMb = (fs.statSync(dumpFile).size / 1024 / 1024).toFixed(2)
    log(`  ✅ backup-${DATE_STAMP}.sql — ${sizeMb} MB`)

    // Quick verification: check the dump file is parseable
    const head = stdout.slice(0, 200)
    if (!head.includes('PostgreSQL') && !head.includes('pg_dump')) {
      warn('pg_dump output does not look like a valid SQL dump — verify manually.')
    }
  } catch (err: any) {
    fail(`pg_dump failed: ${err.message}`)
    fail('The Prisma JSON exports are still valid — SQL backup is supplementary.')
  }
}

// ─── Verification summary ──────────────────────────────────────────────────

function printVerificationChecklist() {
  log('')
  log('═══════════════════════════════════════════════════════════')
  log('  PHASE 1 COMPLETION CHECKLIST — verify before Phase 2')
  log('═══════════════════════════════════════════════════════════')
  log('')
  log('  □  Archive directory exists and is non-empty:')
  log(`       ${ARCHIVE_DIR}`)
  log('')
  log('  □  pois.json — open and spot-check 3 random POIs against')
  log('       Prisma Studio (name, lat/lng, category, facts count)')
  log('')
  log('  □  whisper-scripts.json — confirm text is intact and readable')
  log('')
  log('  □  audio-metadata.json — confirm audioUrl fields are present')
  log('       for whispers you know had audio')
  log('')
  log('  □  storage-manifest.json — confirm all expected .mp3 files appear')
  log('')
  log('  □  backup-<date>.sql (if pg_dump available) — run:')
  log(`       pg_restore --list ${ARCHIVE_DIR}\\backup-${DATE_STAMP}.sql`)
  log('       (should return without errors)')
  log('')
  log('  □  Team lead signs off on archive integrity')
  log('       → Only then proceed to Phase 2')
  log('')
  log('═══════════════════════════════════════════════════════════')
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  log('╔═══════════════════════════════════════════════════════════╗')
  log('║  CityWhispers — Phase 1: Full Backup Snapshot             ║')
  log(`║  Date: ${DATE_STAMP}                                        ║`)
  log('╚═══════════════════════════════════════════════════════════╝')
  log('')
  log(`Archive destination: ${ARCHIVE_DIR}`)

  ensureDir(ARCHIVE_DIR)
  ensureDir(STORAGE_DIR)

  const prisma = buildPrisma()
  const s3 = buildS3Client()

  try {
    // 1a. POIs + facts
    await exportPois(prisma)

    // 1b. Whisper scripts
    await exportWhisperScripts(prisma)

    // 1c. Audio metadata
    await exportAudioMetadata(prisma)

    // 1d. Storage bucket manifest (skip if S3 creds not configured)
    if (s3) {
      await exportStorageManifest(s3)
    } else {
      log('Storage export skipped (no S3 credentials).')
    }

    // 1e. pg_dump
    await runPgDump()

    // Print verification checklist
    printVerificationChecklist()

    log('')
    log('Phase 1 complete. Archive is at:')
    log(`  ${ARCHIVE_DIR}`)
    log('')
  } catch (err: any) {
    fail(`Unexpected error: ${err.message}`)
    if (err.stack) fail(err.stack)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()

    // Write run log
    const logFile = path.join(ARCHIVE_DIR, 'run-log.txt')
    fs.writeFileSync(logFile, LOG_LINES.join('\n') + '\n', 'utf-8')
    console.log(`\nRun log written to: ${logFile}`)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
