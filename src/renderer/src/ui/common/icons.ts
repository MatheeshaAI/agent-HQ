import {
  Activity,
  Bookmark,
  Bot,
  BookOpen,
  Brush,
  Crown,
  CodeXml,
  Cog,
  File,
  FileText,
  FlaskConical,
  Globe,
  Image,
  Library,
  ListChecks,
  Mail,
  MessageCircleQuestion,
  NotebookPen,
  PenLine,
  ScanLine,
  Search,
  Share2,
  StickyNote,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react'
import type { ActivityKind, AgentId, SourceKind } from '@shared/types'

export type TileTone = 'teal' | 'green' | 'indigo' | 'amber' | 'red'

/** The icon each agent wears on its name card in the office, reused everywhere the agent appears. */
export const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  pip: Mail,
  sage: BookOpen,
  rex: CodeXml,
  nova: FlaskConical,
  axel: Search,
  muse: Library,
  chief: Crown,
  scribe: StickyNote,
  triager: ListChecks,
  journal: NotebookPen,
  curator: Bookmark
}

/** Tile tint per agent: Muse writes in indigo, Pip's mail room is amber, the pipeline crew is teal. */
export const AGENT_TONES: Record<AgentId, TileTone> = {
  pip: 'amber',
  sage: 'teal',
  rex: 'teal',
  nova: 'teal',
  axel: 'teal',
  muse: 'indigo',
  chief: 'amber',
  scribe: 'teal',
  triager: 'teal',
  journal: 'amber',
  curator: 'amber'
}

export const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = {
  ingest: ScanLine,
  reader: BookOpen,
  extractor: Cog,
  linker: Share2,
  muse: PenLine,
  janitor: Brush,
  librarian: Library,
  ask: MessageCircleQuestion,
  system: Activity,
  error: TriangleAlert
}

export function activityTone(kind: ActivityKind): TileTone {
  switch (kind) {
    case 'muse':
    case 'ask':
      return 'indigo'
    case 'janitor':
      return 'green'
    case 'error':
      return 'red'
    default:
      return 'teal'
  }
}

export const SOURCE_ICONS: Record<SourceKind, LucideIcon> = {
  pdf: FileText,
  url: Globe,
  text: File,
  markdown: FileText,
  note: StickyNote,
  image: Image,
  other: File
}

/** Icon and tint for any agent, including the Chief and room agents that have no fixed look. */
export function agentIcon(id: AgentId): LucideIcon {
  return AGENT_ICONS[id] ?? Bot
}

export function agentTone(id: AgentId): TileTone {
  return AGENT_TONES[id] ?? 'indigo'
}
