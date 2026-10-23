/** Lets the office's Reset control send everyone back to their desks (the choreography registers itself here). */
let reset: (() => void) | null = null

export const trips = {
  /** Registers the scene's reset; returns the cleanup. */
  connect(handler: () => void): () => void {
    reset = handler
    return () => {
      if (reset === handler) reset = null
    }
  },
  reset(): void {
    reset?.()
  }
}
