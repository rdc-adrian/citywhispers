/**
 * Whisper generation + quality scoring pipeline.
 *
 * Entry points:
 *   generateWhisper(poiId, personaSlug?)  — full pipeline, returns raw text
 *   scoreWhisper(text)                    — scoring pass, returns 0–100
 *   buildSystemPrompt(tonePrompt?)        — exported for unit tests
 *   buildUserPrompt(poi, facts)           — exported for unit tests
 */

import { createHash } from 'crypto'
import { prisma } from '../lib/prisma'
import { getAIProvider } from './ai'
import { GenerationError, NotFoundError } from '../lib/errors'

// ── Constants ──────────────────────────────────────────────────────────────

export const DECLAN_SAGE_SLUG = 'declan_sage'

const DECLAN_SAGE_TONE = `You are Declan Sage — a low-register narrator with restrained gravel texture and deliberate silence handling. You preserve emotional residue without introducing documentary, meditation-app, or guided-tour energy. The city speaks through you as memory surfacing through a place — intimate, unhurried, slightly incomplete.`

/**
 * Hard-constraint system prompt shared by all personas.
 * Tonal brief from CLAUDE.md encoded as non-negotiable rules.
 */
const SYSTEM_PROMPT_BASE = `You write whispers for CityWhispers — short audio pieces where a city speaks to a single person standing in a specific place.

HARD CONSTRAINTS — these are product requirements, not style suggestions:
- First person, present tense only. The narrator is the place itself, or someone who has always been here. Never "this building was…"; instead: "the smell hasn't changed."
- 60–120 words. Count carefully. Shorter is often better. Do not pad to reach 60.
- No clean endings. The whisper must feel like it continues after the audio stops. Sentence endings soften rather than resolve.
- No second-person address whatsoever. Never write "you", "you are", "look up", "you'll notice", or any instruction to the listener.
- No dates stated as facts. If a historical detail appears, it must feel incidental — noticed, not reported. "1952" as a year-of-construction is forbidden. The feeling of age is not.
- No tour-guide tone. No history-lesson register. No meditation-app phrasing. No commercial cadence.

EMOTIONAL REGISTER:
- Humid, unhurried, slightly melancholy — the register of old photographs.
- Not sad. Aware that things persist and disappear at the same time.
- A detail so specific it feels impossible to have made up.
- A tension between what this place used to be and what it is now, held lightly.
- The texture of daily life: who comes here at 6am, what the light does, what gets left behind.

Singapore palette (when applicable): humidity and memory, the persistence of old things inside new cities, the texture of daily life in a place that moves fast. Whispers should feel overheard, not narrated.

OUTPUT: Return only the whisper text. No title, no label, no explanation, no word count.`

/**
 * Scoring rubric for the quality pass.
 * The AI returns a single number 0–100.
 */
const SCORING_RUBRIC = `You are a quality scorer for the CityWhispers app. Score whisper texts against the tonal brief. Return ONLY a number between 0 and 100 — no explanation, no label, just the number.

Deduct points for violations:
- Any second-person address ("you", "you are", "look up", "you'll") → −30
- Dates or statistics stated as facts ("it was built in 1952") → −15
- Clean, resolved ending (whisper feels finished, not continuing) → −15
- Tour-guide or history-lesson register → −20
- Meditation-app or commercial cadence → −15
- First person not maintained throughout → −20
- Fewer than 60 or more than 120 words → −15

Award points for quality:
- Specific, sensory, atmospheric detail that feels impossible to have invented → +10
- Tension between what a place was and what it is now, held without explanation → +10
- Ending that softens rather than resolves — feeling of continuity → +10
- Humidity, unhurried pacing, slight melancholy without self-pity → +10

Start from 60 as baseline. Return only the final number.`

// ── Prompt builders (exported for unit tests) ──────────────────────────────

export type PoiForPrompt = {
  name: string
  category: string
  emotionalTone?: string | null
  ambientProfile?: string | null
  environmentalTexture?: string | null
  timeOfDayAffinity?: string | null
}

export type FactForPrompt = {
  factType: string
  body: string
}

/**
 * Build the system prompt, injecting the persona tone.
 * Falls back to Declan Sage tone if no persona tone is provided.
 */
export function buildSystemPrompt(personaTonePrompt?: string | null): string {
  const tone = personaTonePrompt ?? DECLAN_SAGE_TONE
  return `${SYSTEM_PROMPT_BASE}\n\nNARRATOR VOICE:\n${tone}`
}

