#!/usr/bin/env node
// A local stand-in for the Claude Messages API, for offline tests and screenshot runs:
//
//   node scripts/fake-claude.mjs            (PORT env, default 4519; DELAY_MS env slows answers down
//                                            so the agents can be watched at work, default 0)
//   ANTHROPIC_BASE_URL=http://127.0.0.1:4519 ANTHROPIC_API_KEY=test npm run dev
//
// It answers the structured-output requests Agent HQ makes. The pipeline step is recognised from
// the requested JSON schema, and the answer is derived deterministically from the input text
// (capitalised phrases become concepts, sentences become key points and claims, and so on).
// It checks the request shape the real API enforces for claude-opus-5-5 (no thinking budget,
// no temperature, the fallback beta header with `fallbacks`).
//
// Test controls:
//   POST /__fake/script   {"status": 401}, {"refusal": "cyber"} or {"fallback": true} (the model declines mid-answer
//                         and a fallback model finishes it); applies to the next request (add "count" for more)
//   GET  /__fake/requests  the requests seen so far (step, model, betas, headers of interest)
//   POST /__fake/reset     clears the script and the request log
//   An API key starting with "invalid" is always rejected with 401.

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT) || 4519
const DELAY_MS = Number(process.env.DELAY_MS) || 0
const script = []
let requests = []
let counter = 0

const STOP_WORDS = new Set(
  'A An And As At But By For From He How I If In Into It Its Of On Or Our She So That The Their Then There These They This Those To We What When Where Which While Who Why With You Your Yes No Not Each Every Some Many Most More Also However Here Part Source Fetched Summarise Extract Plan Write Update Check'.split(
    ' '
  )
)

const server = createServer(async (req, res) => {
  const started = Date.now()
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    if (req.method === 'POST' && url.pathname === '/__fake/script') {
      const body = JSON.parse((await readBody(req)) || '{}')
      for (let i = 0; i < (body.count ?? 1); i++) script.push(body)
      return send(res, 200, { ok: true, queued: script.length })
    }
    if (req.method === 'GET' && url.pathname === '/__fake/requests') return send(res, 200, requests)
    if (req.method === 'POST' && url.pathname === '/__fake/reset') {
      script.length = 0
      requests = []
      return send(res, 200, { ok: true })
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/messages') {
      return send(res, 404, apiError('not_found_error', `No route for ${req.method} ${url.pathname}`))
    }

    const body = JSON.parse(await readBody(req))
    const step = detectStep(body)
    const betas = String(req.headers['anthropic-beta'] ?? '').split(',').filter(Boolean)
    requests.push({ step, model: body.model, betas, fallbacks: body.fallbacks, effort: body.output_config?.effort, apiKey: maskKey(apiKeyOf(req)) })

    const { status, payload } = respond(req, body, step, betas)
    if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS))
    send(res, status, payload)
    console.log(`[fake-claude] POST /v1/messages step=${step} model=${body.model} -> ${status} (${Date.now() - started}ms)`)
  } catch (error) {
    send(res, 500, apiError('api_error', String(error?.stack ?? error)))
    console.log(`[fake-claude] error: ${error?.message ?? error}`)
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`[fake-claude] listening on http://127.0.0.1:${PORT}`))

function respond(req, body, step, betas) {
  const key = apiKeyOf(req)
  if (!key) return { status: 401, payload: apiError('authentication_error', 'x-api-key or authorization header is required') }
  if (key.startsWith('invalid')) return { status: 401, payload: apiError('authentication_error', 'invalid x-api-key') }
  if (!req.headers['anthropic-version']) return { status: 400, payload: apiError('invalid_request_error', 'anthropic-version header is required') }

  const shapeError = validateShape(body, betas)
  if (shapeError) return { status: 400, payload: apiError('invalid_request_error', shapeError) }

  const scripted = script.shift()
  if (scripted?.status) {
    const type = { 401: 'authentication_error', 403: 'permission_error', 404: 'not_found_error', 429: 'rate_limit_error', 529: 'overloaded_error' }[scripted.status] ?? 'api_error'
    return { status: scripted.status, payload: apiError(type, scripted.message ?? `scripted ${scripted.status}`) }
  }
  if (scripted?.refusal) {
    return { status: 200, payload: message(body, '', 'refusal', { type: 'refusal', category: scripted.refusal, explanation: 'Scripted refusal' }) }
  }

  const input = readInput(body)
  const output = STEPS[step]?.(input)
  if (!output) return { status: 400, payload: apiError('invalid_request_error', `fake-claude does not know the step for this schema`) }
  const reply = message(body, JSON.stringify(output), 'end_turn', null)
  if (scripted?.fallback) {
    const partial = JSON.stringify(output).slice(0, 12)
    reply.content = [
      { type: 'text', text: partial },
      { type: 'fallback', from: { model: body.model }, to: { model: 'claude-opus-4-8' }, trigger: { type: 'refusal', category: 'cyber' } },
      ...reply.content
    ]
    reply.model = 'claude-opus-4-8'
  }
  return { status: 200, payload: reply }
}

