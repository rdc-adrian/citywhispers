/**
 * Sprint G tests — SSML builder + phoneme overrides
 *
 * buildSsml and applyPhonemeOverrides are independently testable — no external
 * dependencies, no mocks.
 *
 * Four suites:
 *   1. Structure     — <speak> wrapper, 1.8s leading break, 2.0s trailing break
 *   2. Sentences     — inter-sentence breaks present, pause scales with length
 *   3. Ellipses      — ... preserved + break inserted, not a sentence boundary
 *   4. Edge cases    — empty input, em-dashes untouched, single sentence
 *   5. Phonemes      — Singapore place names wrapped in <phoneme> tags
 */

import { describe, it, expect } from 'vitest'
import { buildSsml } from '../ssml'
import { applyPhonemeOverrides } from '../phonemes'

// ── Suite 1: Output structure ─────────────────────────────────────────────────

describe('buildSsml — structural requirements', () => {
  it('wraps output in a <speak> element', () => {
    const ssml = buildSsml('The smell has not changed.')
    expect(ssml).toMatch(/^<speak>/)
    expect(ssml).toMatch(/<\/speak>$/)
  })

  it('inserts a 1.8s leading break before the first word', () => {
    const ssml = buildSsml('The smell has not changed.')
    expect(ssml).toMatch(/<speak><break time="1\.8s"\/>/)
  })

  it('inserts a 2.0s trailing break before </speak>', () => {
    const ssml = buildSsml('The smell has not changed.')
    expect(ssml).toMatch(/<break time="2\.0s"\s*\/><\/speak>$/)
  })

  it('preserves the whisper text in the output', () => {
    const ssml = buildSsml('Old tiles. The light through them.')
    expect(ssml).toContain('Old tiles')
    expect(ssml).toContain('The light through them')
  })
})

// ── Suite 2: Multi-sentence pacing ────────────────────────────────────────────

describe('buildSsml — multi-sentence pacing', () => {
  it('inserts a break between two sentences', () => {
    const ssml = buildSsml(
      'The smell has not changed. Old things persist here.'
    )
    expect(ssml).toMatch(/changed\.<break time="[^"]+"\/>Old/)
  })

  it('inserts pauses between three sentences — 4 total breaks', () => {
    // 1 leading + 2 inter-sentence + 1 trailing
    const ssml = buildSsml(
      'The incense arrives before the street does. Nobody looks up. The tiles here are original.'
    )
    const breakCount = (ssml.match(/<break/g) ?? []).length
    expect(breakCount).toBe(4)
  })

  it('inter-sentence pauses fall within the 1.2s–2.2s range', () => {
    const ssml = buildSsml(
      'The incense arrives before the street does. Nobody looks up. The tiles here are original. Something about the morning.'
    )
    const pauses = [...ssml.matchAll(/<break time="([^"]+)"\/>/g)].map(m => m[1])
    const interSentence = pauses.filter(p => p !== '1.8s' && p !== '2.0s' && p !== '1.2s')
    const allowed = new Set(['1.2s', '1.6s', '2.0s', '2.2s'])
    for (const p of interSentence) {
      expect(allowed).toContain(p)
    }
  })

  it('short sentences get longer pauses than long sentences', () => {
    // "Nobody looks up." — 3 words → should be 2.2s pause
    // "The incense arrives before the street does, mixing with the diesel exhaust of delivery vans." — long → shorter pause
    const ssml = buildSsml(
      'Nobody looks up. The incense arrives before the street does, mixing with the diesel exhaust of delivery vans that have idled here for years.'
    )
    // Extract the inter-sentence break (between the two sentences)
    const match = ssml.match(/Nobody looks up\.<break time="([^"]+)"\/>/)
    expect(match).toBeTruthy()
    const shortSentencePause = match![1]
    // Short sentence (3 words) should get >= 2.0s
    const pauseMs = parseFloat(shortSentencePause)
    expect(pauseMs).toBeGreaterThanOrEqual(2.0)
  })

  it('handles exclamation and question marks as sentence boundaries', () => {
    const ssml = buildSsml('Is it still here? It is. The same.')
    const breakCount = (ssml.match(/<break/g) ?? []).length
    expect(breakCount).toBe(4) // 1 leading + 2 inter + 1 trailing
  })
})

