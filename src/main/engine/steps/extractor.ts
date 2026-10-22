import { z } from 'zod/v4'
import type { Llm } from '../llm/claude'
import type { SourceParts } from '../sources/content'
import { cleanTags, section, text, uniqueBy } from './common'
import type { SourceSummary } from './reader'

const ExtractorOutput = z.object({
  concepts: z
    .array(z.object({ name: z.string(), description: z.string() }))
    .describe('Key concepts: people, organisations, projects, ideas, methods or terms'),
  claims: z
    .array(z.object({ text: z.string(), concept: z.string() }))
    .describe('Concrete factual claims, each tied to one concept name'),
  tags: z.array(z.string()).describe('Short lowercase topic tags')
})
export type Extraction = z.infer<typeof ExtractorOutput>

const SYSTEM = `You are Rex, the Extractor of a personal knowledge base: a wiki of markdown pages that AI agents maintain from collected sources.
From the source you are given, extract what the wiki should know.
- concepts: 3 to 12 key concepts (people, organisations, projects, ideas, methods, terms) that deserve a wiki page or a section of one. Use the canonical name, and give a one or two sentence description grounded in the source.
- claims: concrete, checkable statements the source makes (facts, numbers, dates, definitions, conclusions), each tied to the name of one concept above.
- tags: 2 to 6 short lowercase topic tags for the source.
Use only what the source says.`

/** Extracts concepts, claims and tags; long sources are read part by part and the results merged. */
export async function extractConcepts(llm: Llm, parts: SourceParts, name: string, summary: SourceSummary): Promise<Extraction> {
  const results: Extraction[] = []
  for (const [i, part] of parts.entries()) {
    const which = parts.length > 1 ? `part ${i + 1} of ${parts.length} of ` : ''
    results.push(
      await llm.structured({
        system: SYSTEM,
        schema: ExtractorOutput,
        content: [...part, text(section('source_summary', summary), `Extract the key concepts and claims from ${which}${name}.`)]
      })
    )
  }
  return {
    concepts: uniqueBy(results.flatMap((r) => r.concepts), (c) => c.name),
    claims: uniqueBy(results.flatMap((r) => r.claims), (c) => c.text),
    tags: cleanTags(results.flatMap((r) => r.tags))
  }
}
