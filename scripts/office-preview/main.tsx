import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { AgentStatus, GraphData } from '@shared/types'
import OfficeScene from '@renderer/office/OfficeScene'
import wikiGraph from './wiki-graph.json'

// Sample props for the harness only; the shipped app passes the engine's live snapshot.
const now = Date.now()
const agents: AgentStatus[] = [
  { id: 'pip', name: 'Pip', role: 'Mail Clerk', state: 'idle', activity: 'Waiting for mail', updatedAt: now },
  { id: 'sage', name: 'Sage', role: 'Reader', state: 'working', activity: 'Summarizing docs', updatedAt: now },
  { id: 'rex', name: 'Rex', role: 'Extractor', state: 'working', activity: 'Processing data', updatedAt: now },
  { id: 'nova', name: 'Nova', role: 'Linker', state: 'thinking', activity: 'Building graph', updatedAt: now },
  { id: 'axel', name: 'Axel', role: 'Janitor', state: 'working', activity: '2 contradictions', updatedAt: now },
  { id: 'muse', name: 'Muse', role: 'Librarian', state: 'working', activity: 'Reading wiki', updatedAt: now }
]

function sampleGraph(count: number): GraphData {
  let seed = 7
  const rand = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
  if (count === 0) return { nodes: [], edges: [] }
  const nodes = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, title: `Page ${i}`, degree: 0, sources: 1 }))
  const edges: GraphData['edges'] = []
  for (let i = 1; i < count; i++) {
    edges.push({ source: `n${i}`, target: `n${Math.floor(rand() * i)}` })
    if (rand() < 0.5) edges.push({ source: `n${i}`, target: `n${Math.floor(rand() * count)}` })
  }
  for (const e of edges) {
    nodes[Number(e.source.slice(1))].degree++
    nodes[Number(e.target.slice(1))].degree++
  }
  return { nodes, edges }
}

// ?nodes=N renders a random N-page graph (0: the empty-wiki state); ?graph=wiki uses the 19-page graph of a
// real sample wiki (wiki-graph.json); ?states=error,idle,... overrides the agents' states in order.
const params = new URLSearchParams(location.search)
const graph: GraphData = params.get('graph') === 'wiki' ? wikiGraph : sampleGraph(Number(params.get('nodes') ?? 40))
params
  .get('states')
  ?.split(',')
  .forEach((state, i) => {
    if (!agents[i]) return
    agents[i].state = state as AgentStatus['state']
    // A long error line, like a failed fetch, to check that the card ellipsizes it.
    if (state === 'error') agents[i].activity = 'Could not fetch karpathy.github.io/llm-wiki: getaddrinfo ENOTFOUND'
  })

// Count WebGL draw calls per frame (all passes: shadows, reflection, AO, bloom) for the screenshot script.
let drawCalls = 0
for (const ctx of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
  for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
    const original = (ctx as unknown as Record<string, (...a: unknown[]) => void>)[fn]
    if (!original) continue
    ;(ctx as unknown as Record<string, unknown>)[fn] = function (this: unknown, ...args: unknown[]) {
      drawCalls++
      return original.apply(this, args)
    }
  }
}
const frame = (): void => {
  ;(window as unknown as { __stats?: object }).__stats = { drawCallsPerFrame: drawCalls }
  drawCalls = 0
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

function Harness(): JSX.Element {
  const [log, setLog] = useState<string[]>([])
  const push = (s: string): void => setLog((l) => [...l.slice(-4), s])
  return (
    <>
      <OfficeScene
        agents={agents}
        graph={graph}
        onOpenGraph={() => push('openGraph')}
        onAgentClick={(id) => push(`agent:${id}`)}
      />
      <div id="harness-log" style={{ position: 'fixed', left: 0, top: 810, color: '#888', font: '12px monospace' }}>
        {log.join(' | ')}
      </div>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Harness />)
