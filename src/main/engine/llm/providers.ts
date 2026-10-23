import { spawn, type ChildProcess, type ChildProcessByStdio, type SpawnOptions, type SpawnOptionsWithStdioTuple, type StdioNull, type StdioPipe } from 'node:child_process'
import { tmpdir } from 'node:os'
import type { Readable, Writable } from 'node:stream'
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { z } from 'zod/v4'
import type { ModelOption, ProviderId } from '@shared/types'
import { createClaude, LlmError, type Llm, type StructuredRequest } from './claude'

export interface ProviderConfig {
  providerId: ProviderId
  apiKey: string | null
  baseUrl: string
  command: string
  args: string
  model: string
}

export interface ProviderAdapter extends Llm {
  listModels(): Promise<ModelOption[]>
}

export type ProviderAdapterFactory = (config: () => ProviderConfig) => ProviderAdapter
const adapterRegistry = new Map<ProviderId, ProviderAdapterFactory>()

/** Register one adapter for a provider ID. Core orchestration only depends on this contract. */
export function registerProviderAdapter(id: ProviderId, factory: ProviderAdapterFactory): void {
  adapterRegistry.set(id, factory)
}

/** Central provider switch: core steps use the same Zod-backed structured call for every adapter. */
export function createProvider(config: () => ProviderConfig): Llm {
  const instances = new Map<ProviderId, ProviderAdapter>()
  return {
    structured<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.infer<S>> {
      const id = config().providerId
      const factory = adapterRegistry.get(id)
      if (!factory) throw new LlmError(`No adapter is registered for ${id}`)
      let adapter = instances.get(id)
      if (!adapter) { adapter = factory(config); instances.set(id, adapter) }
      return adapter.structured(request)
    }
  }
}

export async function listProviderModels(config: ProviderConfig): Promise<ModelOption[]> {
  const factory = adapterRegistry.get(config.providerId)
  if (!factory) throw new LlmError(`No adapter is registered for ${config.providerId}`)
  return factory(() => config).listModels()
}

async function openAiCompatible<S extends z.ZodType>(config: ProviderConfig, system: string, prompt: string, schema: S, content: BetaContentBlockParam[] = []): Promise<string> {
  if (!config.apiKey) throw new LlmError(`Add an API key for ${config.providerId === 'openai' ? 'OpenAI' : 'OpenRouter'} in Settings`)
  const root = (config.baseUrl || (config.providerId === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1')).replace(/\/$/, '')
  // Newer OpenAI models reject max_tokens and require max_completion_tokens; OpenRouter and
  // custom base URLs speak the OpenAI-compatible max_tokens.
  const official = config.providerId === 'openai' && (!config.baseUrl || /api\.openai\.com/.test(config.baseUrl))
  const tokenParam = official ? 'max_completion_tokens' : 'max_tokens'
  const baseBody: Record<string, unknown> = {
    model: config.model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: openAiContent(prompt, content) }],
    response_format: { type: 'json_schema', json_schema: { name: 'agent_hq_result', strict: true, schema: z.toJSONSchema(schema) } }
  }
  const post = (body: unknown): Promise<Response> => fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  let response = await post({ ...baseBody, [tokenParam]: 16_000 })
  let payload = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } }
  if (!response.ok && response.status === 400) {
    const message = payload.error?.message ?? ''
    // Retrying once with the fixes the error calls for: a weaker response format, and/or the
    // other token parameter name.
    const fix: Record<string, unknown> = {}
    if (/json_schema|response_format/i.test(message)) fix.response_format = { type: 'json_object' }
    if (/max_tokens|max_completion_tokens/.test(message)) fix[tokenParam === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'] = 16_000
    if (Object.keys(fix).length > 0) {
      response = await post({ ...baseBody, ...fix })
      payload = await response.json().catch(() => ({})) as typeof payload
    }
  }
  if (!response.ok) throw new LlmError(payload.error?.message || `Provider request failed (${response.status})`)
  const text = payload.choices?.[0]?.message?.content
  if (!text) throw new LlmError('The provider returned an empty answer')
  return text
}

