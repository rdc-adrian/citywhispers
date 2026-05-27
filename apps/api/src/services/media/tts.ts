/**
 * Google Cloud Text-to-Speech — narrator profile system.
 *
 * Three narrators are registered. Only Aoede is active as the production
 * default — Charon and Neural2-B are infrastructure preparation, no UI
 * exposure yet. Persona-based selection (Charon for nighttime slot) to be
 * wired in a future sprint.
 *
 * The voice config is server-controlled and must not be exposed to or
 * overridable by the mobile client under any circumstances.
 *
 * Auth: GCP service account credentials via env vars.
 * Required IAM role: Cloud Text-to-Speech API User
 *
 * Env vars required:
 *   GOOGLE_CLOUD_PROJECT_ID
 *   GOOGLE_CLOUD_CLIENT_EMAIL
 *   GOOGLE_CLOUD_PRIVATE_KEY   (literal \n sequences are normalised on load)
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { TTSError } from '../../lib/errors'
import { buildSsml } from './ssml'

// ── Narrator profiles ─────────────────────────────────────────────────────────

export interface NarratorProfile {
  id: string
  voiceName: string
  languageCode: string
  speakingRate: number
  /** Chirp3-HD voices do not support pitch — omit for those profiles */
  pitch?: number
  volumeGainDb: number
}

// Confirmed narrator roster (PM, 2026-05-27).
// GCP has no en-SG locale — all voices are en-GB.
export const NARRATOR_PROFILES: Record<string, NarratorProfile> = {
  // Primary MVP narrator — Chirp3-HD female. More expressive than Neural2;
  // the SSML layer and pitch/rate settings suppress BBC energy.
  aoede: {
    id: 'aoede',
    voiceName: 'en-GB-Chirp3-HD-Aoede',
    languageCode: 'en-GB',
    speakingRate: 0.90,
    // pitch omitted — Chirp3-HD does not support the pitch parameter
    volumeGainDb: -0.5,
  },

  // Experimental nighttime / industrial whispers — deeper male register.
  // Not yet wired to any content path; available for SSML preview tests.
  charon: {
    id: 'charon',
    voiceName: 'en-GB-Chirp3-HD-Charon',
    languageCode: 'en-GB',
    speakingRate: 0.88,
    // pitch omitted — Chirp3-HD does not support the pitch parameter
    volumeGainDb: -1.0,
  },

  // Stable fallback — Neural2 male. Use if Chirp3-HD quality regresses or
  // if the Aoede character is too expressive for a specific whisper.
  neural2_b: {
    id: 'neural2_b',
    voiceName: 'en-GB-Neural2-B',
    languageCode: 'en-GB',
    speakingRate: 0.88,
    pitch: -2.0,
    volumeGainDb: -1.5,
  },
}

export const DEFAULT_NARRATOR = NARRATOR_PROFILES.aoede

// ── TTS client (lazy) ─────────────────────────────────────────────────────────

let _client: TextToSpeechClient | null = null

function getClient(): TextToSpeechClient {
  if (_client) return _client

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new TTSError(
      'Google Cloud TTS credentials not configured. ' +
        'Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, GOOGLE_CLOUD_PRIVATE_KEY.'
    )
  }

  _client = new TextToSpeechClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    projectId,
  })

  return _client
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate narration audio for a whisper and return the raw MP3 buffer.
 *
 * Builds SSML from raw text first (phoneme overrides + pacing structure),
 * then sends to GCP TTS using the resolved narrator profile.
 *
 * @param text        Raw whisper text — not pre-processed SSML
 * @param whisperId   UUID of the whisper — used for log correlation only
 * @param narratorId  Narrator to use — defaults to 'aoede' (production default).
 *                    Do not pass this from mobile clients; server resolves it.
 */
export async function generateNarrationAudio(
  text: string,
  whisperId: string,
  narratorId = 'aoede'
): Promise<Buffer> {
  const profile = NARRATOR_PROFILES[narratorId] ?? DEFAULT_NARRATOR
  return synthesize(text, whisperId, profile)
}

/**
 * Generate narration from an already-built SSML string.
 * Used by the preview endpoint to test custom SSML variants without going
 * through the full approve → generate → serve cycle.
 */
export async function generateNarrationFromSsml(
  ssml: string,
  whisperId: string,
  narratorId = 'aoede'
): Promise<Buffer> {
  const profile = NARRATOR_PROFILES[narratorId] ?? DEFAULT_NARRATOR
  return synthesizeRaw({ ssml }, whisperId, profile)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function synthesize(
  text: string,
  whisperId: string,
  profile: NarratorProfile
): Promise<Buffer> {
  const ssml = buildSsml(text)
  return synthesizeRaw({ ssml }, whisperId, profile)
}

async function synthesizeRaw(
  input: { ssml: string } | { text: string },
  whisperId: string,
  profile: NarratorProfile
): Promise<Buffer> {
  const client = getClient()

  let response
  try {
    ;[response] = await client.synthesizeSpeech({
      input,
      voice: {
        languageCode: profile.languageCode,
        name: profile.voiceName,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: profile.speakingRate,
        // Chirp3-HD voices reject pitch — only include when explicitly set
        ...(profile.pitch !== undefined ? { pitch: profile.pitch } : {}),
        volumeGainDb: profile.volumeGainDb,
      },
    })
  } catch (err) {
    throw new TTSError(
      `GCP TTS synthesis failed for whisper ${whisperId} (narrator: ${profile.id}): ${(err as Error).message}`
    )
  }

  if (!response.audioContent) {
    throw new TTSError(
      `GCP TTS returned empty audio for whisper ${whisperId} (narrator: ${profile.id})`
    )
  }

  return Buffer.from(response.audioContent as Uint8Array)
}
