// Preview harness for the renderer UI: serves src/renderer with a mocked window.api.
// OFFICE=real uses the real 3D OfficeScene; otherwise a placeholder that shows the reference crop.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repo = resolve(__dirname, '../..')
const useRealOffice = process.env.OFFICE === 'real'

const officePlaceholder = {
  name: 'office-placeholder',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!useRealOffice && importer && source.endsWith('/office/OfficeScene')) {
      return resolve(__dirname, 'OfficePlaceholder.tsx')
    }
    return null
  }
}

export default defineConfig({
  root: __dirname,
  publicDir: resolve(repo, 'resources'),
  resolve: {
    alias: { '@shared': resolve(repo, 'src/shared'), '@renderer': resolve(repo, 'src/renderer/src') }
  },
  plugins: [officePlaceholder, react()],
  server: { port: Number(process.env.PORT || 5291), fs: { allow: [repo] } },
  logLevel: 'warn'
})