async function claudeCode(config: ProviderConfig, system: string, prompt: string): Promise<string> {
  if (!/^[A-Za-z0-9._:\/-]+$/.test(config.model)) throw new LlmError('Invalid model ID')
  // The prompt can be hundreds of KB (whole source documents), so it goes to stdin: Windows
  // limits a command line to about 32 KB.
  const args = ['-p', '--output-format', 'json', '--model', config.model, '--permission-mode', 'plan']
  const output = await runProcess(config.command || 'claude', args, tmpdir(), `${system}\n\n${prompt}`)
  try {
    const response = JSON.parse(output) as { result?: string }
    return response.result ?? output
  } catch {
    return output
  }
}

async function acp(config: ProviderConfig, system: string, prompt: string, content: BetaContentBlockParam[] = []): Promise<string> {
  const command = config.command.trim()
  if (!command) throw new LlmError('Enter the executable for an ACP-compatible agent in Settings')
  const args = parseArgs(config.args)
  const child = spawnProgram(command, args, { cwd: tmpdir(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  let buffer = ''
  let output = ''
  let nextId = 1
  const waiters = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
  child.on('error', (error) => waiters.forEach((waiter) => waiter.reject(new LlmError(`Could not start ACP agent ${command}: ${error.message}`))))
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    for (;;) {
      const end = buffer.indexOf('\n')
      if (end < 0) break
      const line = buffer.slice(0, end).trim()
      buffer = buffer.slice(end + 1)
      if (!line) continue
      try {
        const message = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string }; method?: string; params?: { update?: { sessionUpdate?: string; content?: { text?: string } } } }
        if (message.method === 'session/update' && message.params?.update?.sessionUpdate === 'agent_message_chunk') output += message.params.update.content?.text ?? ''
        if (typeof message.id === 'number') {
          const waiter = waiters.get(message.id)
          if (waiter) {
            waiters.delete(message.id)
            message.error ? waiter.reject(new Error(message.error.message || 'ACP request failed')) : waiter.resolve(message.result)
          }
        }
      } catch { /* Ignore non-JSON diagnostics on stdout; protocol errors time out with context. */ }
    }
  })
  let stderr = ''
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4000) })
  const send = (method: string, params: unknown): Promise<unknown> => new Promise((resolve, reject) => {
    const id = nextId++
    waiters.set(id, { resolve, reject })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    setTimeout(() => {
      const waiter = waiters.get(id)
      if (waiter) { waiters.delete(id); reject(new Error(`ACP ${method} timed out`)) }
    }, 180_000).unref()
  })
  try {
    await send('initialize', { protocolVersion: 1, clientInfo: { name: 'Agent HQ', version: '0.1.0' }, clientCapabilities: {} })
    const created = await send('session/new', { cwd: tmpdir(), mcpServers: [] }) as { sessionId?: string; configOptions?: Array<{ id: string; currentValue?: string; options?: Array<{ value: string; name?: string }> }> }
    if (!created?.sessionId) throw new Error('ACP agent did not return a session ID')
    if (config.model) {
      const modelOption = created.configOptions?.find((option) => /model/i.test(option.id))
      if (modelOption?.options?.some((option) => option.value === config.model)) {
        await send('session/set_config_option', { sessionId: created.sessionId, configId: modelOption.id, value: config.model })
      } else {
        try { await send('session/set_model', { sessionId: created.sessionId, modelId: config.model }) }
        catch { throw new Error(`This ACP agent does not expose model selection for "${config.model}"`) }
      }
    }
    await send('session/prompt', { sessionId: created.sessionId, prompt: acpContent(`${config.model ? `Use model ${config.model}.\n\n` : ''}${system}\n\n${prompt}`, content) })
    return output
  } catch (error) {
    throw new LlmError(`${error instanceof Error ? error.message : String(error)}${stderr ? `: ${stderr.trim()}` : ''}`)
  } finally {
    child.kill()
  }
}

