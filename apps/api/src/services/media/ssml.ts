/**
 * SSML builder for CityWhispers narration.
 *
 * This is the primary control surface for how narration feels emotionally.
 * The silence windows are not padding — they're where ambient city sound lives.
 * Do not "optimise" them away without PM sign-off.
 *
 * Architecture note: phoneme overrides run first (before sentence splitting)
 * so SSML phoneme tags don't interfere with boundary detection.
 */

import { applyPhonemeOverrides } from './phonemes'

// Unique byte sequence that cannot appear in whisper text — protects ellipses
// from being treated as sentence boundaries during splitting.
const ELLIPSIS_PLACEHOLDER = '\x01ELP\x01'
const ELLIPSIS_PLACEHOLDER_RE = /\x01ELP\x01/g

// Split on sentence-ending punctuation followed by whitespace.
// The lookbehind keeps terminal punctuation attached to its sentence.
const SENTENCE_BREAK_RE = /(?<=[.!?])\s+/

/**
 * Choose inter-sentence pause duration based on the sentence that just ended.
 *
 * Shorter sentences → longer pauses. The rhythm should feel uneven and human,
 * not metronomic. A one-clause sentence sits in silence longer than a complex
 * one — the thought has more room to linger.
 */
function getInterSentencePause(sentence: string): string {
  // Strip SSML tags before counting words — phoneme tags inflate the count
  const plain = sentence.replace(/<[^>]+>/g, '').trim()
  const words = plain.split(/\s+/).filter(Boolean).length

  if (words <= 5)  return '2.2s'
  if (words <= 8)  return '2.0s'
  if (words <= 12) return '1.6s'
  return '1.2s'
}

/**
 * Convert plain whisper text to SSML with deliberate pacing.
 *
 * Processing order (order matters):
 *   1. Phoneme overrides — wrap Singapore place names before any splitting
 *   2. Protect ellipses — replace `...` with placeholder
 *   3. Split on sentence boundaries
 *   4. Restore ellipses with leading break tags
 *   5. Join sentences with sentence-length-aware inter-sentence pauses
 *   6. Wrap in <speak> with leading arrival pause + trailing cutoff guard
 *
 * Output structure:
 *   <speak>
 *     <break time="1.8s"/>          ← voice arrives, doesn't start
 *     sentence1<break time="Xs"/>   ← pause scales with sentence length
 *     sentence2<break time="Xs"/>
 *     ...
 *     <break time="2.0s"/>          ← silence continues after last word
 *   </speak>
 */
export function buildSsml(text: string): string {
  if (!text.trim()) {
    return '<speak><break time="1.8s"/><break time="2.0s"/></speak>'
  }

  const cleaned = text.trim()

  // Step 1: Apply phoneme overrides before anything else touches the text
  const withPhonemes = applyPhonemeOverrides(cleaned)

  // Step 2: Protect ellipses so they survive sentence splitting
  const withPlaceholder = withPhonemes.replace(/\.\.\./g, ELLIPSIS_PLACEHOLDER)

  // Step 3: Split on true sentence endings (.!?) followed by whitespace.
  // Lookbehind keeps terminal punctuation in the left segment.
  const sentences = withPlaceholder.split(SENTENCE_BREAK_RE)

  // Step 4 & 5: Restore ellipses with break tags; join with variable pauses
  const body = sentences
    .map((sentence, i) => {
      const restored = sentence
        .trim()
        .replace(ELLIPSIS_PLACEHOLDER_RE, `<break time="1.2s"/>...`)

      if (i < sentences.length - 1) {
        const pause = getInterSentencePause(restored)
        return `${restored}<break time="${pause}"/>`
      }
      return restored
    })
    .join('')

  return `<speak><break time="1.8s"/>${body}<break time="2.0s"/></speak>`
}
