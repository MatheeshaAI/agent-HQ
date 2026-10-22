import { useEffect, useRef, useState } from 'react'
import { Check, FileUp, TriangleAlert } from 'lucide-react'
import styles from './DropOverlay.module.css'

type Toast = { kind: 'ok' | 'error'; message: string } | null

const TOAST_MS = 3500

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/** Whole-window file drop target: highlights while files are dragged over the app and ingests them on drop. */
export function DropOverlay(): JSX.Element | null {
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const depth = useRef(0)

  useEffect(() => {
    const onEnter = (event: DragEvent): void => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth.current++
      setDragging(true)
    }
    const onOver = (event: DragEvent): void => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (event: DragEvent): void => {
      if (!carriesFiles(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent): void => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      const paths = Array.from(event.dataTransfer?.files ?? [])
        .map((file) => window.api.pathForFile(file))
        .filter(Boolean)
      if (paths.length === 0) return
      window.api
        .addFiles(paths)
        .then((added) =>
          setToast({ kind: 'ok', message: `${added.length} file${added.length === 1 ? '' : 's'} added to the inbox` })
        )
        .catch((error: unknown) =>
          setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Those files could not be added' })
        )
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <>
      {dragging && (
        <div className={styles.overlay}>
          <div className={styles.target}>
            <span className={styles.icon}>
              <FileUp size={30} strokeWidth={1.7} />
            </span>
            <div className={styles.title}>Drop to start a job</div>
            <div className={styles.text}>Pip will file it in raw/ and the agents will turn it into wiki pages.</div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`${styles.toast} ${toast.kind === 'error' ? styles.toastError : ''}`} role="status">
          {toast.kind === 'ok' ? <Check size={15} strokeWidth={2.4} /> : <TriangleAlert size={15} />}
          {toast.message}
        </div>
      )}
    </>
  )
}
