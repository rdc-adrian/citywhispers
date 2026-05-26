/**
 * Phase 2 — Full Storage Cleanup
 *
 * Deletes every object in every Supabase storage bucket.
 * Safe by default: runs in DRY_RUN mode unless --execute flag is passed.
 *
 * Usage:
 *   npx tsx scripts/cleanup-storage.ts              ← dry run (lists what would be deleted)
 *   npx tsx scripts/cleanup-storage.ts --execute    ← actually deletes
 *
 * After deletion the script runs a second listing pass to verify 0 objects remain,
 * then queries the DB for any GeneratedWhisper records that still have a non-null
 * audioUrl (these will be orphaned stubs after Phase 3 wipes the DB).
 *
 * Writes a run log to:
 *   <repo-root>/archive/full-reset-<date>/storage-cleanup-log.txt
 *
 * Required env vars (same as backup-snapshot.ts):
 *   DATABASE_URL / DIRECT_URL
 *   SUPABASE_PROJECT_REF
 *   SUPABASE_S3_ACCESS_KEY_ID
 *   SUPABASE_S3_SECRET_ACCESS_KEY
 *   SUPABASE_STORAGE_REGION   (optional, defaults to ap-southeast-1)
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--execute')
const DATE_STAMP = new Date().toISOString().slice(0, 10)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const ARCHIVE_DIR = path.join(REPO_ROOT, 'archive', `full-reset-${DATE_STAMP}`)
const DELETE_BATCH_SIZE = 1000 // S3 DeleteObjects max
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

// ─── S3 ────────────────────────────────────────────────────────────────────

function buildS3Client(): S3Client {
  const projectRef = process.env.SUPABASE_PROJECT_REF
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY

  if (!projectRef || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing S3 credentials.\n' +
      'Required: SUPABASE_PROJECT_REF, SUPABASE_S3_ACCESS_KEY_ID, SUPABASE_S3_SECRET_ACCESS_KEY\n' +
      'Find them in Supabase dashboard → Storage → S3 Access Keys.'
    )
  }

  const region = process.env.SUPABASE_STORAGE_REGION ?? 'ap-southeast-1'
  const endpoint = `https://${projectRef}.supabase.co/storage/v1/s3`

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

// ─── List all objects in a bucket (handles pagination) ─────────────────────

async function listAllObjects(
  s3: S3Client,
  bucket: string
): Promise<{ key: string; size: number }[]> {
  const objects: { key: string; size: number }[] = []
  let continuationToken: string | undefined

  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of resp.Contents ?? []) {
      objects.push({ key: obj.Key!, size: obj.Size ?? 0 })
    }
    continuationToken = resp.NextContinuationToken
  } while (continuationToken)

  return objects
}

// ─── Delete objects in batches of 1000 ────────────────────────────────────

async function deleteBatch(
  s3: S3Client,
  bucket: string,
  keys: string[]
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = []
  let deleted = 0

  for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + DELETE_BATCH_SIZE)

    const resp = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((k) => ({ Key: k })),
          Quiet: false,
        },
      })
    )

    deleted += resp.Deleted?.length ?? 0

    for (const err of resp.Errors ?? []) {
      errors.push(`${err.Key}: ${err.Code} — ${err.Message}`)
    }

    log(`  Batch ${Math.floor(i / DELETE_BATCH_SIZE) + 1}: deleted ${resp.Deleted?.length ?? 0} / ${batch.length} objects`)
  }

  return { deleted, errors }
}

// ─── Resolve a sample of known URLs to verify 404 ─────────────────────────

async function spotCheckUrls(audioUrls: string[]) {
  if (audioUrls.length === 0) {
    log('No audio URLs to spot-check.')
    return
  }

  log('Spot-checking previously known audio URLs (expect 404 or 403)...')
  const sample = audioUrls.slice(0, 5)

  for (const url of sample) {
    try {
      const resp = await fetch(url, { method: 'HEAD' })
      if (resp.status === 200) {
        warn(`  STILL LIVE (${resp.status}): ${url}`)
      } else {
        log(`  ✅ ${resp.status}: ${url}`)
      }
    } catch (err: any) {
      log(`  ✅ Network error (effectively inaccessible): ${url.split('/').at(-1)}`)
    }
  }
}

// ─── Count orphaned audioUrl references in DB ──────────────────────────────

async function auditDbAudioUrls(prisma: PrismaClient) {
  log('Auditing DB for remaining audioUrl references...')

  const count = await prisma.generatedWhisper.count({
    where: { audioUrl: { not: null } },
  })

  log(`  ${count} GeneratedWhisper records still have a non-null audioUrl`)
  log('  These are now orphaned stubs (files deleted, DB row intact).')
  log('  Phase 3 (reset-content.ts) will delete these rows entirely.')

  return count
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  log('╔═══════════════════════════════════════════════════════════╗')
  log('║  CityWhispers — Phase 2: Storage Cleanup                  ║')
  log(`║  Date: ${DATE_STAMP}                                        ║`)
  log(`║  Mode: ${DRY_RUN ? 'DRY RUN (pass --execute to delete)  ' : 'LIVE — DELETING FOR REAL         '}  ║`)
  log('╚═══════════════════════════════════════════════════════════╝')
  log('')

  if (DRY_RUN) {
    log('DRY RUN MODE — nothing will be deleted.')
    log('Re-run with --execute to perform actual deletion.')
    log('')
  } else {
    log('⚠️  LIVE MODE — objects will be permanently deleted.')
    log('You have 5 seconds to Ctrl+C if this is wrong...')
    await new Promise((r) => setTimeout(r, 5000))
    log('Proceeding.')
    log('')
  }

  const s3 = buildS3Client()
  const prisma = buildPrisma()

  // Collect all known audioUrls before any deletion (for spot-check later)
  const knownAudioUrls = (
    await prisma.generatedWhisper.findMany({
      where: { audioUrl: { not: null } },
      select: { audioUrl: true },
      take: 10,
    })
  )
    .map((w) => w.audioUrl!)
    .filter(Boolean)

  // ── Discover buckets ────────────────────────────────────────────────────
  let buckets: string[] = []
  try {
    const resp = await s3.send(new ListBucketsCommand({}))
    buckets = (resp.Buckets ?? []).map((b) => b.Name!).filter(Boolean)
    log(`Buckets found: ${buckets.join(', ') || '(none)'}`)
  } catch (err: any) {
    warn(`Could not list buckets: ${err.message}`)
    warn('Falling back to known bucket: whisper-audio')
    buckets = ['whisper-audio']
  }

  // ── Delete pass ─────────────────────────────────────────────────────────
  const deletionSummary: Record<string, { found: number; deleted: number; errors: string[] }> = {}

  for (const bucket of buckets) {
    log('')
    log(`── Bucket: ${bucket} ──`)

    const objects = await listAllObjects(s3, bucket)
    log(`  Found ${objects.length} objects`)

    if (objects.length === 0) {
      log('  Already empty — nothing to do.')
      deletionSummary[bucket] = { found: 0, deleted: 0, errors: [] }
      continue
    }

    if (DRY_RUN) {
      log(`  [DRY RUN] Would delete ${objects.length} objects.`)
      // Show a sample
      const sample = objects.slice(0, 5)
      for (const obj of sample) {
        log(`    ${obj.key} (${(obj.size / 1024).toFixed(1)} KB)`)
      }
      if (objects.length > 5) log(`    … and ${objects.length - 5} more`)
      deletionSummary[bucket] = { found: objects.length, deleted: 0, errors: [] }
      continue
    }

    const keys = objects.map((o) => o.key)
    const { deleted, errors } = await deleteBatch(s3, bucket, keys)
    deletionSummary[bucket] = { found: objects.length, deleted, errors }

    if (errors.length > 0) {
      for (const e of errors) fail(`  Delete error: ${e}`)
    } else {
      log(`  ✅ All ${deleted} objects deleted`)
    }
  }

  // ── Verification pass ───────────────────────────────────────────────────
  if (!DRY_RUN) {
    log('')
    log('Running verification pass (second listing)...')

    for (const bucket of buckets) {
      const remaining = await listAllObjects(s3, bucket)
      if (remaining.length === 0) {
        log(`  ✅ ${bucket}: 0 objects remaining`)
      } else {
        fail(`  ${bucket}: ${remaining.length} objects still present — deletion may be incomplete`)
        for (const obj of remaining.slice(0, 10)) {
          fail(`    ${obj.key}`)
        }
      }
    }
  }

  // ── Spot-check URLs ─────────────────────────────────────────────────────
  if (!DRY_RUN && knownAudioUrls.length > 0) {
    log('')
    await spotCheckUrls(knownAudioUrls)
  }

  // ── DB audit ────────────────────────────────────────────────────────────
  log('')
  const orphanCount = await auditDbAudioUrls(prisma)

  // ── Summary ─────────────────────────────────────────────────────────────
  log('')
  log('═══════════════════════════════════════════════════════════')
  log(`  PHASE 2 SUMMARY — ${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'}`)
  log('═══════════════════════════════════════════════════════════')

  for (const [bucket, stats] of Object.entries(deletionSummary)) {
    if (DRY_RUN) {
      log(`  ${bucket}: ${stats.found} objects would be deleted`)
    } else {
      const status = stats.errors.length > 0 ? '⚠️ ' : '✅'
      log(`  ${status} ${bucket}: ${stats.deleted}/${stats.found} deleted, ${stats.errors.length} errors`)
    }
  }

  log(`  DB orphaned audioUrl rows: ${orphanCount} (cleaned in Phase 3)`)
  log('')

  if (DRY_RUN) {
    log('  Re-run with --execute to perform deletion:')
    log('    npx tsx scripts/cleanup-storage.ts --execute')
    log('  or:')
    log('    npm run reset:storage -- --execute')
  } else {
    log('  PHASE 2 COMPLETION CHECKLIST:')
    log('  □  All buckets show 0 objects above')
    log('  □  Spot-checked URLs return 404 / 403 above')
    log('  □  Storage dashboard in Supabase confirms empty state')
    log('  □  Orphaned audioUrl count noted for the record')
    log('  □  Team lead signs off → proceed to Phase 3')
  }

  log('═══════════════════════════════════════════════════════════')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  fail(`Fatal: ${err.message}`)
  if (err.stack) fail(err.stack)
  process.exitCode = 1
}).finally(() => {
  // Always write run log — even on failure
  try {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
    const logFile = path.join(
      ARCHIVE_DIR,
      `storage-cleanup-log${DRY_RUN ? '-dry-run' : ''}.txt`
    )
    fs.writeFileSync(logFile, LOG_LINES.join('\n') + '\n', 'utf-8')
    console.log(`\nRun log written to: ${logFile}`)
  } catch {
    // Don't mask original error
  }
})