// ── Suite 3: Ellipsis handling ────────────────────────────────────────────────

describe('buildSsml — ellipsis pacing', () => {
  it('inserts a <break time="1.2s"/> before each ellipsis', () => {
    const ssml = buildSsml('The smell has not changed... something lingers.')
    expect(ssml).toContain('<break time="1.2s"/>...')
  })

  it('preserves the ellipsis punctuation after the break tag', () => {
    const ssml = buildSsml('Something... and then nothing.')
    expect(ssml).toMatch(/<break time="1\.2s"\/>\.\.\./)
  })

  it('does NOT treat ellipsis as a sentence boundary', () => {
    // "Something... and then nothing." is one sentence — 3 breaks total
    // (1 leading + 1 ellipsis + 1 trailing; no inter-sentence break)
    const ssml = buildSsml('Something... and then nothing.')
    const breakCount = (ssml.match(/<break/g) ?? []).length
    expect(breakCount).toBe(3)
  })

  it('handles multiple ellipses in the same text', () => {
    const ssml = buildSsml(
      'The heat... the smell... something that never quite leaves.'
    )
    const count = (ssml.match(/<break time="1\.2s"\/>\.{3}/g) ?? []).length
    expect(count).toBe(2)
  })
})

// ── Suite 4: Edge cases ───────────────────────────────────────────────────────

describe('buildSsml — edge cases', () => {
  it('single sentence — only leading and trailing breaks', () => {
    const ssml = buildSsml('The smell has not changed.')
    const breakCount = (ssml.match(/<break/g) ?? []).length
    expect(breakCount).toBe(2)
  })

  it('returns a valid speak element for empty input', () => {
    const ssml = buildSsml('')
    expect(ssml).toMatch(/^<speak>.*<\/speak>$/)
  })

  it('does not touch em-dashes — left for TTS natural handling', () => {
    const ssml = buildSsml('The heat — the silence — something remains.')
    expect(ssml).toContain('—')
    expect(ssml).not.toMatch(/<break[^>]*>—/)
    expect(ssml).not.toMatch(/—<break[^>]*>/)
  })

  it('leading break is 1.8s on a full Singapore whisper', () => {
    const whisper =
      'The kopitiam has been here since before the MRT. The tiles on the counter — ' +
      'white, cracked at the grout — were laid by someone who is probably gone now. ' +
      'At 7am the uncles come in with the same order they have had for forty years. ' +
      'Nobody writes it down. The kopi arrives anyway... thick, sweet, wrong in a way ' +
      'that feels correct. Outside, the new tower is already casting shade by eight.'
    const ssml = buildSsml(whisper)
    expect(ssml).toMatch(/^<speak><break time="1\.8s"\/>/)
    expect(ssml).toMatch(/<break time="2\.0s"\s*\/><\/speak>$/)
    expect(ssml).toContain('kopitiam')
  })
})

// ── Suite 5: Phoneme overrides ────────────────────────────────────────────────

describe('applyPhonemeOverrides', () => {
  it('wraps a known Singapore place name in <phoneme alphabet="ipa"> tags', () => {
    const result = applyPhonemeOverrides('The walk from Kallang takes twenty minutes.')
    expect(result).toMatch(/<phoneme alphabet="ipa" ph="[^"]+">Kallang<\/phoneme>/)
  })

  it('wraps multi-word place names correctly', () => {
    const result = applyPhonemeOverrides('They met near Tanjong Pagar.')
    expect(result).toMatch(/<phoneme alphabet="ipa" ph="[^"]+">Tanjong Pagar<\/phoneme>/)
  })

  it('leaves unknown words untouched', () => {
    const text = 'The tiles are cracked and familiar.'
    const result = applyPhonemeOverrides(text)
    expect(result).toBe(text)
  })

  it('phoneme override survives through buildSsml and appears in SSML output', () => {
    const ssml = buildSsml('The light at Tiong Bahru falls differently in the morning.')
    expect(ssml).toContain('<phoneme')
    expect(ssml).toContain('Tiong Bahru')
  })

  it('handles multiple place names in the same text', () => {
    const result = applyPhonemeOverrides(
      'From Kallang to Geylang, the old city breathes differently at night.'
    )
    const phoneCount = (result.match(/<phoneme/g) ?? []).length
    expect(phoneCount).toBe(2)
  })
})
