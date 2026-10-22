import { Fragment, useMemo, type ReactNode } from 'react'
import { parseMarkdown, type Block, type Inline } from './parse'
import styles from './Markdown.module.css'

interface MarkdownProps {
  source: string
  /** Called with the raw target of a clicked [[wikilink]] */
  onWikiLink: (target: string) => void
  /** Whether a wikilink target exists; unresolved links are drawn muted */
  hasPage?: (target: string) => boolean
  className?: string
}

const SAFE_HREF = /^(https?:|mailto:)/i

export function Markdown({ source, onWikiLink, hasPage, className }: MarkdownProps): JSX.Element {
  const blocks = useMemo(() => parseMarkdown(source), [source])
  const context: RenderContext = { onWikiLink, hasPage }
  return <div className={`${styles.markdown} ${className ?? ''}`}>{renderBlocks(blocks, context)}</div>
}

interface RenderContext {
  onWikiLink: (target: string) => void
  hasPage?: (target: string) => boolean
}

function renderBlocks(blocks: Block[], ctx: RenderContext): ReactNode[] {
  return blocks.map((block, index) => renderBlock(block, index, ctx))
}

function renderBlock(block: Block, key: number, ctx: RenderContext): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1'
      return <Tag key={key}>{renderInlines(block.children, ctx)}</Tag>
    }
    case 'paragraph':
      return <p key={key}>{renderInlines(block.children, ctx)}</p>
    case 'code':
      return (
        <pre key={key} data-lang={block.lang || undefined}>
          <code>{block.value}</code>
        </pre>
      )
    case 'quote':
      return <blockquote key={key}>{renderBlocks(block.children, ctx)}</blockquote>
    case 'rule':
      return <hr key={key} />
    case 'list': {
      const items = block.items.map((item, i) => <li key={i}>{renderListItem(item, ctx)}</li>)
      return block.ordered ? (
        <ol key={key} start={block.start}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      )
    }
    case 'table':
      return (
        <div key={key} className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {block.head.map((cell, c) => (
                  <th key={c} style={{ textAlign: block.align[c] ?? undefined }}>
                    {renderInlines(cell, ctx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} style={{ textAlign: block.align[c] ?? undefined }}>
                      {renderInlines(cell, ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

/** Tight list items render their single paragraph inline instead of wrapping it in <p>. */
function renderListItem(blocks: Block[], ctx: RenderContext): ReactNode {
  const [first, ...rest] = blocks
  if (first?.type !== 'paragraph') return renderBlocks(blocks, ctx)
  return (
    <>
      {renderInlines(first.children, ctx)}
      {rest.map((block, i) => renderBlock(block, i + 1, ctx))}
    </>
  )
}

function renderInlines(nodes: Inline[], ctx: RenderContext): ReactNode[] {
  return nodes.map((node, index) => renderInline(node, index, ctx))
}

function renderInline(node: Inline, key: number, ctx: RenderContext): ReactNode {
  switch (node.type) {
    case 'text':
      return <Fragment key={key}>{node.value}</Fragment>
    case 'code':
      return <code key={key}>{node.value}</code>
    case 'strong':
      return <strong key={key}>{renderInlines(node.children, ctx)}</strong>
    case 'em':
      return <em key={key}>{renderInlines(node.children, ctx)}</em>
    case 'del':
      return <del key={key}>{renderInlines(node.children, ctx)}</del>
    case 'break':
      return <br key={key} />
    case 'link':
      return SAFE_HREF.test(node.href) ? (
        <a key={key} href={node.href} target="_blank" rel="noreferrer noopener" title={node.href}>
          {renderInlines(node.children, ctx)}
        </a>
      ) : (
        <Fragment key={key}>{renderInlines(node.children, ctx)}</Fragment>
      )
    case 'wikilink': {
      const exists = ctx.hasPage ? ctx.hasPage(node.target) : true
      return (
        <button
          key={key}
          type="button"
          className={`${styles.wikilink} ${exists ? '' : styles.wikilinkMissing}`}
          onClick={() => ctx.onWikiLink(node.target)}
          title={exists ? `Open ${node.target}` : `${node.target} has no page yet`}
        >
          {node.label}
        </button>
      )
    }
  }
}
