import {
  Activity,
  BookOpen,
  Brush,
  CodeXml,
  Cog,
  File,
  FileText,
  FlaskConical,
  Globe,
  Image,
  Library,
  Mail,
  MessageCircleQuestion,
  PenLine,
  ScanLine,
  Search,
  Share2,
  StickyNote,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react'
import type { ActivityKind, AgentId, SourceKind } from '@shared/types'

export type TileTone = 'teal' | 'green' | 'indigo' | 'amber' | 'red' | 'slate'

/** The icon each agent wears on its name card in the office, reused everywhere the agent appears. */
export const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  pip: Mail,
  sage: BookOpen,
  rex: CodeXml,
  nova: FlaskConical,
  axel: Search,
  muse: Library
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
