import { z } from 'zod/v4'
import type { Llm } from '../llm/claude'
import type { SourceParts } from '../sources/content'
import { section, text } from './common'

const ReaderOutput = z.object({
  title: z.string().describe('A concise, specific title for the source'),
  summary: z.string().describe('Two to four sentences on what the source says'),
  keyPoints: z.array(z.string()).describe('The most important facts, arguments or findings, one sentence each')
})
export type SourceSummary = z.infer<typeof ReaderOutput>

const SYSTEM = `You are Sage, the Reader of a personal knowledge base: a wiki of markdown pages that AI agents maintain from the sources a person collects.
Read the source you are given and summarise it faithfully, using only what the source itself says.
- title: a concise, specific title for the source (use the file name only when nothing better exists)
- summary: two to four sentences on what the source says and why it matters
- keyPoints: the 3 to 10 most important facts, arguments or findings, each a self-contained sentence`

const MERGE_SYSTEM = `You are Sage, the Reader of a personal knowledge base. A long source was read in parts.
Merge the part summaries you are given into one summary of the whole source.
- title: a concise, specific title for the whole source
- summary: two to four sentences covering the whole source
- keyPoints: the 3 to 12 most important points across all parts, each a self-contained sentence`

/** Summarises a source; long sources are summarised part by part and then merged. */
export async function summariseSource(llm: Llm, parts: SourceParts, name: string): Promise<SourceSummary> {
  if (parts.length === 1) {
    return llm.structured({ system: SYSTEM, schema: ReaderOutput, content: [...parts[0], text(`Summarise this source: ${name}`)] })
  }
  const partials: SourceSummary[] = []
  for (const [i, part] of parts.entries()) {
    partials.push(
      await llm.structured({
        system: SYSTEM,
        schema: ReaderOutput,
        content: [...part, text(`This is part ${i + 1} of ${parts.length} of ${name}. Summarise this part.`)]
      })
    )
  }
  return llm.structured({
    system: MERGE_SYSTEM,
    schema: ReaderOutput,
    content: [text(section('part_summaries', partials), `Merge these ${parts.length} part summaries of ${name}.`)]
  })
}
