import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { BetaContentBlockParam, BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { z } from 'zod/v4'

export const MISSING_KEY_MESSAGE = 'Add your Claude API key in Settings'

const MAX_TOKENS = 16_000
/** `fallbacks: 'default'` re-runs a declined request on Anthropic's recommended fallback model. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
/** The header the SDK's own `messages.parse()` sends for structured outputs. */
const STRUCTURED_OUTPUTS_BETA = 'structured-outputs-2025-12-15'

/** A failure worth showing to a person as-is. */
export class LlmError extends Error {
  override name = 'LlmError'
}

export interface StructuredRequest<S extends z.ZodType> {
  system: string
  content: BetaContentBlockParam[]
  schema: S
}

/** The one thing the engine needs from a model: structured JSON for a prompt. */
export interface Llm {
  structured<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.infer<S>>
}

export interface ClaudeConfig {
  apiKey: string | null
  model: string
}

/**
 * Claude through the official SDK. The config is read on every call so a key or model saved
 * in Settings applies to the next request. ANTHROPIC_BASE_URL is honoured by the SDK itself.
 */
export function createClaude(config: () => ClaudeConfig): Llm {
  let cached: { apiKey: string; client: Anthropic } | null = null

  const clientFor = (apiKey: string): Anthropic => {
    if (cached?.apiKey !== apiKey) cached = { apiKey, client: new Anthropic({ apiKey, maxRetries: 2 }) }
    return cached.client
  }

  return {
    async structured<S extends z.ZodType>({ system, content, schema }: StructuredRequest<S>): Promise<z.infer<S>> {
      const { apiKey, model } = config()
      if (!apiKey) throw new LlmError(MISSING_KEY_MESSAGE)
      const format = betaZodOutputFormat(schema)

      let message: BetaMessage
      try {
        // create() rather than parse(): parse() would try to read every text block as JSON, including
        // the partial text of a model that declined before the fallback took over, and it throws before
        // stop_reason can be checked. The output is parsed below with the same Zod-backed format.
        message = await clientFor(apiKey).beta.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          betas: [FALLBACK_BETA, STRUCTURED_OUTPUTS_BETA],
          fallbacks: 'default',
          output_config: { effort: 'medium', format },
          system,
          messages: [{ role: 'user', content }]
        })
      } catch (error) {
        throw readableApiError(error, model)
      }

      checkStopReason(message)
      const text = finalText(message)
      if (!text.trim()) throw new LlmError('Claude returned an empty answer')
      try {
        return format.parse(text)
      } catch {
        throw new LlmError('Claude returned an answer in an unexpected format')
      }
    }
  }
}

function checkStopReason(message: BetaMessage): void {
  switch (message.stop_reason) {
    case 'refusal': {
      const category = message.stop_details?.category
      throw new LlmError(`Claude declined this request${category ? ` (${category.replace(/_/g, ' ')})` : ''}`)
    }
    case 'max_tokens':
      throw new LlmError('Claude ran out of room before finishing its answer')
    case 'model_context_window_exceeded':
      throw new LlmError('The source is too long for the model to read in one go')
    default:
  }
}

/** Text of the model that answered: everything after the last fallback hand-over, if any. */
function finalText(message: BetaMessage): string {
  const lastFallback = message.content.map((block) => block.type).lastIndexOf('fallback')
  return message.content
    .slice(lastFallback + 1)
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
}

function readableApiError(error: unknown, model: string): LlmError {
  if (error instanceof LlmError) return error
  if (error instanceof Anthropic.AuthenticationError) return new LlmError('Your Claude API key was rejected')
  if (error instanceof Anthropic.PermissionDeniedError) return new LlmError(`Your Claude API key cannot use ${model}`)
  if (error instanceof Anthropic.NotFoundError) return new LlmError(`The model "${model}" was not found`)
  if (error instanceof Anthropic.RateLimitError) return new LlmError('Claude API rate limit reached; try again in a minute')
  if (error instanceof Anthropic.BadRequestError) return new LlmError(`Claude API rejected the request: ${apiDetail(error)}`)
  if (error instanceof Anthropic.InternalServerError) return new LlmError(`Claude API is unavailable right now (${error.status}); try again shortly`)
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new LlmError('Claude API timed out')
  if (error instanceof Anthropic.APIConnectionError) return new LlmError('Could not reach the Claude API; check your internet connection')
  if (error instanceof Anthropic.APIError) return new LlmError(`Claude API error ${error.status ?? ''}: ${apiDetail(error)}`.replace('  ', ' '))
  return new LlmError(error instanceof Error ? error.message : String(error))
}

function apiDetail(error: InstanceType<typeof Anthropic.APIError>): string {
  const body = error.error as { error?: { message?: unknown } } | undefined
  const message = body?.error?.message
  return typeof message === 'string' && message ? message : error.message
}
