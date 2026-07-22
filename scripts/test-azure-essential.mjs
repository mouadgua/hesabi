#!/usr/bin/env node
/**
 * scripts/test-azure-essential.mjs
 *
 * Sends a local file to Azure Document Intelligence and prints the essential
 * structured JSON (no bounding boxes, no positions — only what the LLM needs).
 *
 * Usage:
 *   node scripts/test-azure-essential.mjs <path-to-file>
 *   node scripts/test-azure-essential.mjs ./test_files/facture.pdf
 *   node scripts/test-azure-essential.mjs ./test_files/releve.jpg
 *
 * Required env vars (set in .env or export before running):
 *   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
 *   AZURE_DOCUMENT_INTELLIGENCE_KEY
 *
 * To load .env automatically:
 *   node --env-file=.env scripts/test-azure-essential.mjs <file>
 */

import fs   from 'fs'
import path from 'path'

// ── Env check ─────────────────────────────────────────────────────────────────

const ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
const API_KEY  = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY

if (!ENDPOINT || !API_KEY) {
  console.error('\n❌  Missing env vars:')
  if (!ENDPOINT) console.error('   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')
  if (!API_KEY)  console.error('   AZURE_DOCUMENT_INTELLIGENCE_KEY')
  console.error('\nRun with: node --env-file=.env scripts/test-azure-essential.mjs <file>\n')
  process.exit(1)
}

// ── File check ────────────────────────────────────────────────────────────────

const filePath = process.argv[2]
if (!filePath) {
  console.error('\nUsage: node scripts/test-azure-essential.mjs <path-to-file>\n')
  process.exit(1)
}

const absPath = path.resolve(filePath)
if (!fs.existsSync(absPath)) {
  console.error(`\n❌  File not found: ${absPath}\n`)
  process.exit(1)
}

// ── MIME type detection ───────────────────────────────────────────────────────

const EXT_MIME = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.tiff': 'image/tiff',
  '.tif':  'image/tiff',
  '.bmp':  'image/bmp',
  '.webp': 'image/webp',
  '.heif': 'image/heif',
  '.heic': 'image/heic',
}
const ext      = path.extname(absPath).toLowerCase()
const mimeType = EXT_MIME[ext] ?? 'application/octet-stream'

// ── Azure helpers ─────────────────────────────────────────────────────────────

const AZURE_API_VERSION = '2024-11-30'
const POLL_INTERVAL_MS  = 2000
const MAX_POLLS         = 30

const ep = ENDPOINT.endsWith('/') ? ENDPOINT : ENDPOINT + '/'
const analyzeUrl =
  `${ep}documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${AZURE_API_VERSION}`

async function analyzeLayout(base64) {
  const initRes = await fetch(analyzeUrl, {
    method:  'POST',
    headers: {
      'Content-Type':              'application/json',
      'Ocp-Apim-Subscription-Key': API_KEY,
    },
    body: JSON.stringify({ base64Source: base64 }),
  })

  if (!initRes.ok) {
    const err = await initRes.text()
    throw new Error(`Azure DI init ${initRes.status}: ${err.slice(0, 300)}`)
  }

  const operationUrl = initRes.headers.get('Operation-Location')
  if (!operationUrl) throw new Error('No Operation-Location header')

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const poll = await fetch(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': API_KEY } })
    const data = await poll.json()

    if (data.status === 'succeeded') return data.analyzeResult
    if (data.status === 'failed')    throw new Error(`Azure DI failed: ${data.error?.message}`)
    process.stdout.write(`\r  Polling ${i + 1}/${MAX_POLLS} — ${data.status}...`)
  }
  throw new Error('Timeout')
}

// ── extractEssential (same logic as lib/azureOcr.js) ─────────────────────────

function extractEssential(analyzeResult) {
  const out = { pageCount: analyzeResult.pages?.length ?? 1 }

  const kvRaw = analyzeResult.keyValuePairs ?? []
  if (kvRaw.length) {
    out.keyValuePairs = kvRaw
      .filter(kv => (kv.confidence ?? 1) >= 0.4 && kv.key?.content)
      .map(kv => ({
        key:        kv.key.content.trim(),
        value:      kv.value?.content?.trim() ?? '',
        confidence: Math.round((kv.confidence ?? 1) * 100) / 100,
      }))
  }

  const tablesRaw = analyzeResult.tables ?? []
  if (tablesRaw.length) {
    out.tables = tablesRaw.map(table => {
      const cells    = table.cells ?? []
      const colCount = table.columnCount ?? (Math.max(0, ...cells.map(c => c.columnIndex)) + 1)
      const headerCells = cells.filter(c => c.kind === 'columnHeader')
      const dataCells   = cells.filter(c => c.kind !== 'columnHeader')

      const headers = headerCells.length
        ? Array.from({ length: colCount }, (_, ci) => {
            const cell = headerCells.find(c => c.columnIndex === ci)
            return cell?.content?.trim() ?? ''
          })
        : null

      const rowIndices = [...new Set(dataCells.map(c => c.rowIndex))].sort((a, b) => a - b)
      const rows = rowIndices
        .map(r =>
          Array.from({ length: colCount }, (_, ci) => {
            const cell = dataCells.find(c => c.rowIndex === r && c.columnIndex === ci)
            return cell?.content?.trim() ?? ''
          })
        )
        .filter(row => row.some(v => v !== ''))

      return { headers, rows, rowCount: rows.length, columnCount: colCount }
    })
  }

  const parasRaw = analyzeResult.paragraphs ?? []
  if (parasRaw.length) {
    out.paragraphs = parasRaw
      .map(p => {
        const text = p.content?.trim()
        if (!text) return null
        return p.role ? { role: p.role, text } : text
      })
      .filter(Boolean)
  } else if (analyzeResult.content) {
    out.paragraphs = analyzeResult.content.split('\n').map(l => l.trim()).filter(Boolean)
  }

  return out
}

// ── Main ──────────────────────────────────────────────────────────────────────

const fileBytes = fs.readFileSync(absPath)
const base64    = fileBytes.toString('base64')
const sizeKB    = Math.round(fileBytes.length / 1024)

console.log(`\n📄  File   : ${path.basename(absPath)} (${sizeKB} KB, ${mimeType})`)
console.log(`🔗  Azure  : ${ep}\n`)

try {
  console.log('⏳  Sending to Azure Document Intelligence...')
  const analyzeResult = await analyzeLayout(base64)
  process.stdout.write('\n')

  console.log('\n✅  Azure analysis complete\n')
  console.log('─'.repeat(60))
  console.log('ESSENTIAL JSON (ready for LLM injection):')
  console.log('─'.repeat(60))

  const essential = extractEssential(analyzeResult)
  console.log(JSON.stringify(essential, null, 2))

  console.log('\n─'.repeat(60))
  const stats = {
    pageCount:     essential.pageCount,
    keyValuePairs: essential.keyValuePairs?.length ?? 0,
    tables:        essential.tables?.length ?? 0,
    paragraphs:    essential.paragraphs?.length ?? 0,
    jsonSizeBytes: JSON.stringify(essential).length,
  }
  console.log('STATS:', JSON.stringify(stats, null, 2))

  // Optional: dump full raw result for debugging
  if (process.argv[3] === '--raw') {
    const rawPath = absPath.replace(ext, '.azure-raw.json')
    fs.writeFileSync(rawPath, JSON.stringify(analyzeResult, null, 2))
    console.log(`\n📁  Full raw result saved to: ${rawPath}`)
  }
} catch (err) {
  console.error('\n❌  Error:', err.message)
  process.exit(1)
}
