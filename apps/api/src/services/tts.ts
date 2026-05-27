/**
 * ElevenLabs Text-to-Speech service.
 *
 * Production voice settings (Declan Sage baseline from CLAUDE.md):
 *   stability: 39%  — preserves breath, pause, and slight vocal instability
 *   similarity: 78% — avoids over-enunciation without losing voice identity
 *   style: 0.0      — minimal style exaggeration (no podcast / meditation-app energy)
 *
 * Model: eleven_multilingual_v2 (default) — handles Singapore English naturally.
 *        eleven_multilingual_v3 if ELEVENLABS_MODEL_ID is set.
 *
 * Env vars required:
 *   ELEVENLABS_API_KEY
 *   ELEVENLABS_VOICE_ID_DECLAN   — primary narrator
 *   ELEVENLABS_VOICE_ID_ARABELLA — secondary narrator (optional)
 */

import { TTSError } from '../lib/errors'

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io'
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'

// Production voice settings from CLAUDE.md
const VOICE_SETTINGS = {
  stability: 0.39,
  similarity_boost: 0.78,
  style: 0.0,
  use_speaker_boost: true,
} as const

export interface TTSRequest {
  text: string
  voiceId: string
  modelId?: string
}

/**
 * Generate TTS audio via ElevenLabs and return the raw MP3 buffer.
 * Throws TTSError on any non-200 response — callers must catch and surface
 * this as a GenerationJob failure status.
 */
export async function generateTTS({ text, voiceId, modelId }: TTSRequest): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new TTSError('ELEVENLABS_API_KEY is not configured')
  }

  const resolvedModel = modelId ?? process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID

  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: resolvedModel,
        voice_settings: VOICE_SETTINGS,
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new TTSError(
      `ElevenLabs TTS failed (HTTP ${response.status}): ${body}`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Return the configured voice ID for Declan Sage.
 * Throws if not set — callers should validate env on startup.
 */
export function getDeclanVoiceId(): string {
  const voiceId = process.env.ELEVENLABS_VOICE_ID_DECLAN
  if (!voiceId) {
    throw new TTSError('ELEVENLABS_VOICE_ID_DECLAN is not configured')
  }
  return voiceId
}

/**
 * Return the configured voice ID for Arabella (secondary narrator).
 * Throws if not set.
 */
export function getArabellaVoiceId(): string {
  const voiceId = process.env.ELEVENLABS_VOICE_ID_ARABELLA
  if (!voiceId) {
    throw new TTSError('ELEVENLABS_VOICE_ID_ARABELLA is not configured')
  }
  return voiceId
}

/**
 * Resolve the correct ElevenLabs voice ID for a given persona slug.
 * Falls back to Declan Sage for unknown slugs.
 */
export function resolveVoiceId(personaSlug: string): string {
  switch (personaSlug.toLowerCase()) {
    case 'arabella':
      return getArabellaVoiceId()
    case 'declan_sage':
    default:
      return getDeclanVoiceId()
  }
}
