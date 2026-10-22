// Dev harness for the 3D office: mounts OfficeScene with sample props at the reference's office size.
// Run (repo root): npx vite --config scripts/office-preview/vite.config.ts, or node scripts/office-preview/shot.mjs for a screenshot.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repo = resolve(__dirname, '../..')

export default defineConfig({
  root: __dirname,
  publicDir: resolve(repo, 'resources'),
  resolve: { alias: { '@shared': resolve(repo, 'src/shared'), '@renderer': resolve(repo, 'src/renderer/src') } },
  server: { port: 5199, strictPort: true, fs: { allow: [repo] } },
  plugins: [react()]
})
