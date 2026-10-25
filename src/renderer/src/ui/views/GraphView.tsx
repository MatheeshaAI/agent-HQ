import { useMemo, useState } from 'react'
import { Network, Search, X } from 'lucide-react'
import type { GraphData } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { usePages } from '../../state/pages'
import { navigation } from '../../state/navigation'
import { roomOfPage, useRoomFocus } from '../../state/rooms'
import { GraphCanvas } from '../graph/GraphCanvas'
import { EmptyState } from '../common/EmptyState'
import { Button } from '../common/Button'
import { ViewFrame } from './ViewFrame'
import { RoomFilter } from './RoomFilter'
import styles from './views.module.css'

export function GraphView(): JSX.Element {
  const { graph: full } = useSnapshot()
  const { bySlug } = usePages()
  const room = useRoomFocus()
  const [query, setQuery] = useState('')

  /** Only the pages of the focused room, with the links between them. */
  const graph = useMemo<GraphData>(() => {
    if (room === 'all') return full
    const kept = new Set(full.nodes.filter((n) => roomOfPage(bySlug.get(n.id)) === room).map((n) => n.id))
    return {
      nodes: full.nodes.filter((n) => kept.has(n.id)),
      edges: full.edges.filter((e) => kept.has(e.source) && kept.has(e.target))
    }
  }, [full, bySlug, room])

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
        full.nodes.length > 0 && (
          <>
            <RoomFilter />
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
          </>
        )
      }
      bare
    >
      {graph.nodes.length === 0 ? (
        <EmptyState
          icon={Network}
          title={full.nodes.length === 0 ? 'The graph is empty' : 'No pages in this room yet'}
          actions={
            full.nodes.length === 0 ? (
              <Button variant="primary" onClick={() => navigation.go('inbox')}>
                Add a source
              </Button>
            ) : undefined
          }
        >
          {full.nodes.length === 0
            ? 'Every wiki page becomes a node and every [[wikilink]] an edge. Add a source and Nova will start wiring concepts together.'
            : 'Pick All above to see every room.'}
        </EmptyState>
      ) : (
        <GraphCanvas graph={graph} onOpenNode={(id) => navigation.openPage(id)} highlight={matches} />
      )}
    </ViewFrame>
  )
}
