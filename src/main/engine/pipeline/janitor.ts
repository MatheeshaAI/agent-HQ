import type { Contradiction, JanitorReport } from '@shared/types'
import type { KnowledgeBase } from '../knowledgeBase'
import { MISSING_KEY_MESSAGE, type Llm } from '../llm/claude'
import type { AgentJob, EngineState } from '../state'
import { findContradictions } from '../steps/checker'
import { Serial } from '../util/serial'
import { plural } from '../util/text'
import type { PageText } from '../wiki/store'

/** Which pages a contradiction check reads: the whole wiki, or pages just touched plus their neighbours. */
export type CheckScope = { all: true } | { touched: string[] }

/** Axel's work: orphan detection in code, contradiction checks with Claude, and the report. */
export class Janitor {
  /** Checks run one at a time so their results merge in order. */
  private readonly checks = new Serial()

  constructor(
    private readonly state: EngineState,
    private readonly llm: Llm,
    private readonly hasApiKey: () => boolean,
    private readonly now: () => number
  ) {}

  /** Restores the saved report for a knowledge folder and recomputes its orphans. */
  async restore(kb: KnowledgeBase): Promise<void> {
    const saved = await kb.loadJanitor()
    this.state.setJanitor({
      checkedAt: saved?.checkedAt ?? null,
      running: false,
      contradictions: (saved?.contradictions ?? []).filter((c) => c.pages.some((slug) => kb.wiki.has(slug))),
      orphans: kb.wiki.orphans(),
      ...(saved?.note ? { note: saved.note } : {})
    })
  }

  /** Recomputes orphans after the wiki changed; no LLM involved. */
  updateOrphans(kb: KnowledgeBase): void {
    this.state.setJanitor({ ...this.state.getJanitor(), orphans: kb.wiki.orphans() })
  }

  check(kb: KnowledgeBase, scope: CheckScope, job: AgentJob): Promise<JanitorReport> {
    return this.checks.run(() => this.runCheck(kb, scope, job))
  }

  private async runCheck(kb: KnowledgeBase, scope: CheckScope, job: AgentJob): Promise<JanitorReport> {
    this.state.setJanitor({ ...this.state.getJanitor(), running: true })
    try {
      const orphans = kb.wiki.orphans()
      const pages = this.pagesFor(kb, scope)
      const previous = this.state.getJanitor()
      let contradictions = previous.contradictions
      let note: string | undefined

      if (!this.hasApiKey()) {
        note = `${MISSING_KEY_MESSAGE} to check for contradictions`
      } else if (pages.length > 0) {
        job.set('thinking', 'Checking wiki')
        const found = await findContradictions(this.llm, pages)
        contradictions = 'all' in scope ? found : mergeScoped(previous.contradictions, found, pages)
      }

      const report: JanitorReport = { checkedAt: this.now(), running: false, contradictions, orphans }
      if (note) report.note = note
      this.state.setJanitor(report)
      await kb.saveJanitor(report)
      if ('all' in scope) {
        await kb.appendLog(this.now(), 'lint', `${plural(kb.wiki.size, 'page')} checked`, [
          plural(contradictions.length, 'contradiction'),
          plural(orphans.length, 'orphan page'),
          ...(note ? [note] : contradictions.map((c) => `${c.description} (${c.pages.map((slug) => `[[${slug}]]`).join(', ')})`))
        ])
      }
      return report
    } catch (error) {
      this.state.setJanitor({ ...this.state.getJanitor(), running: false })
      throw error
    }
  }

  private pagesFor(kb: KnowledgeBase, scope: CheckScope): PageText[] {
    if ('all' in scope) return kb.wiki.texts()
    const slugs = [...scope.touched, ...kb.wiki.neighbours(scope.touched)]
    return slugs.map((slug) => kb.wiki.text(slug)).filter((page): page is PageText => page !== null)
  }
}

/** Keeps earlier findings about pages outside this check and replaces those about pages inside it. */
function mergeScoped(previous: Contradiction[], found: Contradiction[], checked: PageText[]): Contradiction[] {
  const checkedSlugs = new Set(checked.map((p) => p.slug))
  const kept = previous.filter((c) => !c.pages.every((slug) => checkedSlugs.has(slug)))
  return [...kept, ...found]
}

export function janitorSummary(report: JanitorReport): string {
  const orphans = plural(report.orphans.length, 'orphan page')
  return report.note ? `${orphans} · contradictions not checked` : `${plural(report.contradictions.length, 'contradiction')} · ${orphans}`
}
