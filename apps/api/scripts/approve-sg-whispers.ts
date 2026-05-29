/**
 * Batch-approve all draft Singapore whispers.
 *
 * For each draft GeneratedWhisper attached to the Singapore city:
 *   1. Generates TTS audio via GCP Chirp3-HD Aoede
 *   2. Uploads MP3 to Supabase `whisper-audio` bucket (writes audioUrl to DB)
 *   3. Sets status → 'approved'
 *   4. Records a GenerationJob for the audit trail
 *
 * Mirrors the logic in PATCH /admin/whispers/:id/status but runs synchronously
 * per-whisper so failures are isolated and progress is visible in the terminal.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/approve-sg-whispers.ts
 *
 * Requires env vars: DATABASE_URL (or DIRECT_URL), GOOGLE_CLOUD_*, SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY — all loaded from .env via dotenv/config in lib/prisma.ts.
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { generateNarrationAudio } from '../src/services/media/tts'
import { uploadAudioAssetFromCity } from '../src/services/media/upload'

async function main() {
  const city = await prisma.city.findFirst({ where: { name: 'Singapore' } })
  if (!city) throw new Error('Singapore city not found — run seed-production.ts first.')

  const drafts = await prisma.generatedWhisper.findMany({
    where: { cityId: city.id, isStale: false, status: 'draft' },
    include: { poi: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  if (drafts.length === 0) {
    console.log('No draft whispers found for Singapore.')
    return
  }

  console.log(`🇸🇬  Approving ${drafts.length} Singapore whispers\n`)

  let succeeded = 0
  let failed = 0
  const errors: { id: string; poi: string; error: string }[] = []

  for (const whisper of drafts) {
    const poiLabel = whisper.poi?.name ?? whisper.id
    process.stdout.write(`  ${poiLabel}\n    → generating TTS... `)

    const job = await prisma.generationJob.create({
      data: {
        whisperId: whisper.id,
        jobType: 'audio_generation',
        status: 'pending',
        queueName: 'batch-approve',
      },
    })

    try {
      const audioBuffer = await generateNarrationAudio(whisper.whisperText, whisper.id)
      process.stdout.write('uploading... ')

      // uploadAudioAssetFromCity uploads to Supabase and writes audioUrl back to the record
      const audioUrl = await uploadAudioAssetFromCity(
        whisper.id,
        { countryCode: city.countryCode, name: city.name },
        audioBuffer
      )

      // Approve — uses `as any` for Prisma v7 type-path workaround (status field is live in DB)
      await prisma.generatedWhisper.update({
        where: { id: whisper.id },
        data: { status: 'approved' } as any,
      })

      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date() },
      })

      const filename = audioUrl.split('/').pop()
      console.log(`✅  ${filename}`)
      succeeded++
    } catch (err) {
      const message = (err as Error).message
      console.log(`❌  ${message}`)
      errors.push({ id: whisper.id, poi: poiLabel, error: message })
      failed++

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      }).catch(() => { /* ignore secondary DB failure */ })
    }

    // Brief pause between GCP requests — avoids quota bursts on 15 sequential calls
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log(`\n📊  Summary: ${succeeded} approved, ${failed} failed`)

  if (errors.length > 0) {
    console.log('\nFailed whispers:')
    for (const e of errors) {
      console.log(`  ⚠  "${e.poi}" (${e.id})`)
      console.log(`     ${e.error}`)
    }
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