function validateShape(body, betas) {
  if (typeof body.model !== 'string' || !body.model) return 'model: field required'
  if (typeof body.max_tokens !== 'number') return 'max_tokens: field required'
  if (!Array.isArray(body.messages) || body.messages.length === 0) return 'messages: at least one message is required'
  if (body.temperature !== undefined || body.top_p !== undefined || body.top_k !== undefined) return 'temperature/top_p/top_k are not supported for this model'
  if (body.thinking && body.thinking.type !== 'adaptive') return `thinking.type "${body.thinking.type}" is not supported for this model`
  if (body.fallbacks !== undefined && !betas.includes('server-side-fallback-2026-07-01')) return 'fallbacks requires the server-side-fallback-2026-07-01 beta'
  const format = body.output_config?.format
  if (!format || format.type !== 'json_schema' || typeof format.schema !== 'object') return 'output_config.format must be a json_schema format'
  return null
}

function detectStep(body) {
  const keys = Object.keys(body.output_config?.format?.schema?.properties ?? {}).sort().join(',')
  return (
    {
      'keyPoints,summary,title': 'reader',
      'claims,concepts,tags': 'extractor',
      pages: 'linker',
      'markdown,summary,tags': 'writer',
      contradictions: 'checker',
      'answer,citations': 'answer'
    }[keys] ?? 'unknown'
  )
}

function message(body, text, stopReason, stopDetails) {
  counter++
  return {
    id: `msg_fake_${String(counter).padStart(6, '0')}`,
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: text ? [{ type: 'text', text }] : [],
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: stopDetails,
    usage: { input_tokens: Math.ceil(JSON.stringify(body.messages).length / 4), output_tokens: Math.ceil(text.length / 4) }
  }
}

function apiError(type, msg) {
  return { type: 'error', error: { type, message: msg } }
}

// ---------------------------------------------------------------------------------------------
// Reading the request

