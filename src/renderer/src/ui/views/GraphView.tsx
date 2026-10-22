import { useMemo, useState } from 'react'
import { Network, Search, X } from 'lucide-react'
import { useSnapshot } from '../../state/snapshot'
import { navigation } from '../../state/navigation'
import { GraphCanvas } from '../graph/GraphCanvas'
import { EmptyState } from '../common/EmptyState'
import { Button } from '../common/Button'
import { ViewFrame } from './ViewFrame'
import styles from './views.module.css'

export function GraphView(): JSX.Element {
  const { graph } = useSnapshot()
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return undefined
    return new Set(graph.nodes.filter((n) => n.title.toLowerCase().includes(q) || n.id.includes(q)).map((n) => n.id))
  }, [graph, query])

  return (
    <ViewFrame
      title="Graph"
      subtitle={`${graph.nodes.length} pages · ${graph.edges.length} links`}
      actions={
        graph.nodes.length > 0 && (
          <label className={styles.search} style={{ width: 260 }}>
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Highlight pages…" spellCheck={false} />
            {matches && <span className={styles.searchCount}>{matches.size}</span>}
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear">
                <X size={14} />
              </button>
            )}
          </label>
        )
      }
      bare
    >
      {graph.nodes.length === 0 ? (
        <EmptyState
          icon={Network}
          title="The graph is empty"
          actions={
            <Button variant="primary" onClick={() => navigation.go('inbox')}>
              Add a source
            </Button>
          }
        >
          Every wiki page becomes a node and every [[wikilink]] an edge. Add a source and Nova will start wiring concepts together.
        </EmptyState>
      ) : (
        <GraphCanvas graph={graph} onOpenNode={(id) => navigation.openPage(id)} highlight={matches} />
      )}
    </ViewFrame>
  )
}
