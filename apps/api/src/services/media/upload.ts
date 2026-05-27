/**
 * Supabase Storage — audio upload service.
 *
 * Stores whisper audio under a city-namespaced path and writes the public URL
 * back to the GeneratedWhisper record. Files are treated as immutable after
 * generation — regeneration overwrites at the same path (x-upsert: true)
 * rather than creating new keys.
 *
 * Storage path: `city/{citySlug}/whispers/{whisperId}.mp3`
 *   citySlug is derived from City.countryCode + City.name (e.g. 'sg-singapore')
 *
 * Env vars required:
 *   SUPABASE_URL               — e.g. https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  — service role JWT; bypasses RLS; never expose client-side
 */

import { prisma } from '../../lib/prisma'
import { MediaUploadError } from '../../lib/errors'

const BUCKET = 'whisper-audio'

/**
 * Derive a URL-safe city slug from countryCode + name.
 * Example: countryCode='SG', name='Singapore' → 'sg-singapore'
 */
function deriveCitySlug(countryCode: string, name: string): string {
  const code = countryCode.toLowerCase()
  const nameSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${code}-${nameSlug}`
}

/**
 * Upload an MP3 buffer to the `whisper-audio` bucket and write the public
 * URL back to the GeneratedWhisper record.
 *
 * @param whisperId   UUID of the whisper — deterministic filename
 * @param citySlug    URL-safe city identifier (e.g. 'sg-singapore')
 * @param audioBuffer Raw MP3 bytes from the TTS service
 * @returns           Public CDN URL
 */
export async function uploadAudioAsset(
  whisperId: string,
  citySlug: string,
  audioBuffer: Buffer
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new MediaUploadError(
      'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured'
    )
  }

  const filePath = `city/${citySlug}/whispers/${whisperId}.mp3`
  const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${BUCKET}/${filePath}`

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'audio/mpeg',
      'x-upsert': 'true',
    },
    body: audioBuffer,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new MediaUploadError(
      `Supabase upload failed (HTTP ${response.status}): ${body}`
    )
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${filePath}`

  await prisma.generatedWhisper.update({
    where: { id: whisperId },
    data: { audioUrl: publicUrl },
  })

  return publicUrl
}

/**
 * Convenience overload for callers that have a City record with countryCode
 * and name. Derives citySlug internally.
 */
export async function uploadAudioAssetFromCity(
  whisperId: string,
  city: { countryCode: string; name: string },
  audioBuffer: Buffer
): Promise<string> {
  return uploadAudioAsset(
    whisperId,
    deriveCitySlug(city.countryCode, city.name),
    audioBuffer
  )
}
