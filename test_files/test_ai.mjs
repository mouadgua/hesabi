/**
 * Direct API test — Gemini PDF + OpenRouter images
 * Usage: node test_files/test_ai.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const dotenv  = require('dotenv')
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const DIR = path.resolve(process.cwd(), 'test_files')

const GEMINI_KEY   = process.env.GEMINI_API_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

const SIMPLE_PROMPT = 'Tu es un expert-comptable. Extrait les informations clés de ce document et renvoie un objet JSON compact sur une seule ligne. Pas de markdown.'

function toBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64')
}

function check(label, ok) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`)
}

// ── 1. Gemini PDF ─────────────────────────────────────────────────────────────

async function testGeminiPDF(model, apiVersion, filePath) {
  const label = `Gemini ${model} (${apiVersion}) — ${path.basename(filePath)}`
  console.log(`\n🔵 ${label}`)

  const base64 = toBase64(filePath)
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${GEMINI_KEY}`

  const body = {
    contents: [{ parts: [
      { text: SIMPLE_PROMPT },
      { inline_data: { mime_type: 'application/pdf', data: base64 } },
    ]}],
    generationConfig: { maxOutputTokens: 2000 },
  }

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const ms = Date.now() - start
    const data = await res.json()

    if (!res.ok) {
      check(`HTTP ${res.status} in ${ms}ms`, false)
      console.log(`     ${data.error?.message}`)
      return false
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    check(`HTTP 200 in ${ms}ms — ${text.length} chars`, true)
    console.log(`     Preview: ${text.slice(0, 120).replace(/\n/g, ' ')}`)
    return true
  } catch (err) {
    check(`Exception: ${err.message}`, false)
    return false
  }
}

// ── 2. OpenRouter image ───────────────────────────────────────────────────────

async function testOpenRouterImage(model, filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const mime = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  const label = `OpenRouter ${model} — ${path.basename(filePath)}`
  console.log(`\n🟣 ${label}`)

  const base64 = toBase64(filePath)
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: SIMPLE_PROMPT },
      { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
    ],
  }]

  const start = Date.now()
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://hesabi.ma',
        'X-Title': 'hesabi',
      },
      body: JSON.stringify({ model, messages, max_tokens: 2000 }),
    })
    const ms = Date.now() - start
    const data = await res.json()

    if (!res.ok) {
      check(`HTTP ${res.status} in ${ms}ms`, false)
      console.log(`     ${JSON.stringify(data.error ?? data).slice(0, 200)}`)
      return false
    }

    const text = data.choices?.[0]?.message?.content ?? ''
    check(`HTTP 200 in ${ms}ms — ${text.length} chars`, true)
    console.log(`     Preview: ${text.slice(0, 120).replace(/\n/g, ' ')}`)
    return true
  } catch (err) {
    check(`Exception: ${err.message}`, false)
    return false
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Hesabi AI API Test')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  GEMINI_API_KEY    : ${GEMINI_KEY ? '✅ present' : '❌ MISSING'}`)
  console.log(`  OPENROUTER_API_KEY: ${OPENROUTER_KEY ? '✅ present' : '❌ MISSING'}`)

  const pdf  = path.join(DIR, 'Reçu #19 - The Vault.pdf')
  const webp1 = path.join(DIR, '1.webp')
  const webp2 = path.join(DIR, '1-2.webp')

  // ── Gemini PDF tests ──────────────────────────────────────────────────────
  console.log('\n═══ GEMINI PDF (direct API) ═══')
  const g1 = await testGeminiPDF('gemini-2.0-flash',        'v1beta', pdf)
  const g2 = await testGeminiPDF('gemini-1.5-flash',        'v1beta', pdf)
  const g3 = await testGeminiPDF('gemini-1.5-flash',        'v1',     pdf)
  const g4 = await testGeminiPDF('gemini-2.0-flash-lite',   'v1beta', pdf)

  // ── OpenRouter image tests ────────────────────────────────────────────────
  console.log('\n═══ OPENROUTER IMAGES ═══')
  const o1 = await testOpenRouterImage('anthropic/claude-haiku-4-5',       webp1)
  const o2 = await testOpenRouterImage('google/gemini-flash-1.5',          webp1)
  const o3 = await testOpenRouterImage('google/gemini-flash-1.5-8b',       webp1)
  const o4 = await testOpenRouterImage('openai/gpt-4o',                    webp2)
  const o5 = await testOpenRouterImage('qwen/qwen2.5-vl-72b-instruct',     webp2)

  // ── OpenRouter PDF tests (those that support it) ──────────────────────────
  console.log('\n═══ OPENROUTER PDF ═══')
  const p1 = await testOpenRouterImage('anthropic/claude-haiku-4-5',       pdf)
  const p2 = await testOpenRouterImage('google/gemini-flash-1.5',          pdf)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Gemini 2.0-flash v1beta (PDF)  : ${g1 ? '✅' : '❌'}`)
  console.log(`  Gemini 1.5-flash v1beta (PDF)  : ${g2 ? '✅' : '❌'}`)
  console.log(`  Gemini 1.5-flash v1 (PDF)      : ${g3 ? '✅' : '❌'}`)
  console.log(`  Gemini 2.0-flash-lite v1beta   : ${g4 ? '✅' : '❌'}`)
  console.log(`  Claude Haiku (image)           : ${o1 ? '✅' : '❌'}`)
  console.log(`  gemini-flash-1.5 (image)       : ${o2 ? '✅' : '❌'}`)
  console.log(`  gemini-flash-1.5-8b (image)    : ${o3 ? '✅' : '❌'}`)
  console.log(`  GPT-4o (image)                 : ${o4 ? '✅' : '❌'}`)
  console.log(`  Qwen VL (image)                : ${o5 ? '✅' : '❌'}`)
  console.log(`  Claude Haiku (PDF via OR)      : ${p1 ? '✅' : '❌'}`)
  console.log(`  gemini-flash-1.5 (PDF via OR)  : ${p2 ? '✅' : '❌'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(console.error)
