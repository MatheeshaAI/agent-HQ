// Inter, served locally (the app's CSP forbids remote fonts), registered for canvas-drawn text.
import interMedium from '@fontsource/inter/files/inter-latin-500-normal.woff2?url'
import interSemiBold from '@fontsource/inter/files/inter-latin-600-normal.woff2?url'
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff2?url'

const FACES: [weight: string, url: string][] = [
  ['500', interMedium],
  ['600', interSemiBold],
  ['700', interBold]
]

let loading: Promise<void> | null = null

/** Resolves once Inter is usable by canvas 2D contexts. Never rejects; canvases fall back to system-ui. */
export function loadInter(): Promise<void> {
  loading ??= Promise.all(
    FACES.map(async ([weight, url]) => {
      const face = new FontFace('Inter', `url(${url})`, { weight })
      document.fonts.add(await face.load())
    })
  ).then(
    () => undefined,
    () => undefined
  )
  return loading
}
