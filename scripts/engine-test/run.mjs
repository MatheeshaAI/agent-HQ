#!/usr/bin/env node
// Runs the engine tests in plain Node against scripts/fake-claude.mjs:
//   node scripts/engine-test/run.mjs
// The TypeScript tests are bundled with esbuild (the engine core has no Electron imports),
// the fake API is started on a free port, and node:test reports the results.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const workDir = mkdtempSync(join(tmpdir(), 'agent-hq-engine-test-'))
const bundle = join(workDir, 'engine.test.cjs')

await build({
  entryPoints: [join(here, 'engine.test.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: 'inline',
  alias: { '@shared': join(root, 'src/shared') },
  logLevel: 'warning'
})

const port = await freePort()
const fake = spawn(process.execPath, [join(root, 'scripts/fake-claude.mjs')], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'inherit']
})
const fakeLog = []
await new Promise((resolveReady, reject) => {
  fake.once('exit', (code) => reject(new Error(`fake-claude exited with ${code}`)))
  fake.stdout.on('data', (chunk) => {
    fakeLog.push(chunk.toString())
    if (chunk.toString().includes('listening')) resolveReady()
  })
})

const env = { ...process.env, ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, ENGINE_TEST_DIR: workDir }
delete env.ANTHROPIC_API_KEY
delete env.ANTHROPIC_AUTH_TOKEN
const tests = spawn(process.execPath, ['--enable-source-maps', '--test-reporter=spec', '--test', bundle], { env, stdio: 'inherit' })
const code = await new Promise((done) => tests.once('exit', done))

fake.kill()
const requestLines = fakeLog.join('').split('\n').filter((line) => line.includes('POST /v1/messages'))
console.log(`\nfake-claude served ${requestLines.length} requests; last few:\n${requestLines.slice(-5).join('\n')}`)
if (!process.env.KEEP_TEST_DIR) rmSync(workDir, { recursive: true, force: true })
else console.log(`test files kept in ${workDir}`)
process.exit(code ?? 1)

function freePort() {
  return new Promise((done, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => done(port))
    })
  })
}