/**
 * Build the user prompt from POI metadata and facts.
 * Each fact's body is embedded verbatim so the prompt-builder test can assert presence.
 */
export function buildUserPrompt(poi: PoiForPrompt, facts: FactForPrompt[]): string {
  const lines: string[] = [`PLACE: ${poi.name}`, `CATEGORY: ${poi.category}`]

  if (poi.emotionalTone) lines.push(`EMOTIONAL TONE: ${poi.emotionalTone}`)
  if (poi.ambientProfile) lines.push(`ATMOSPHERE: ${poi.ambientProfile}`)
  if (poi.environmentalTexture) lines.push(`TEXTURE: ${poi.environmentalTexture}`)
  if (poi.timeOfDayAffinity) lines.push(`TIME OF DAY: ${poi.timeOfDayAffinity}`)

  lines.push('\nFACTS (raw material — do not quote directly, use as atmosphere):')
  for (const fact of facts) {
    lines.push(`[${fact.factType.toUpperCase()}] ${fact.body}`)
  }

  lines.push('\nWrite the whisper now.')
  return lines.join('\n')
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function hashPrompt(systemPrompt: string, userPrompt: string): string {
  return createHash('sha256')
    .update(systemPrompt + '\n---\n' + userPrompt)
    .digest('hex')
    .slice(0, 32)
}

export function getCurrentTimeSlot(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

/**
 * Ensure the Declan Sage persona exists — create it if not.
 * Called by the generation pipeline when no personaSlug is provided.
 */
export async function ensureDefaultPersona(): Promise<{
  id: string
  slug: string
  tonePrompt: string
}> {
  let persona = await prisma.persona.findUnique({
    where: { slug: DECLAN_SAGE_SLUG },
  })

  if (!persona) {
    persona = await prisma.persona.create({
      data: {
        slug: DECLAN_SAGE_SLUG,
        name: 'Declan Sage',
        tonePrompt: DECLAN_SAGE_TONE,
        active: true,
      },
    })
  }

  return persona
}

// ── Core pipeline ──────────────────────────────────────────────────────────

/**
 * Generate whisper text for a POI.
 *
 * @param poiId       UUID of the POI to generate for
 * @param personaSlug Optional persona slug; defaults to Declan Sage
 * @returns           { text, systemPrompt, userPrompt, promptHash, personaId, poi }
 */
export async function generateWhisper(
  poiId: string,
  personaSlug?: string,
): Promise<{
  text: string
  systemPrompt: string
  userPrompt: string
  promptHash: string
  personaId: string
  poi: { id: string; cityId: string; geohash6: string }
}> {
  // 1. Load POI with facts
  const poi = await prisma.poi.findUnique({
    where: { id: poiId },
    include: { poiFacts: true },
  })

  if (!poi) throw new NotFoundError('POI')

  if (poi.poiFacts.length < 2) {
    throw new GenerationError(
      `POI "${poi.name}" has ${poi.poiFacts.length} fact(s) — at least 2 are required to generate a whisper`,
    )
  }

  // 2. Resolve persona
  const persona = personaSlug
    ? await prisma.persona.findUnique({ where: { slug: personaSlug } })
    : await ensureDefaultPersona()

  if (personaSlug && !persona) {
    throw new NotFoundError(`Persona "${personaSlug}"`)
  }

  const resolvedPersona = persona!

  // 3. Build prompts
  const systemPrompt = buildSystemPrompt(resolvedPersona.tonePrompt)
  const userPrompt = buildUserPrompt(poi, poi.poiFacts)
  const promptHash = hashPrompt(systemPrompt, userPrompt)

  // 4. Call AI provider
  const provider = getAIProvider()
  const text = await provider.generate(systemPrompt, userPrompt)

  return {
    text,
    systemPrompt,
    userPrompt,
    promptHash,
    personaId: resolvedPersona.id,
    poi: { id: poi.id, cityId: poi.cityId, geohash6: poi.geohash6 },
  }
}

/**
 * Score a whisper text against the tonal brief rubric.
 * Returns a float in [0, 100]. Wraps errors — callers should log and continue.
 */
export async function scoreWhisper(text: string): Promise<number> {
  const provider = getAIProvider()
  return provider.score(text, SCORING_RUBRIC)
}
