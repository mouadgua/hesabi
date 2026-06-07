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

    const { document_type, field_name, original_value, corrected_value, supplier_name } = body

    // ── Sanitize inputs ───────────────────────────────────────────────────────
    const cleanFieldName     = sanitizeText(field_name,      50)
    const cleanDocType       = VALID_DOC_TYPES.has(document_type) ? document_type : 'autre'
    const cleanCorrected     = sanitizeText(String(corrected_value ?? ''), 500)
    const cleanOriginal      = original_value != null ? sanitizeText(String(original_value), 500) : null
    const cleanSupplier      = supplier_name  != null ? sanitizeText(String(supplier_name),  200) : null

    if (!cleanFieldName || corrected_value === undefined) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    await prisma.fieldCorrection.create({
      data: {
        user_id:         user.id,
        document_type:   cleanDocType,
        field_name:      cleanFieldName,
        original_value:  cleanOriginal,
        corrected_value: cleanCorrected,
        supplier_name:   cleanSupplier,
      },
    })

    const identicalCount = await prisma.fieldCorrection.count({
      where: {
        user_id:         user.id,
        document_type:   cleanDocType,
        field_name:      cleanFieldName,
        corrected_value: cleanCorrected,
      },
    })

    let learned = false
    if (identicalCount >= 3) {
      const existing = await prisma.userFieldPreference.findUnique({
        where: { user_id_document_type: { user_id: user.id, document_type: cleanDocType } },
      })
      const preferred = Array.isArray(existing?.preferred_fields) ? existing.preferred_fields : []
      if (!preferred.includes(cleanFieldName)) {
        await prisma.userFieldPreference.upsert({
          where: { user_id_document_type: { user_id: user.id, document_type: cleanDocType } },
          create: {
            user_id:          user.id,
            document_type:    cleanDocType,
            preferred_fields: [cleanFieldName],
            excluded_fields:  existing?.excluded_fields ?? [],
            field_aliases:    existing?.field_aliases ?? {},
          },
          update: { preferred_fields: [...preferred, cleanFieldName] },
        })
        learned = true
      }
    }

    return NextResponse.json({ success: true, learned, count: identicalCount })
  } catch (err) {
    console.error('Corrections save error:', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
