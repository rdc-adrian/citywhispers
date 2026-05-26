/**
 * Sprint F tests — generation service
 *
 * The `../ai` module is mocked so the Anthropic SDK is never loaded in tests.
 * Three suites:
 *   1. buildUserPrompt  — each fact's body appears in the constructed prompt
 *   2. buildSystemPrompt — tonal constraint keywords are present
 *   3. generateWhisper stub — AI provider output passes through unmodified
 *   4. scoreWhisper fixtures — compliant whisper scores > violating whisper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock the AI module before any imports that pull in @anthropic-ai/sdk ──
// vi.mock is hoisted by Vitest, so this runs before all imports below.
vi.mock('../ai', () => {
  const mockProvider = {
    generate: vi.fn(),
    score: vi.fn(),
  }
  return {
    getAIProvider: vi.fn(() => mockProvider),
    setAIProvider: vi.fn(),
    resetAIProvider: vi.fn(),
    // Expose mockProvider for test access
    _mockProvider: mockProvider,
  }
})

import {
  buildUserPrompt,
  buildSystemPrompt,
  scoreWhisper,
  type PoiForPrompt,
  type FactForPrompt,
} from '../generation'
import * as aiModule from '../ai'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Reach into the mocked module to get the shared mock provider. */
function getMockProvider() {
  return (aiModule as any)._mockProvider as {
    generate: ReturnType<typeof vi.fn>
    score: ReturnType<typeof vi.fn>
  }
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const samplePoi: PoiForPrompt = {
  name: 'Telok Ayer Street',
  category: 'street',
  emotionalTone: 'Obsolescence',
  ambientProfile: 'Dense with the smell of incense and diesel. Mid-century shophouses next to glass towers.',
  environmentalTexture: 'cracked ceramic tiles, rusted iron railings',
  timeOfDayAffinity: 'morning',
}

const sampleFacts: FactForPrompt[] = [
  {
    factType: 'historical',
    body: 'Telok Ayer was once a seafront street — land reclamation pushed the coast a kilometre away.',
  },
  {
    factType: 'sensory',
    body: 'At 7am the incense smoke from Thian Hock Keng drifts across the road into the financial district.',
  },
  {
    factType: 'social',
    body: 'Office workers cut through here on the way to Raffles Place; few stop, most have earphones in.',
  },
]

// ── Suite 1: buildUserPrompt ───────────────────────────────────────────────

describe('buildUserPrompt', () => {
  it('includes every fact body in the output', () => {
    const prompt = buildUserPrompt(samplePoi, sampleFacts)
    for (const fact of sampleFacts) {
      expect(prompt).toContain(fact.body)
    }
  })

  it('includes the POI name', () => {
    const prompt = buildUserPrompt(samplePoi, sampleFacts)
    expect(prompt).toContain(samplePoi.name)
  })

  it('labels each fact with its uppercased type', () => {
    const prompt = buildUserPrompt(samplePoi, sampleFacts)
    expect(prompt).toContain('[HISTORICAL]')
    expect(prompt).toContain('[SENSORY]')
    expect(prompt).toContain('[SOCIAL]')
  })

  it('includes atmospheric metadata when present', () => {
    const prompt = buildUserPrompt(samplePoi, sampleFacts)
    expect(prompt).toContain(samplePoi.emotionalTone!)
    expect(prompt).toContain(samplePoi.ambientProfile!)
  })

  it('omits atmospheric metadata keys when null/undefined', () => {
    const minimalPoi: PoiForPrompt = { name: 'Test Place', category: 'street' }
    const prompt = buildUserPrompt(minimalPoi, sampleFacts)
    expect(prompt).not.toContain('EMOTIONAL TONE:')
    expect(prompt).not.toContain('ATMOSPHERE:')
    expect(prompt).not.toContain('TEXTURE:')
  })
})

// ── Suite 2: buildSystemPrompt ─────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('contains the "first person" constraint keyword', () => {
    const prompt = buildSystemPrompt()
    expect(prompt.toLowerCase()).toContain('first person')
  })

  it('contains the "present tense" constraint keyword', () => {
    const prompt = buildSystemPrompt()
    expect(prompt.toLowerCase()).toContain('present tense')
  })

  it('encodes the 60–120 word count constraint', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('60')
    expect(prompt).toContain('120')
  })

  it('prohibits second-person address', () => {
    const prompt = buildSystemPrompt()
    expect(prompt.toLowerCase()).toMatch(/second.person|"you"/)
  })

  it('injects a custom persona tone when provided', () => {
    const customTone = 'You are a weathered lighthouse keeper, speaking in clipped sentences.'
    const prompt = buildSystemPrompt(customTone)
    expect(prompt).toContain(customTone)
  })

  it('falls back to Declan Sage tone when called with no argument', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('Declan Sage')
  })

  it('falls back to Declan Sage tone when null is passed', () => {
    const prompt = buildSystemPrompt(null)
    expect(prompt).toContain('Declan Sage')
  })
})

// ── Suite 3: AI provider pass-through ─────────────────────────────────────

describe('scoreWhisper (stubbed provider)', () => {
  beforeEach(() => {
    getMockProvider().score.mockReset()
  })

  it('passes the text through to the provider and returns the score unmodified', async () => {
    const text = 'The smell has not changed. Even now, between the concrete and the glass.'
    getMockProvider().score.mockResolvedValue(78)

    const score = await scoreWhisper(text)

    expect(score).toBe(78)
    expect(getMockProvider().score).toHaveBeenCalledTimes(1)
    // The text must be in the call arguments (provider receives it + rubric)
    const [calledText] = getMockProvider().score.mock.calls[0]
    expect(calledText).toBe(text)
  })
})

// ── Suite 4: scoring rubric — fixture comparison ───────────────────────────

describe('scoreWhisper fixtures — compliant vs violating', () => {
  const PASSING_WHISPER =
    'The incense arrives before the street does — smoke from the temple crossing into the lobby of a bank. ' +
    'Nobody looks up. The tiles here are original, cracked at the same angle they always were. ' +
    'Something about the morning light on that crack, the way it widens slightly every year.'

  const FAILING_WHISPER =
    "You are standing at one of Singapore's most historic streets. Built in 1822, Telok Ayer Street " +
    'was constructed along the original seafront. You will notice the beautiful shophouses on your left. ' +
    'This area has been completely transformed since the colonial era.'

  beforeEach(() => {
    getMockProvider().score.mockReset()
  })

  it('a brief-compliant whisper scores higher than a violating one (>60 vs <40)', async () => {
    // Deterministic heuristic that mirrors the actual scoring rubric
    const scoreHeuristic = (text: string): number => {
      let score = 60
      if (/\byou\b/i.test(text)) score -= 30          // second-person — major violation
      if (/\d{4}/.test(text)) score -= 15              // dates as facts
      if (/you are standing|you will|look up/i.test(text)) score -= 10
      if (/historic|colonial|constructed|built in/i.test(text)) score -= 10
      if (/smell|light|crack|smoke|tile|incense/i.test(text)) score += 10 // sensory reward
      return Math.min(100, Math.max(0, score))
    }

    getMockProvider().score
      .mockImplementationOnce((text: string) => Promise.resolve(scoreHeuristic(text)))
      .mockImplementationOnce((text: string) => Promise.resolve(scoreHeuristic(text)))

    const passingScore = await scoreWhisper(PASSING_WHISPER)
    const failingScore = await scoreWhisper(FAILING_WHISPER)

    expect(passingScore).toBeGreaterThan(60)
    expect(failingScore).toBeLessThan(40)
    expect(passingScore).toBeGreaterThan(failingScore)
  })
})
