import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** How many fixed-height rows fit in an element; follows its size as the window resizes. */
export function useFitCount<T extends HTMLElement>(rowHeight: number): [RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [count, setCount] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = (): void => setCount(Math.max(0, Math.floor(element.clientHeight / rowHeight)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [rowHeight])

  return [ref, count]
}
