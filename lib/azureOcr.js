/**
 * lib/azureOcr.js — Azure AI Document Intelligence wrapper
 *
 * Uses the prebuilt-layout model to extract structured text from PDFs and images.
 * Returns plain text content ready to be injected into a Gemini prompt.
 *
 * Required env vars:
 *   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT  e.g. https://myresource.cognitiveservices.azure.com/
 *   AZURE_DOCUMENT_INTELLIGENCE_KEY       primary key from Azure portal
 */

const AZURE_API_VERSION = '2024-11-30'
const POLL_INTERVAL_MS  = 2000
const MAX_POLLS         = 20   // 40s max polling window

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
 * polls until analysis completes, and returns the raw result.
 *
 * @param {string} base64  - Document content encoded in base64
 * @param {string} mimeType - MIME type (application/pdf, image/jpeg, etc.)
 * @returns {Promise<{ content: string, pages: number }>}
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
    throw new Error(`Azure OCR init ${initRes.status}: ${errText.slice(0, 300)}`)
  }

  const operationUrl = initRes.headers.get('Operation-Location')
  if (!operationUrl) throw new Error('Azure OCR: pas de Operation-Location dans la réponse')

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const pollRes = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    })

    if (!pollRes.ok) {
      const errText = await pollRes.text().catch(() => '')
      throw new Error(`Azure OCR poll ${pollRes.status}: ${errText.slice(0, 300)}`)
    }

    const data = await pollRes.json()

    if (data.status === 'succeeded') {
      const content = data.analyzeResult?.content ?? ''
      const pages   = data.analyzeResult?.pages?.length ?? 1
      console.log(`[AzureOCR] succeeded — ${content.length} chars, ${pages} page(s), ${i + 1} poll(s)`)
      return { content, pages }
    }

    if (data.status === 'failed') {
      throw new Error(`Azure OCR failed: ${data.error?.message ?? 'erreur inconnue'}`)
    }

    console.log(`[AzureOCR] poll ${i + 1}/${MAX_POLLS} — status: ${data.status}`)
  }

  throw new Error(`Azure OCR timeout après ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`)
}

/**
 * Cleans raw Azure OCR content for injection into a Gemini text prompt.
 * Collapses whitespace and blank lines without losing structural information.
 *
 * @param {{ content: string }} azureResult - Return value of analyzeLayout()
 * @returns {string}
 */
export function simplifyForLLM({ content }) {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
