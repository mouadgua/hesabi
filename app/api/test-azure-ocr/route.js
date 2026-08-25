// ⚠️ Route de diagnostic pour l'OCR Azure — voie disponible mais non prioritaire.
// Sert à vérifier que les clés Azure répondent avant d'activer la méthode sur un
// cabinet. Protégée par WORKER_SECRET, elle n'est sur aucun chemin utilisateur.
import { NextResponse } from 'next/server'
import { analyzeLayout, simplifyForLLM } from '@/lib/azureOcr'

// Protected by WORKER_SECRET — same pattern as /api/worker-extraction
export async function POST(request) {
  const workerSecret = process.env.WORKER_SECRET
  if (workerSecret) {
    const auth = request.headers.get('x-worker-secret')
    if (auth !== workerSecret) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  }

  try {
    const { base64, mimeType } = await request.json()

    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json({ error: 'base64 requis (string)' }, { status: 400 })
    }
    if (!mimeType || typeof mimeType !== 'string') {
      return NextResponse.json({ error: 'mimeType requis' }, { status: 400 })
    }

    const result    = await analyzeLayout(base64, mimeType)
    const simplified = simplifyForLLM(result)

    return NextResponse.json({
      ok:      true,
      pages:   result.pages,
      chars:   simplified.length,
      preview: simplified.slice(0, 300),
    })
  } catch (err) {
    console.error('[test-azure-ocr]', err.message)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
