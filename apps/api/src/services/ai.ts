/**
 * AI provider interface + implementations (Anthropic, Gemini).
 *
 * Provider selection (in priority order):
 *   1. Explicit: AI_PROVIDER env var — 'gemini' | 'anthropic'
 *   2. Auto: uses whichever API key is present (Gemini checked first)
 *
 * Test injection: call setAIProvider() before the first getAIProvider() call.
 */

import { AIProviderError } from '../lib/errors'

// ── Interface ──────────────────────────────────────────────────────────────

export interface AIProvider {
  /** Human-readable name for logging / DB modelUsed field */
  readonly name: string

  /**
   * Generate text from a system + user prompt.
   * Returns raw text, trimmed of leading/trailing whitespace.
   */
  generate(systemPrompt: string, userPrompt: string): Promise<string>

  /**
   * Score text against a rubric.
   * Returns a number in [0, 100].
   */
  score(text: string, rubric: string): Promise<number>
}

// ── Gemini implementation ──────────────────────────────────────────────────

const GEMINI_GENERATION_MODEL = 'gemini-2.5-flash'
const GEMINI_SCORING_MODEL = 'gemini-2.5-flash'

class GeminiProvider implements AIProvider {
  readonly name = GEMINI_GENERATION_MODEL
  private genAI: import('@google/generative-ai').GoogleGenerativeAI

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
    if (!apiKey) throw new AIProviderError('GEMINI_API_KEY or GOOGLE_API_KEY is not configured')
    // Lazy import so the module is only loaded when Gemini is selected
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_GENERATION_MODEL,
        systemInstruction: systemPrompt,
      })
      const result = await model.generateContent(userPrompt)
      const text = result.response.text().trim()
      if (!text) throw new AIProviderError('Gemini returned empty text')
      return text
    } catch (err) {
      if (err instanceof AIProviderError) throw err
      throw new AIProviderError(`Gemini generation failed: ${(err as Error).message}`)
    }
  }

  async score(text: string, rubric: string): Promise<number> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: GEMINI_SCORING_MODEL,
        systemInstruction: rubric,
      })
      const result = await model.generateContent(`Score this whisper:\n\n${text}`)
      const raw = result.response.text().trim()
      const match = raw.match(/\d+(\.\d+)?/)
      if (!match) throw new AIProviderError(`Gemini scoring returned no number. Raw: "${raw}"`)
      return Math.min(100, Math.max(0, parseFloat(match[0])))
    } catch (err) {
      if (err instanceof AIProviderError) throw err
      throw new AIProviderError(`Gemini scoring failed: ${(err as Error).message}`)
    }
  }
}

// ── Anthropic implementation ───────────────────────────────────────────────

const ANTHROPIC_GENERATION_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_SCORING_MODEL = 'claude-haiku-4-5-20251001'

class AnthropicProvider implements AIProvider {
  readonly name = ANTHROPIC_GENERATION_MODEL
  private client: import('@anthropic-ai/sdk').default

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new AIProviderError('ANTHROPIC_API_KEY is not configured')
    const Anthropic = require('@anthropic-ai/sdk')
    this.client = new Anthropic({ apiKey })
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: ANTHROPIC_GENERATION_MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
      const block = response.content[0]
      if (!block || block.type !== 'text') throw new AIProviderError('Anthropic returned no text')
      return block.text.trim()
    } catch (err) {
      if (err instanceof AIProviderError) throw err
      throw new AIProviderError(`AI generation failed: ${(err as Error).message}`)
    }
  }

  async score(text: string, rubric: string): Promise<number> {
    try {
      const response = await this.client.messages.create({
        model: ANTHROPIC_SCORING_MODEL,
        max_tokens: 64,
        system: rubric,
        messages: [{ role: 'user', content: `Score this whisper:\n\n${text}` }],
      })
      const block = response.content[0]
      if (!block || block.type !== 'text') throw new AIProviderError('Anthropic scoring returned no text')
      const match = block.text.match(/\d+(\.\d+)?/)
      if (!match) throw new AIProviderError(`Anthropic scoring returned no number. Raw: "${block.text}"`)
      return Math.min(100, Math.max(0, parseFloat(match[0])))
    } catch (err) {
      if (err instanceof AIProviderError) throw err
      throw new AIProviderError(`AI scoring failed: ${(err as Error).message}`)
    }
  }
}

// ── Singleton + injection ──────────────────────────────────────────────────

let _provider: AIProvider | null = null

function createProvider(): AIProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase()
  if (explicit === 'anthropic') return new AnthropicProvider()
  if (explicit === 'gemini') return new GeminiProvider()

  // Auto-select: prefer Gemini (free tier), fallback to Anthropic
  if (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY) return new GeminiProvider()
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider()

  throw new AIProviderError(
    'No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env',
  )
}

/** Returns the active AI provider singleton. Created on first call. */
export function getAIProvider(): AIProvider {
  if (!_provider) _provider = createProvider()
  return _provider
}

/** Replace the provider singleton — for test injection only. */
export function setAIProvider(provider: AIProvider): void {
  _provider = provider
}

/** Reset so the next getAIProvider() creates a fresh instance. */
export function resetAIProvider(): void {
  _provider = null
}
