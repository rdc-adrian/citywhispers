import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { generateWhisper, scoreWhisper, getCurrentTimeSlot } from '../../services/generation'
import { getAIProvider } from '../../services/ai'
import { generateNarrationAudio, generateNarrationFromSsml, NARRATOR_PROFILES, DEFAULT_NARRATOR } from '../../services/media/tts'
import { uploadAudioAssetFromCity } from '../../services/media/upload'
import { NotFoundError, GenerationError } from '../../lib/errors'

// ── Validation schemas ─────────────────────────────────────────────────────

const CreateWhisperSchema = z.object({
  poiId: z.string().optional(),
  cityId: z.string().min(1),
  personaId: z.string().min(1),
  geohash6: z.string().length(6),
  timeSlot: z.enum(['morning', 'afternoon', 'evening', 'night']),
  whisperText: z.string().min(10).max(1000),
  source: z.enum(['ai', 'curated', 'community']).default('curated'),
  qualityScore: z.number().min(0).max(100).optional(),
  isFeatured: z.boolean().default(false),
})

const GenerateWhisperSchema = z.object({
  poiId: z.string().min(1, 'poiId is required'),
  personaSlug: z.string().optional(),
})

const WhisperStatusSchema = z.object({
  status: z.enum(['approved', 'needs-review']),
})

// ── Route handler ──────────────────────────────────────────────────────────