async function listAcpModels(config: ProviderConfig): Promise<ModelOption[]> {
  if (!config.command.trim()) return []
  const child = spawnProgram(config.command.trim(), parseArgs(config.args), { cwd: tmpdir(), windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
  let buffer = ''
  let nextId = 1
  const waiters = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
  child.on('error', (error) => waiters.forEach((waiter) => waiter.reject(new Error(`Could not start ACP agent ${config.command}: ${error.message}`))))
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    buffer += chunk
    for (;;) {
      const end = buffer.indexOf('\n')
      if (end < 0) break
      const line = buffer.slice(0, end).trim()
      buffer = buffer.slice(end + 1)
      if (!line) continue
      try {
        const message = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string } }
        if (typeof message.id !== 'number') continue
        const waiter = waiters.get(message.id)
        if (!waiter) continue
        waiters.delete(message.id)
        message.error ? waiter.reject(new Error(message.error.message || 'ACP request failed')) : waiter.resolve(message.result)
      } catch { /* Ignore agent diagnostics. */ }
    }
  })
  const send = (method: string, params: unknown): Promise<unknown> => new Promise((resolve, reject) => {
    const id = nextId++
    waiters.set(id, { resolve, reject })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    setTimeout(() => { const waiter = waiters.get(id); if (waiter) { waiters.delete(id); reject(new Error(`ACP ${method} timed out`)) } }, 20_000).unref()
  })
  try {
    await send('initialize', { protocolVersion: 1, clientInfo: { name: 'Agent HQ', version: '0.1.0' }, clientCapabilities: {} })
    const created = await send('session/new', { cwd: tmpdir(), mcpServers: [] }) as { configOptions?: Array<{ id: string; name?: string; currentValue?: string; options?: Array<{ value: string; name?: string }> }> }
    const modelOption = created.configOptions?.find((option) => /model/i.test(option.id))
    return (modelOption?.options ?? []).map((option) => ({ id: option.value, name: option.name || option.value }))
  } finally { child.kill() }
}

function makePrompt<S extends z.ZodType>(request: StructuredRequest<S>): string {
  const content = request.content.map(blockText).filter(Boolean).join('\n')
  return `${content}\n\nReturn only valid JSON matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(request.schema))}`
}

function blockText(block: BetaContentBlockParam): string {
  if ('text' in block && typeof block.text === 'string') return block.text
  return ''
}

function openAiContent(prompt: string, blocks: BetaContentBlockParam[]): Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
  const result: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [{ type: 'text', text: prompt }]
  for (const block of blocks) {
    if (block.type === 'document') throw new LlmError('OpenAI-compatible routing does not accept PDF document blocks yet')
    if (block.type !== 'image') continue
    if (block.source.type === 'base64') {
      result.push({ type: 'image_url', image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` } })
    } else if (block.source.type === 'url') {
      result.push({ type: 'image_url', image_url: { url: block.source.url } })
    }
  }
  return result
}

function acpContent(prompt: string, blocks: BetaContentBlockParam[]): Array<Record<string, string>> {
  const result: Array<Record<string, string>> = [{ type: 'text', text: prompt }]
  for (const block of blocks) {
    if (block.type === 'document') throw new LlmError('ACP routing does not accept PDF document blocks; use an ACP agent with its own PDF ingestion support')
    if (block.type !== 'image') continue
    if (block.source.type !== 'base64') throw new LlmError('This ACP adapter only accepts embedded image data')
    result.push({ type: 'image', data: block.source.data, mimeType: block.source.media_type })
  }
  return result
}

function parseResult<S extends z.ZodType>(text: string, schema: S): z.infer<S> {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new LlmError('The provider did not return JSON')
  try { return schema.parse(JSON.parse(text.slice(start, end + 1))) }
  catch { throw new LlmError('The provider returned an answer in an unexpected format') }
}

function parseArgs(value: string): string[] {
  if (!value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.every((part) => typeof part === 'string')) return parsed
  } catch { /* Accept a simple whitespace-separated argument list as a convenience. */ }
  return value.match(/"[^"]*"|'[^']*'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, '')) ?? []
}

/**
 * Spawns a program that may be a .cmd/.bat shim: Node's spawn cannot start those
 * directly on Windows, so the work goes through cmd.exe with a carefully quoted
 * command line instead.
 */
export function spawnProgram(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioPipe>): ChildProcessByStdio<Writable, Readable, Readable>
export function spawnProgram(command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioNull>): ChildProcessByStdio<Writable, Readable, null>
export function spawnProgram(command: string, args: readonly string[], options?: SpawnOptions): ChildProcess
export function spawnProgram(command: string, args: readonly string[], options: SpawnOptions = {}): ChildProcess {
  if (process.platform !== 'win32' || /\.(exe|com)$/i.test(command)) return spawn(command, args, options)
  const tokens = [command, ...args]
  if (tokens.some((token) => /["%^&|<>\r\n]/.test(token))) throw new LlmError('Unsupported character in command or argument')
  // With /d /s /c and verbatim arguments, cmd strips the outer quotes of the last token
  // again, so `""claude" "--version""` becomes the command `"claude" "--version"` and cmd
  // itself resolves shim resolution via PATH and PATHEXT.
  const commandLine = tokens.map((token) => `"${token}"`).join(' ')
  return spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${commandLine}"`], { ...options, windowsVerbatimArguments: true })
}

function runProcess(command: string, args: string[], cwd: string, input = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawnProgram(command, args, { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4000) })
    // A child that exits before reading everything can trip EPIPE on our write; that must not crash.
    child.stdin.on('error', () => {})
    if (input) child.stdin.write(`${input}`, () => child.stdin.end())
    else child.stdin.end()
    const timer = setTimeout(() => child.kill(), 180_000)
    child.on('error', (error) => { clearTimeout(timer); reject(new LlmError(`Could not start ${command}: ${error.message}`)) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) reject(new LlmError(stderr.trim() || `${command} exited with status ${code}`))
      else resolve(stdout)
    })
  })
}

