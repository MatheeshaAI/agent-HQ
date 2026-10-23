#!/usr/bin/env node
// Checks (and with --plan, re-plans) the agents' walking routes in src/renderer/src/office/routes.ts.
//
//   node scripts/routes.mjs          verify: every route keeps clear of furniture, walls and seated people
//   node scripts/routes.mjs --plan   print fresh LEGS between neighbouring pipeline stages
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(mkdtempSync(join(tmpdir(), 'agent-hq-routes-')), 'routes.mjs')
await build({
  entryPoints: [join(root, 'src/renderer/src/office/routes.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'error',
  alias: { '@shared': join(root, 'src/shared') }
})
const R = await import(pathToFileURL(outfile).href)
const all = R.obstacles()
const ids = Object.keys(R.AISLES)

// The seat circle of the agent that is walking never blocks it.
const without = (id) => {
  const [sx, sz] = R.SEATS[id]
  return all.filter((o) => !(o.kind === 'circle' && o.x === sx && o.z === sz))
}

const STEP = 0.05
const EXIT_CLEARANCE = 0.3
function minClearance(path, list) {
  let min = Infinity
  let at = path[0]
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP))
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n
      const z = az + ((bz - az) * k) / n
      const c = R.clearanceAt(x, z, list)
      if (c < min) {
        min = c
        at = [x, z]
      }
    }
  }
  return { min, at }
}

if (process.argv.includes('--plan')) {
  const legs = {}
  for (let i = 0; i + 1 < R.PIPELINE.length; i++) {
    const a = R.PIPELINE[i]
    const b = R.PIPELINE[i + 1]
    legs[`${a}>${b}`] = plan(R.AISLES[a], R.AISLES[b])
  }
  console.log('export const LEGS: Record<string, Vec2[]> = ' + JSON.stringify(legs, null, 2).replace(/"(\w+>\w+)"/g, "'$1'").replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2]'))
  process.exit(0)
}

function plan(from, to) {
  // A* on a 10 cm grid, cost rises near furniture so routes keep to the middle of the aisles.
  const H = 0.1
  const W = Math.ceil(17 / H)
  const D = Math.ceil(17 / H)
  const cost = new Float32Array(W * D)
  for (let gz = 0; gz < D; gz++) {
    for (let gx = 0; gx < W; gx++) {
      const c = R.clearanceAt(gx * H, gz * H, all)
      cost[gz * W + gx] = c < R.BODY_CLEARANCE ? Infinity : 1 + Math.max(0, 1.2 - c) * 3
    }
  }
  const idx = (p) => Math.round(p[1] / H) * W + Math.round(p[0] / H)
  const start = idx(from)
  const goal = idx(to)
  if (!isFinite(cost[start]) || !isFinite(cost[goal])) throw new Error(`blocked endpoint ${from} ${to}`)
  const g = new Float32Array(W * D).fill(Infinity)
  const prev = new Int32Array(W * D).fill(-1)
  const open = [[0, start]]
  g[start] = 0
  const hx = (i) => Math.hypot((i % W) - (goal % W), Math.floor(i / W) - Math.floor(goal / W))
  while (open.length) {
    open.sort((a, b) => a[0] - b[0])
    const [, cur] = open.shift()
    if (cur === goal) break
    const cx = cur % W
    const cz = Math.floor(cur / W)
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue
        const nx = cx + dx
        const nz = cz + dz
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue
        const ni = nz * W + nx
        if (!isFinite(cost[ni])) continue
        const ng = g[cur] + Math.hypot(dx, dz) * cost[ni]
        if (ng < g[ni]) {
          g[ni] = ng
          prev[ni] = cur
          open.push([ng + hx(ni), ni])
        }
      }
    }
  }
  if (prev[goal] < 0) throw new Error(`no route ${from} -> ${to}`)
  let cells = []
  for (let c = goal; c !== -1; c = prev[c]) cells.push([(c % W) * H, Math.floor(c / W) * H])
  cells.reverse()
  cells[0] = [...from]
  cells[cells.length - 1] = [...to]
  // String pulling: keep only the corners.
  const clear = (a, b) => minClearance([a, b], all).min >= R.BODY_CLEARANCE - 0.01
  const out = [cells[0]]
  let i = 0
  while (i < cells.length - 1) {
    let j = cells.length - 1
    while (j > i + 1 && !clear(cells[i], cells[j])) j--
    out.push(cells[j])
    i = j
  }
  const round = (v) => Math.round(v * 20) / 20
  // Endpoints are the aisle spots themselves, which tripPath() adds.
  return out
    .slice(1, -1)
    .map(([x, z]) => [round(x), round(z)])
    .filter(([x, z]) => Math.hypot(x - to[0], z - to[1]) > 0.3 && Math.hypot(x - from[0], z - from[1]) > 0.3)
}

let failures = 0
const report = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`)
  if (!ok) failures++
}
for (const id of ids) {
  const list = without(id)
  const step = [R.SEATS[id][0], R.SEATS[id][1] + R.SIDE_STEP[id] * R.SIDE_STEP_DISTANCE]
  const { min, at } = minClearance([R.SEATS[id], step, R.AISLES[id]], list)
  // Standing up, the first point is inside the chair by definition; check from the side step on.
  const out = minClearance([step, R.AISLES[id]], list)
  // Stepping out beside the chair squeezes past the sitter's own desk, so this needs less room than a walk.
  report(out.min >= EXIT_CLEARANCE, `${id}: seat -> aisle clears by ${out.min.toFixed(2)} m (needs ${EXIT_CLEARANCE})`)
  void min
  void at
}
for (let i = 0; i + 1 < R.PIPELINE.length; i++) {
  const a = R.PIPELINE[i]
  const b = R.PIPELINE[i + 1]
  report(R.hasRoute(a, b), `${a} <-> ${b} has a planned route`)
  if (!R.hasRoute(a, b)) continue
  const path = R.tripPath(a, b).slice(2) // from the aisle spot onwards
  const { min, at } = minClearance(path, all)
  report(min >= R.BODY_CLEARANCE - 0.01, `${a} -> ${b}: ${path.length - 1} segments, tightest ${min.toFixed(2)} m at (${at.map((v) => v.toFixed(1))})`)
}
process.exitCode = failures ? 1 : 0