export async function adminWhisperRoutes(app: FastifyInstance) {
  // ── GET /admin/whispers ──────────────────────────────────────────────────
  app.get<{
    Querystring: {
      cityId?: string
      personaId?: string
      timeSlot?: string
      isFeatured?: string
      status?: string
    }
  }>('/', async (request) => {
    const { cityId, personaId, timeSlot, isFeatured, status } = request.query
    const whispers = await prisma.generatedWhisper.findMany({
      where: {
        ...(cityId ? { cityId } : {}),
        ...(personaId ? { personaId } : {}),
        ...(timeSlot ? { timeSlot } : {}),
        ...(isFeatured ? { isFeatured: isFeatured === 'true' } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        persona: { select: { slug: true, name: true } },
        poi: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { data: whispers }
  })

  // ── POST /admin/whispers/preview-narration — G-5 ────────────────────────
  // Registered BEFORE /:id routes so the literal path is never captured as an id.
  //
  // Lets the content team test SSML variants and phoneme fixes without going
  // through the full approve → generate → serve cycle. Does NOT write to the DB.
  //
  // Body: { text, narratorId?, ssmlOverride? }
  //   text         — raw whisper text (buildSsml runs automatically)
  //   narratorId   — one of 'aoede' | 'charon' | 'neural2_b' (default: 'aoede')
  //   ssmlOverride — if provided, skips buildSsml and sends this SSML directly
  //
  // Returns: { audioBase64, mimeType, narratorId, voiceName, ssml }
  //   audioBase64 — base64-encoded MP3 — play directly in browser or audio tag
  //   ssml        — the SSML that was sent to GCP (useful for debugging pacing)
  app.post('/preview-narration', async (request, reply) => {
    const PreviewSchema = z.object({
      text: z.string().min(1).max(2000),
      narratorId: z.enum(['aoede', 'charon', 'neural2_b']).optional().default('aoede'),
      ssmlOverride: z.string().optional(),
    })

    const { text, narratorId, ssmlOverride } = PreviewSchema.parse(request.body)
    const profile = NARRATOR_PROFILES[narratorId] ?? NARRATOR_PROFILES.aoede

    // Build SSML ourselves so we can return it in the response for inspection
    let ssml: string
    let audioBuffer: Buffer

    if (ssmlOverride) {
      ssml = ssmlOverride
      audioBuffer = await generateNarrationFromSsml(ssmlOverride, 'preview', narratorId)
    } else {
      // Import buildSsml here to avoid circular dep risk — ssml.ts has no server deps
      const { buildSsml } = await import('../../services/media/ssml')
      ssml = buildSsml(text)
      audioBuffer = await generateNarrationAudio(text, 'preview', narratorId)
    }

    return reply.send({
      data: {
        audioBase64: audioBuffer.toString('base64'),
        mimeType: 'audio/mpeg',
        narratorId: profile.id,
        voiceName: profile.voiceName,
        ssml,
      },
    })
  })

  // ── POST /admin/whispers/generate — F-2 ─────────────────────────────────
  // Registered BEFORE /:id routes so "generate" is never captured as an id param.
  app.post('/generate', async (request, reply) => {
    const { poiId, personaSlug } = GenerateWhisperSchema.parse(request.body)

    // Create a GenerationJob to track this async work
    const job = await prisma.generationJob.create({
      data: {
        jobType: 'whisper_generation',
        status: 'pending',
        queueName: 'admin-generate',
      },
    })

    try {
      // Run the generation pipeline
      const result = await generateWhisper(poiId, personaSlug)

      // Create the whisper record at draft status
      const whisper = await prisma.generatedWhisper.create({
        data: {
          poiId: result.poi.id,
          cityId: result.poi.cityId,
          personaId: result.personaId,
          geohash6: result.poi.geohash6,
          timeSlot: getCurrentTimeSlot(),
          whisperText: result.text,
          modelUsed: getAIProvider().name,
          promptHash: result.promptHash,
          source: 'ai',
          status: 'draft',
          isStale: false,
        },
        include: {
          persona: { select: { slug: true, name: true } },
          poi: { select: { name: true, category: true } },
        },
      })

      // Score the whisper — non-blocking: log failure, never throw
      let qualityScore: number | null = null
      try {
        qualityScore = await scoreWhisper(result.text)
        await prisma.generatedWhisper.update({
          where: { id: whisper.id },
          data: { qualityScore },
        })
      } catch (scoreErr) {
        request.log.warn({ err: scoreErr, whisperId: whisper.id }, 'Scoring pass failed — non-fatal')
      }

      // Mark job completed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          whisperId: whisper.id,
          status: 'completed',
          completedAt: new Date(),
        },
      })

      return reply.status(201).send({
        data: { ...whisper, qualityScore: qualityScore ?? whisper.qualityScore },
      })
    } catch (err) {
      // Mark job failed before re-throwing (errorHandler will return the HTTP error)
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: (err as Error).message,
          completedAt: new Date(),
        },
      }).catch(() => {/* ignore secondary DB failure */})

      throw err
    }
  })

  // ── POST /admin/whispers — create curated whisper ────────────────────────
  app.post('/', async (request, reply) => {
    const body = CreateWhisperSchema.parse(request.body)
    const whisper = await prisma.generatedWhisper.create({
      data: {
        ...body,
        modelUsed: 'curated',
        promptHash: `curated-${body.geohash6}-${body.personaId}-${body.timeSlot}-${Date.now()}`,
        // Curated whispers are approved by default — a human wrote them
        status: 'approved',
      },
    })
    return reply.status(201).send({ data: whisper })
  })

  // ── POST /admin/whispers/:id/regenerate — F-3 ───────────────────────────
  app.post<{ Params: { id: string } }>('/:id/regenerate', async (request, reply) => {
    const { id } = request.params

    // Load the existing whisper to inherit its poiId and persona
    const existing = await prisma.generatedWhisper.findUnique({
      where: { id },
      include: { persona: { select: { slug: true } }, poi: { select: { id: true } } },
    })

    if (!existing) throw new NotFoundError('Whisper')
    if (!existing.poi?.id) throw new GenerationError('Whisper has no associated POI — cannot regenerate')

    // Soft-replace: mark old whisper stale
    await prisma.generatedWhisper.update({
      where: { id },
      data: { isStale: true },
    })

    // Track this job
    const job = await prisma.generationJob.create({
      data: {
        whisperId: id,
        jobType: 'whisper_regeneration',
        status: 'pending',
        queueName: 'admin-regenerate',
      },
    })

    try {
      const personaSlug = existing.persona?.slug
      const result = await generateWhisper(existing.poi.id, personaSlug)

      const newWhisper = await prisma.generatedWhisper.create({
        data: {
          poiId: result.poi.id,
          cityId: result.poi.cityId,
          personaId: result.personaId,
          geohash6: result.poi.geohash6,
          timeSlot: existing.timeSlot,
          whisperText: result.text,
          modelUsed: getAIProvider().name,
          promptHash: result.promptHash,
          source: 'ai',
          status: 'draft',
          isStale: false,
        },
        include: {
          persona: { select: { slug: true, name: true } },
          poi: { select: { name: true, category: true } },
        },
      })

      // Score — non-blocking
      let qualityScore: number | null = null
      try {
        qualityScore = await scoreWhisper(result.text)
        await prisma.generatedWhisper.update({
          where: { id: newWhisper.id },
          data: { qualityScore },
        })
      } catch (scoreErr) {
        request.log.warn({ err: scoreErr, whisperId: newWhisper.id }, 'Scoring pass failed — non-fatal')
      }

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          whisperId: newWhisper.id,
          status: 'completed',
          completedAt: new Date(),
        },
      })

      return reply.status(201).send({
        data: { ...newWhisper, qualityScore: qualityScore ?? newWhisper.qualityScore },
      })
    } catch (err) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: (err as Error).message,
          completedAt: new Date(),
        },
      }).catch(() => {/* ignore */})
      throw err
    }
  })

  // ── PATCH /admin/whispers/:id/status — F-4 / G-3 ───────────────────────
  // When transitioning to 'approved', automatically triggers TTS generation.
  // Audio generation runs async (non-blocking) so the approve response is fast.
  // A GenerationJob tracks progress; audioUrl is written to the record on completion.
  app.patch<{ Params: { id: string } }>('/:id/status', async (request) => {
    const { id } = request.params
    const { status } = WhisperStatusSchema.parse(request.body)

    const existing = await prisma.generatedWhisper.findUnique({
      where: { id },
      include: {
        persona: { select: { slug: true } },
        city: { select: { name: true, countryCode: true } },
      },
    })
    if (!existing) throw new NotFoundError('Whisper')

    const whisper = await prisma.generatedWhisper.update({
      where: { id },
      // as any: Prisma v7 monorepo type path issue — status field is live in DB
      data: { status } as any,
    })

    // ── G-3: Trigger audio generation on approval ──────────────────────────
    if (status === 'approved') {
      // Create a GenerationJob to track the async audio pipeline
      const job = await prisma.generationJob.create({
        data: {
          whisperId: id,
          jobType: 'audio_generation',
          status: 'pending',
          queueName: 'tts-generate',
        },
      })

      // Fire-and-forget: resolve voice → generate TTS → upload → write URL
      void (async () => {
        try {
          request.log.info(
            { whisperId: id, narrator: DEFAULT_NARRATOR.id, voice: DEFAULT_NARRATOR.voiceName },
            'Starting TTS generation'
          )

          const audioBuffer = await generateNarrationAudio(existing.whisperText, id)

          const audioUrl = await uploadAudioAssetFromCity(id, existing.city, audioBuffer)

          await prisma.generationJob.update({
            where: { id: job.id },
            data: { status: 'completed', completedAt: new Date() },
          })

          request.log.info({ whisperId: id, audioUrl }, 'TTS generation completed')
        } catch (err) {
          request.log.error(
            { err, whisperId: id, jobId: job.id },
            'TTS generation failed'
          )
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              errorMessage: (err as Error).message,
              completedAt: new Date(),
            },
          }).catch(() => { /* ignore secondary DB failure */ })
        }
      })()
    }

    return { data: whisper }
  })

  // ── PATCH /admin/whispers/:id — generic partial update ──────────────────
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = CreateWhisperSchema.partial().parse(request.body)
    const whisper = await prisma.generatedWhisper.update({
      where: { id: request.params.id },
      data: body,
    })
    return { data: whisper }
  })

  // ── PATCH /admin/whispers/:id/feature — toggle featured ─────────────────
  app.patch<{ Params: { id: string } }>('/:id/feature', async (request) => {
    const { isFeatured } = z.object({ isFeatured: z.boolean() }).parse(request.body)
    const whisper = await prisma.generatedWhisper.update({
      where: { id: request.params.id },
      data: { isFeatured },
    })
    return { data: whisper }
  })

  // ── PATCH /admin/whispers/:id/stale — mark stale ────────────────────────
  app.patch<{ Params: { id: string } }>('/:id/stale', async (request) => {
    const { id } = request.params as { id: string }
    const whisper = await prisma.generatedWhisper.update({
      where: { id },
      data: { isStale: true },
    })
    return { data: whisper }
  })

  // ── DELETE /admin/whispers/:id ───────────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await prisma.generatedWhisper.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
