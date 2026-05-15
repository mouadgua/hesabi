import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildExtractionPrompt } from '@/utils/buildExtractionPrompt'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const VALID_TYPES = ['facture', 'releve_bancaire', 'bon_commande', 'recu', 'autre']

// ── Classification ────────────────────────────────────────────────────────────

async function classifyDocument(model, documentConfig) {
  const prompt = `Tu es expert-comptable. Analyse ce document et retourne UNIQUEMENT ce JSON (sans markdown) :
{"type":"facture"|"releve_bancaire"|"bon_commande"|"recu"|"autre","confidence":0.0-1.0,"fournisseur":"string ou null"}
Règles : confidence=1.0 si totalement certain, 0.5 si ambigu.`

  try {
    const result = await model.generateContent([prompt, documentConfig])
    const raw = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(raw)
    return {
      type: VALID_TYPES.includes(parsed.type) ? parsed.type : 'autre',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      fournisseur: typeof parsed.fournisseur === 'string' ? parsed.fournisseur : null,
    }
  } catch {
    return { type: 'autre', confidence: 0.5, fournisseur: null }
  }
}

// ── Template auto-match ───────────────────────────────────────────────────────

async function findMatchingTemplate(type) {
  const keywords = {
    facture: ['facture'],
    releve_bancaire: ['relev', 'bancaire', 'bank'],
    bon_commande: ['commande'],
    recu: ['reçu', 'recu'],
  }[type] ?? []

  for (const kw of keywords) {
    const tmpl = await prisma.templateExtraction.findFirst({
      where: { nom_modele: { contains: kw, mode: 'insensitive' } },
    })
    if (tmpl) return tmpl
  }
  return null
}

// ── Worker handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const { documentIds, templateId, userId } = await request.json()
    if (!documentIds?.length) {
      return NextResponse.json({ success: false, message: 'Aucun document fourni.' })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    for (const docId of documentIds) {
      try {
        const document = await prisma.document.findUnique({ where: { id: docId } })
        if (!document) continue

        // ── Download file ─────────────────────────────────────────────────────
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('documents')
          .download(document.chemin_storage)

        if (downloadError) throw new Error('Fichier illisible ou introuvable.')

        const buffer = Buffer.from(await fileBlob.arrayBuffer())
        const mimeType = fileBlob.type || 'application/pdf'
        const documentConfig = { inlineData: { data: buffer.toString('base64'), mimeType } }

        // ── STEP 1 : Classification ───────────────────────────────────────────
        const classification = await classifyDocument(model, documentConfig)

        await prisma.document.update({
          where: { id: docId },
          data: {
            document_type: classification.type,
            document_type_confidence: classification.confidence,
            fournisseur_detecte: classification.fournisseur,
          },
        })

        // ── STEP 2 : Template auto-match ──────────────────────────────────────
        let effectiveTemplateId = templateId

        if (
          (templateId === 'NO_MODEL' || !templateId) &&
          classification.confidence >= 0.7
        ) {
          const matched = await findMatchingTemplate(classification.type)
          if (matched) {
            effectiveTemplateId = matched.id
            await prisma.document.update({
              where: { id: docId },
              data: { template_id: matched.id },
            })
          }
        }

        // ── STEP 3 : Extraction ───────────────────────────────────────────────
        const { prompt: promptSuffix } = await buildExtractionPrompt(effectiveTemplateId, classification, userId ?? null)
        const fullPrompt = `Tu es un expert-comptable. Extrait les informations du document fourni et renvoie-les UNIQUEMENT sous forme d'objet JSON valide, sans markdown ni texte autour.\n${promptSuffix}`

        let geminiResult
        try {
          geminiResult = await model.generateContent([fullPrompt, documentConfig])
        } catch (geminiErr) {
          throw new Error("L'IA est surchargée ou n'a pas pu traiter ce fichier.")
        }

        // ── STEP 4 : Parse + store ────────────────────────────────────────────
        let extractedData
        try {
          const clean = geminiResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
          extractedData = JSON.parse(clean)
        } catch {
          throw new Error("Le résultat de l'IA n'est pas formaté correctement.")
        }

        const hasData = extractedData &&
          Object.keys(extractedData).some(k => {
            const v = extractedData[k]
            return v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
          })

        if (!hasData) throw new Error("L'IA n'a trouvé aucune donnée pertinente.")

        await prisma.document.update({
          where: { id: docId },
          data: { statut: 'A_VERIFIER', donnees_extraites: extractedData, error_message: null },
        })

      } catch (err) {
        console.error(`🚨 Échec sur le document ${docId}:`, err.message)
        await prisma.document.update({
          where: { id: docId },
          data: { statut: 'REJETE', error_message: err.message },
        }).catch(e => console.error('Impossible de passer en REJETE:', e))
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('🔥 Worker global crash:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
