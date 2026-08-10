import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { sanitizeText } from '@/lib/sanitize'

const VALID_DOC_TYPES = new Set(['facture', 'releve_bancaire', 'bon_commande', 'recu', 'autre'])

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    let body
    try { body = await request.json() }
    catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

    const { document_type, field_name, document_id } = body

    // ── Sanitize ──────────────────────────────────────────────────────────────
    const cleanFieldName  = sanitizeText(field_name,   50)
    const cleanDocType    = VALID_DOC_TYPES.has(document_type) ? document_type : 'autre'
    let cleanDocumentId = typeof document_id === 'string' && /^[0-9a-f-]{36}$/.test(document_id)
      ? document_id : null

    if (!cleanFieldName) {
      return NextResponse.json({ error: 'Nom du champ requis' }, { status: 400 })
    }

    // L'identifiant venait du client sans contrôle : n'importe quel UUID
    // pouvait être stocké, y compris celui d'un document d'un autre cabinet.
    // Donnée analytique, donc on ignore une référence non vérifiable plutôt
    // que de rejeter le retour utilisateur.
    if (cleanDocumentId) {
      const utilisateur = await prisma.utilisateur.findUnique({
        where:  { id: user.id },
        select: { cabinet_id: true },
      })
      const owned = utilisateur?.cabinet_id
        ? await prisma.document.findFirst({
            where:  { id: cleanDocumentId, client: { cabinet_id: utilisateur.cabinet_id } },
            select: { id: true },
          })
        : null
      if (!owned) cleanDocumentId = null
    }

    await prisma.missingFieldRequest.create({
      data: {
        user_id:       user.id,
        document_type: cleanDocType,
        field_name:    cleanFieldName,
        document_id:   cleanDocumentId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Missing field feedback error:', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
