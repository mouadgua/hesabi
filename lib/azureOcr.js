/**
 * lib/azureOcr.js — Azure AI Document Intelligence wrapper
 *
 * ⚠️ DISPONIBLE, NON PRIORITAIRE
 *
 * Ce module n'est plus sur le chemin par défaut. La direction retenue est
 * l'extraction Gemini directe (un appel), pour la latence ; l'OCR Azure en
 * ajoute un second, séquentiel, et se facture à la page.
 *
 * Il reste ici, complet et fonctionnel, pour un besoin ciblé et démontré :
 * un cabinet dont les scans passent mal en lecture directe. Il ne s'active
 * qu'à la demande explicite d'un cabinet — voir resolveExtractionMethod()
 * dans app/api/worker-extraction/route.js.
 *
 * Ne pas le remettre sur le chemin par défaut sans mesure comparative.
 *
 * Uses prebuilt-layout to extract structured text from PDFs and images.
 * Returns both the raw analyzeResult and a simplified essential JSON.
 *
 * Required env vars:
 *   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT  e.g. https://myresource.cognitiveservices.azure.com/
 *   AZURE_DOCUMENT_INTELLIGENCE_KEY       primary key from Azure portal
 */

const AZURE_API_VERSION = '2024-11-30'
const POLL_INTERVAL_MS  = 2000
const MAX_POLLS         = 30   // 60s max polling window

function endpoint() {
  const ep = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  if (!ep) throw new Error('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT non configuré')
  return ep.endsWith('/') ? ep : ep + '/'
}

function apiKey() {
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
  if (!key) throw new Error('AZURE_DOCUMENT_INTELLIGENCE_KEY non configuré')
  return key
}

/**
 * Sends a document (base64) to Azure Document Intelligence prebuilt-layout,
 * polls until analysis completes, and returns the raw analyzeResult.
 *
 * @param {string} base64   - Document content encoded in base64
 * @param {string} mimeType - MIME type (application/pdf, image/jpeg, etc.)
 * @returns {Promise<{ analyzeResult: object, content: string, pages: number }>}
 */
export async function analyzeLayout(base64, mimeType) {
  const key = apiKey()
  const analyzeUrl =
    `${endpoint()}documentintelligence/documentModels/prebuilt-layout:analyze?api-version=${AZURE_API_VERSION}`

  const initRes = await fetch(analyzeUrl, {
    method:  'POST',
    headers: {
      'Content-Type':              'application/json',
      'Ocp-Apim-Subscription-Key': key,
    },
    body: JSON.stringify({ base64Source: base64 }),
  })

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '')
    throw new Error(`Azure DI init ${initRes.status}: ${errText.slice(0, 300)}`)
  }

  const operationUrl = initRes.headers.get('Operation-Location')
  if (!operationUrl) throw new Error('Azure DI: pas de Operation-Location dans la réponse')

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const pollRes = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    })

    if (!pollRes.ok) {
      const errText = await pollRes.text().catch(() => '')
      throw new Error(`Azure DI poll ${pollRes.status}: ${errText.slice(0, 300)}`)
    }

    const data = await pollRes.json()

    if (data.status === 'succeeded') {
      const ar      = data.analyzeResult ?? {}
      const content = ar.content ?? ''
      const pages   = ar.pages?.length ?? 1
      console.log(`[AzureDI] succeeded — ${content.length} chars, ${pages} page(s), ${i + 1} poll(s)`)
      return { analyzeResult: ar, content, pages }
    }

    if (data.status === 'failed') {
      throw new Error(`Azure DI failed: ${data.error?.message ?? 'erreur inconnue'}`)
    }

    console.log(`[AzureDI] poll ${i + 1}/${MAX_POLLS} — status: ${data.status}`)
  }

  throw new Error(`Azure DI timeout après ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`)
}

/**
 * Extracts only the essential structured data from Azure's raw analyzeResult.
 * Removes bounding polygons, word-level positions, span details, and every other
 * field that is useless for an LLM extraction prompt.
 *
 * Output shape:
 *   {
 *     pageCount     : number,
 *     keyValuePairs : [{ key, value, confidence }],  // detected form fields
 *     tables        : [{ headers, rows, rowCount, columnCount }],
 *     paragraphs    : (string | { role, text })[]    // ordered text blocks
 *   }
 *
 * @param {object} analyzeResult - The raw analyzeResult from Azure DI
 * @returns {object}
 */
export function extractEssential(analyzeResult) {
  const out = { pageCount: analyzeResult.pages?.length ?? 1 }

  // ── Key-value pairs ──────────────────────────────────────────────────────────
  // Azure detects "Total TTC : 1 234,00 MAD" → { key: "Total TTC", value: "1 234,00 MAD" }
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

  // ── Tables ───────────────────────────────────────────────────────────────────
  const tablesRaw = analyzeResult.tables ?? []
  if (tablesRaw.length) {
    out.tables = tablesRaw.map(table => {
      const cells    = table.cells ?? []
      const colCount = table.columnCount ?? (Math.max(0, ...cells.map(c => c.columnIndex)) + 1)

      // Separate header cells from data cells
      const headerCells = cells.filter(c => c.kind === 'columnHeader')
      const dataCells   = cells.filter(c => c.kind !== 'columnHeader')

      // Build sorted headers array (one string per column)
      const headers = headerCells.length
        ? Array.from({ length: colCount }, (_, ci) => {
            const cell = headerCells.find(c => c.columnIndex === ci)
            return cell?.content?.trim() ?? ''
          })
        : null

      // Build data rows (skip fully empty rows)
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

  // ── Paragraphs ───────────────────────────────────────────────────────────────
  // Roles: title | sectionHeading | footnote | pageHeader | pageFooter | pageNumber
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
    // Fallback: split raw content into non-empty lines
    out.paragraphs = analyzeResult.content
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
  }

  return out
}

/**
 * Returns plain text from an analyzeLayout() result for simple LLM injection.
 * Collapses whitespace without losing line structure.
 *
 * @param {{ content: string } | { analyzeResult: { content: string } }} arg
 * @returns {string}
 */
export function simplifyForLLM(arg) {
  const content = arg.content ?? arg.analyzeResult?.content ?? ''
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