registerProviderAdapter('anthropic', (config) => {
  const client = createClaude(() => ({ apiKey: config().apiKey, model: config().model }))
  return { ...client, listModels: () => listAnthropicModels(config()) }
})
registerProviderAdapter('claude-code', (config) => ({
  async structured<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.infer<S>> {
    const current = config()
    if (request.content.some((block) => block.type !== 'text')) throw new LlmError('Claude Code CLI routing currently accepts text content only; use an API or ACP provider for images and PDFs')
    return parseResult(await claudeCode(current, request.system, makePrompt(request)), request.schema)
  },
  async listModels() {
    return [
      { id: 'sonnet', name: 'Sonnet (Claude Code alias)' },
      { id: 'opus', name: 'Opus (Claude Code alias)' },
      { id: 'haiku', name: 'Haiku (Claude Code alias)' }
    ]
  }
}))
registerProviderAdapter('openai', (config) => textAdapter(config, openAiCompatible, listOpenAiModels))
registerProviderAdapter('openrouter', (config) => textAdapter(config, openAiCompatible, listOpenAiModels))
for (const id of ['codex', 'opencode', 'antigravity', 'kilocode', 'acp'] as const) {
  registerProviderAdapter(id, (config) => textAdapter(config, acp, listAcpModels))
}

function textAdapter(config: () => ProviderConfig, complete: typeof openAiCompatible | typeof acp, list: typeof listOpenAiModels | typeof listAcpModels): ProviderAdapter {
  return {
    async structured<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.infer<S>> {
      const current = config()
      const text = complete === acp
        ? await acp(current, request.system, makePrompt(request), request.content)
        : await openAiCompatible(current, request.system, makePrompt(request), request.schema, request.content)
      return parseResult(text, request.schema)
    },
    listModels: () => list(config())
  }
}

async function listAnthropicModels(config: ProviderConfig): Promise<ModelOption[]> {
  if (!config.apiKey) throw new LlmError('Add an Anthropic API key in Settings first')
  const response = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
    headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }
  })
  const body = await response.json().catch(() => ({})) as { data?: Array<{ id: string; display_name?: string }>; error?: { message?: string } }
  if (!response.ok) throw new LlmError(body.error?.message || `Model listing failed (${response.status})`)
  return (body.data ?? []).map((item) => ({ id: item.id, name: item.display_name || item.id }))
}

async function listOpenAiModels(config: ProviderConfig): Promise<ModelOption[]> {
  if (!config.apiKey) throw new LlmError(`Add an API key for ${config.providerId === 'openai' ? 'OpenAI' : 'OpenRouter'} first`)
  const defaultRoot = config.providerId === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1'
  const root = (config.baseUrl || defaultRoot).replace(/\/$/, '')
  const response = await fetch(`${root}/models`, { headers: { Authorization: `Bearer ${config.apiKey}` } })
  if (!response.ok) throw new LlmError(`Model listing failed (${response.status}): ${await response.text()}`)
  const body = await response.json() as { data?: Array<{ id?: string; name?: string }> }
  return (body.data ?? []).filter((item) => item.id).map((item) => ({ id: item.id!, name: item.name || item.id! }))
}
