/**
 * Hesabi — Traffic / Load Test
 * Usage: node test_files/test_traffic.mjs [BASE_URL] [--concurrency=N] [--rounds=N]
 *
 * Examples:
 *   node test_files/test_traffic.mjs
 *   node test_files/test_traffic.mjs http://localhost:3000
 *   node test_files/test_traffic.mjs https://hesabi.ma --concurrency=20 --rounds=5
 */

import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const dotenv  = require('dotenv')
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

// ── Config ─────────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2)
const BASE_URL    = args.find(a => a.startsWith('http')) ?? 'http://localhost:3000'
const CONCURRENCY = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? '10')
const ROUNDS      = parseInt(args.find(a => a.startsWith('--rounds='))?.split('=')[1] ?? '3')
const WORKER_SECRET = process.env.WORKER_SECRET ?? ''

const DIR = path.resolve(process.cwd(), 'test_files')

// ── Stats helpers ──────────────────────────────────────────────────────────────

function stats(durations) {
  const sorted = [...durations].sort((a, b) => a - b)
  const sum    = sorted.reduce((s, v) => s + v, 0)
  const p = (pct) => sorted[Math.floor(sorted.length * pct / 100)] ?? 0
  return {
    count:  sorted.length,
    min:    sorted[0],
    max:    sorted[sorted.length - 1],
    avg:    Math.round(sum / sorted.length),
    p50:    p(50),
    p90:    p(90),
    p95:    p(95),
    p99:    p(99),
  }
}

function bar(val, max, width = 20) {
  const filled = Math.round((val / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function fmt(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
}

// ── Single request ─────────────────────────────────────────────────────────────

async function timed(fn) {
  const start = Date.now()
  try {
    const res = await fn()
    return { ok: res.ok, status: res.status, ms: Date.now() - start, error: null }
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - start, error: err.message }
  }
}

// ── Test suites ────────────────────────────────────────────────────────────────

async function runSuite(label, requestFn, concurrency, rounds) {
  console.log(`\n${'─'.repeat(52)}`)
  console.log(`  ${label}`)
  console.log(`  Concurrency: ${concurrency} × ${rounds} rounds = ${concurrency * rounds} requests`)
  console.log('─'.repeat(52))

  const allResults = []

  for (let r = 0; r < rounds; r++) {
    const batch = await Promise.all(
      Array.from({ length: concurrency }, () => timed(requestFn))
    )
    allResults.push(...batch)
    const ok  = batch.filter(b => b.ok).length
    const avg = Math.round(batch.reduce((s, b) => s + b.ms, 0) / batch.length)
    process.stdout.write(`  Round ${r + 1}/${rounds}: ${ok}/${concurrency} ok  avg=${fmt(avg)}\n`)
  }

  const ok       = allResults.filter(r => r.ok)
  const fail     = allResults.filter(r => !r.ok)
  const s        = stats(ok.map(r => r.ms))
  const successRate = Math.round((ok.length / allResults.length) * 100)

  console.log(`\n  Results (${ok.length}/${allResults.length} successful — ${successRate}%)`)
  if (ok.length > 0) {
    console.log(`  min=${fmt(s.min)}  avg=${fmt(s.avg)}  p50=${fmt(s.p50)}  p90=${fmt(s.p90)}  p95=${fmt(s.p95)}  p99=${fmt(s.p99)}  max=${fmt(s.max)}`)

    const throughputRps = Math.round(ok.length / ((s.max + s.min) / 2 / 1000))
    console.log(`  Estimated throughput: ~${throughputRps} req/s`)

    // Latency distribution bar chart
    const buckets = [50, 100, 200, 500, 1000, 2000, 5000, Infinity]
    const bucketLabels = ['<50ms', '<100ms', '<200ms', '<500ms', '<1s', '<2s', '<5s', '≥5s']
    const counts = new Array(buckets.length).fill(0)
    ok.forEach(r => {
      const idx = buckets.findIndex(b => r.ms < b)
      counts[idx]++
    })
    console.log('\n  Latency distribution:')
    const maxCount = Math.max(...counts)
    counts.forEach((c, i) => {
      if (c > 0) {
        const pct = Math.round((c / ok.length) * 100)
        console.log(`    ${bucketLabels[i].padEnd(8)} ${bar(c, maxCount)} ${c} (${pct}%)`)
      }
    })
  }

  if (fail.length > 0) {
    console.log(`\n  Failures (${fail.length}):`)
    const errGroups = {}
    fail.forEach(f => {
      const key = f.error ?? `HTTP ${f.status}`
      errGroups[key] = (errGroups[key] ?? 0) + 1
    })
    Object.entries(errGroups).forEach(([k, v]) => console.log(`    ${v}× ${k}`))
  }

  return { label, total: allResults.length, ok: ok.length, fail: fail.length, s }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║       Hesabi — Traffic & Load Test               ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Target  : ${BASE_URL}`)
  console.log(`  Workers : ${CONCURRENCY} concurrent`)
  console.log(`  Rounds  : ${ROUNDS}`)
  console.log(`  Total   : ${CONCURRENCY * ROUNDS * 2} requests across all suites`)

  const summary = []

  // ── 1. Health check — no auth, pure server latency ────────────────────────
  summary.push(await runSuite(
    '1/4  GET /api/health  (DB ping)',
    () => fetch(`${BASE_URL}/api/health`),
    CONCURRENCY,
    ROUNDS,
  ))

  // ── 2. Static / landing page ──────────────────────────────────────────────
  summary.push(await runSuite(
    '2/4  GET /  (landing page SSR)',
    () => fetch(`${BASE_URL}/`),
    CONCURRENCY,
    ROUNDS,
  ))

  // ── 3. Demo extraction endpoint (with a real PDF) ─────────────────────────
  const pdfPath = path.join(DIR, 'Reçu #19 - The Vault.pdf')
  if (fs.existsSync(pdfPath)) {
    const pdfBytes = fs.readFileSync(pdfPath)

    summary.push(await runSuite(
      '3/4  POST /api/demo-extraction  (AI PDF — sequential, 3 req)',
      async () => {
        const fd = new FormData()
        fd.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'test.pdf')
        fd.append('fields', JSON.stringify(['montant', 'date', 'fournisseur']))
        return fetch(`${BASE_URL}/api/demo-extraction`, { method: 'POST', body: fd })
      },
      3,   // keep concurrency low — AI calls are expensive
      1,   // single round
    ))
  } else {
    console.log('\n  3/4  Skipped — test PDF not found')
  }

  // ── 4. Worker endpoint (unauthenticated — should return 401/503) ──────────
  summary.push(await runSuite(
    '4/4  POST /api/worker-extraction  (auth wall test)',
    () => fetch(`${BASE_URL}/api/worker-extraction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentIds: [], cabinetId: 'fake' }),
    }),
    CONCURRENCY,
    ROUNDS,
  ))

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                    Summary                       ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  ${'Suite'.padEnd(40)} ${'ok'.padEnd(6)} ${'fail'.padEnd(6)} ${'avg'.padEnd(8)} p95`)
  console.log(`  ${'─'.repeat(68)}`)
  summary.forEach(r => {
    if (!r.s) return
    const pct = Math.round((r.ok / r.total) * 100)
    console.log(`  ${r.label.padEnd(40)} ${String(r.ok + '/' + r.total).padEnd(6)} ${String(r.fail).padEnd(6)} ${fmt(r.s?.avg ?? 0).padEnd(8)} ${fmt(r.s?.p95 ?? 0)}  (${pct}% ok)`)
  })
  console.log()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
