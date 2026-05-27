/**
 * Supabase Storage media service.
 *
 * Uploads whisper audio buffers to the `whisper-audio` bucket and writes the
 * resulting public URL back to the GeneratedWhisper record.
 *
 * Key design choices:
 *   - Uses the Supabase Storage REST API directly (no SDK dependency).
 *   - `x-upsert: true` — re-generation overwrites the existing file deterministically.
 *   - File key is `{whisperId}.mp3` — deterministic, prevents orphaned files.
 *   - Public URL is derived from the project URL, not returned from the API, so it
 *     doesn't require an extra round-trip.
 *
 * Env vars required:
 *   SUPABASE_URL               — e.g. https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  — service role JWT; bypasses RLS; never expose client-side
 */

import { prisma } from '../lib/prisma'
import { MediaUploadError } from '../lib/errors'

const BUCKET = 'whisper-audio'

/**
 * Upload an MP3 buffer to the `whisper-audio` Supabase bucket, then write the
 * public URL back to the GeneratedWhisper record.
 *
 * @param whisperId   UUID of the whisper — used as the deterministic filename
 * @param audioBuffer Raw MP3 bytes from the TTS service
 * @returns           The public CDN URL of the uploaded audio file
 */
export async function uploadWhisperAudio(
  whisperId: string,
  audioBuffer: Buffer
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new MediaUploadError(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured'
    )
  }

  const fileName = `${whisperId}.mp3`
  const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${BUCKET}/${fileName}`

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'audio/mpeg',
      // Overwrite if re-generating for the same whisper ID
      'x-upsert': 'true',
    },
    body: audioBuffer,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new MediaUploadError(
      `Supabase storage upload failed (HTTP ${response.status}): ${body}`
    )
  }

  // Public URL — no additional API call needed
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${fileName}`

  // Persist back to the whisper record
  await prisma.generatedWhisper.update({
    where: { id: whisperId },
    data: { audioUrl: publicUrl },
  })

  return publicUrl
}