/** Collects the source text (text blocks, <source> sections, PDF text) and the JSON sections. */
function readInput(body) {
  const sections = {}
  const sourceTexts = []
  let instruction = ''
  for (const msg of body.messages) {
    const blocks = typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : msg.content
    for (const block of blocks) {
      if (block.type === 'document' && block.source?.media_type === 'application/pdf') {
        sourceTexts.push({ name: block.title ?? 'document.pdf', text: pdfText(block.source.data) })
      } else if (block.type === 'image') {
        sourceTexts.push({ name: 'image', text: 'An image added to the knowledge base. It shows a Diagram of the Agent Office.' })
      } else if (block.type === 'text') {
        for (const match of block.text.matchAll(/<source name=("[^"]*")[^>]*>\n([\s\S]*?)\n<\/source>/g)) {
          sourceTexts.push({ name: JSON.parse(match[1]), text: match[2] })
        }
        for (const match of block.text.matchAll(/<([a-z_]+)>\n([\s\S]*?)\n<\/\1>/g)) {
          if (match[1] === 'source' && !match[2].trim().startsWith('{')) continue
          sections[match[1]] = parseSection(match[2])
        }
        instruction += `${block.text.replace(/<([a-z_]+)>\n[\s\S]*?\n<\/\1>/g, '').trim()}\n`
      }
    }
  }
  return { sections, sourceTexts, instruction: instruction.trim(), system: String(body.system ?? '') }
}

function parseSection(text) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Text shown by Tj/TJ operators in uncompressed PDF content streams; enough for test PDFs. */
function pdfText(base64) {
  const raw = Buffer.from(base64, 'base64').toString('latin1')
  const lines = []
  for (const match of raw.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[((?:\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ/g)) {
    const strings = [...match[0].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((m) => unescapePdf(m[1]))
    lines.push(strings.join(''))
  }
  return lines.join('\n')
}

function unescapePdf(s) {
  return s.replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' })[c] ?? c)
}

// ---------------------------------------------------------------------------------------------
// Deterministic "model" answers

const STEPS = {
  reader(input) {
    const merged = input.sections.part_summaries
    if (Array.isArray(merged)) {
      return {
        title: merged[0]?.title ?? 'Untitled source',
        summary: merged.map((p) => p.summary).join(' '),
        keyPoints: merged.flatMap((p) => p.keyPoints).slice(0, 10)
      }
    }
    const source = input.sourceTexts[0] ?? { name: 'source', text: '' }
    const text = stripMarkdownHeader(source.text)
    const all = sentences(text)
    const heading = /^#\s+(.+)$/m.exec(source.text)?.[1]?.trim()
    return {
      title: heading || titleFrom(all[0] ?? source.name),
      summary: all.slice(0, 2).join(' ') || `The source ${source.name}.`,
      keyPoints: all.slice(0, 6)
    }
  },

  extractor(input) {
    const text = input.sourceTexts.map((s) => stripMarkdownHeader(s.text)).join('\n\n')
    const all = sentences(text)
    const concepts = capitalisedPhrases(text)
      .slice(0, 5)
      .map((name) => ({ name, description: all.find((s) => s.includes(name)) ?? `${name} is mentioned in the source.` }))
    const claims = concepts.flatMap((c) => all.filter((s) => s.includes(c.name)).slice(0, 2).map((text) => ({ text, concept: c.name })))
    const tags = [...new Set(concepts.flatMap((c) => c.name.toLowerCase().split(/\s+/)).filter((w) => w.length > 3))].slice(0, 4)
    return { concepts, claims, tags: tags.length > 0 ? tags : ['notes'] }
  },

  linker(input) {
    const existing = Array.isArray(input.sections.existing_pages) ? input.sections.existing_pages : []
    const source = input.sections.source ?? {}
    const concepts = Array.isArray(input.sections.concepts) ? input.sections.concepts : []
    const titles = [source.title ?? source.name ?? 'Source', ...concepts.slice(0, 4).map((c) => c.name)]
    const unique = [...new Map(titles.map((t) => [t.toLowerCase(), t])).values()]
    return {
      pages: unique.map((title, i) => {
        const match = existing.find((p) => p.title.toLowerCase() === title.toLowerCase())
        return {
          title: match?.title ?? title,
          action: match ? 'update' : 'create',
          reason: i === 0 ? 'Summarises the source.' : `A key concept of ${unique[0]}.`,
          links: unique.filter((t) => t !== title)
        }
      })
    }
  },

  writer(input) {
    const page = input.sections.page ?? {}
    const source = input.sections.source ?? {}
    const concepts = Array.isArray(input.sections.concepts) ? input.sections.concepts : []
    const claims = Array.isArray(input.sections.claims) ? input.sections.claims : []
    const current = typeof input.sections.current_page === 'string' ? input.sections.current_page : null
    const concept = concepts.find((c) => c.name.toLowerCase() === String(page.title).toLowerCase())
    const overview = concept?.description ?? source.summary ?? ''
    const points = (claims.length > 0 ? claims.map((c) => c.text) : (source.keyPoints ?? [])).slice(0, 5)
    const links = (page.links ?? []).map((t) => `- [[${t}]]`)

    const previousSources = current ? [...current.matchAll(/^## Sources\n([\s\S]*?)(?=\n## |\s*$)/gm)].flatMap((m) => m[1].split('\n').filter((l) => l.startsWith('- '))) : []
    const sourcesList = [...new Set([...previousSources, `- ${source.name}`])]
    const body = current
      ? [
          current.replace(/^#\s+.*\n+/, '').replace(/\n## Sources\n[\s\S]*$/, '').trim(),
          `## From ${source.title ?? source.name}`,
          points.map((p) => `- ${p}`).join('\n') || '- No new facts.',
          `See also: ${(page.links ?? []).map((t) => `[[${t}]]`).join(', ') || 'nothing yet'}.`,
          '## Sources',
          sourcesList.join('\n')
        ]
      : [
          overview,
          '## Key points',
          points.map((p) => `- ${p}`).join('\n') || '- Nothing specific yet.',
          ...(links.length > 0 ? ['## Related', links.join('\n')] : []),
          '## Sources',
          sourcesList.join('\n')
        ]
    const tags = [...new Set([...(input.sections.current_tags ?? []), ...String(page.title).toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 2), 'wiki'])]
    return { markdown: body.join('\n\n'), summary: firstSentence(overview) || `About ${page.title}.`, tags }
  },

  checker(input) {
    const pages = Array.isArray(input.sections.pages) ? input.sections.pages : []
    const byClaim = new Map()
    for (const page of pages) {
      for (const sentence of sentences(page.markdown)) {
        const years = sentence.match(/\b(1[5-9]\d\d|20\d\d)\b/g)
        if (!years) continue
        const key = sentence.toLowerCase().replace(/\b(1[5-9]\d\d|20\d\d)\b/g, '#').replace(/[^a-z#]+/g, ' ').trim()
        const list = byClaim.get(key) ?? []
        list.push({ slug: page.slug, sentence, years: years.join(',') })
        byClaim.set(key, list)
      }
    }
    const contradictions = []
    for (const list of byClaim.values()) {
      const distinct = [...new Map(list.map((e) => [e.years, e])).values()]
      if (distinct.length < 2) continue
      contradictions.push({
        pages: [...new Set(distinct.map((e) => e.slug))],
        description: `The pages disagree: "${distinct[0].sentence}" versus "${distinct[1].sentence}"`
      })
    }
    return { contradictions }
  },

  answer(input) {
    const pages = Array.isArray(input.sections.pages) ? input.sections.pages : []
    const question = String(input.sections.question ?? '')
    const terms = words(question)
    const scored = pages
      .flatMap((page) => sentences(page.markdown).map((s) => ({ page, s, score: words(s).filter((w) => terms.includes(w)).length })))
      .filter((x) => x.score > 0 && !x.s.startsWith('#'))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
    if (scored.length === 0) return { answer: 'The wiki does not cover this yet.', citations: [] }
    const answer = scored.map((x) => `${x.s.replace(/^[-*]\s+/, '')} ([[${x.page.title}]])`).join('\n\n')
    return { answer, citations: [...new Set(scored.map((x) => x.page.slug))] }
  }
}

function stripMarkdownHeader(text) {
  return text.replace(/^# .*\n+(Source: .*\nFetched: .*\n+---\n+)?/, '')
}

function sentences(text) {
  return text
    .replace(/^#+\s.*$/gm, '')
    .replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-*]\s+/, '').trim())
    .filter((s) => s.length > 20 && /[a-z]/.test(s))
}

function firstSentence(text) {
  return sentences(text)[0] ?? ''
}

function titleFrom(sentence) {
  return sentence.split(/\s+/).slice(0, 6).join(' ').replace(/[.,;:]+$/, '')
}

function words(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 3)
}

/** Capitalised phrases (proper nouns and named ideas), most frequent first. */
function capitalisedPhrases(text) {
  const counts = new Map()
  const order = []
  const re = /\b[A-Z][A-Za-z0-9]+(?:[ -](?:of |the |and |for )?[A-Z][A-Za-z0-9]+)*/g
  for (const match of text.matchAll(re)) {
    const words = match[0].split(/\s+/)
    while (words.length > 0 && STOP_WORDS.has(words[0])) words.shift()
    const phrase = words.join(' ')
    if (phrase.length < 3 || STOP_WORDS.has(phrase)) continue
    if (!counts.has(phrase)) order.push(phrase)
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
  }
  return [...order].sort((a, b) => counts.get(b) - counts.get(a) || b.split(' ').length - a.split(' ').length || order.indexOf(a) - order.indexOf(b))
}

// ---------------------------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json', 'request-id': `req_fake_${Date.now()}` })
  res.end(JSON.stringify(payload))
}

/** SDK 1.x sends the key as a bearer token; older clients use x-api-key. */
function apiKeyOf(req) {
  const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization ?? ''))?.[1]
  return String(req.headers['x-api-key'] ?? bearer ?? '')
}

function maskKey(key) {
  return key ? `${String(key).slice(0, 4)}…` : null
}
