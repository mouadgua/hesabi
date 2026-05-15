import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { document_type, field_name, original_value, corrected_value, supplier_name } = await request.json()

    if (!field_name || corrected_value === undefined) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    await prisma.fieldCorrection.create({
      data: {
        user_id: user.id,
        document_type: document_type || 'autre',
        field_name,
        original_value: original_value ?? null,
        corrected_value: String(corrected_value),
        supplier_name: supplier_name ?? null,
      },
    })

    // Count identical corrections for this user + document_type + field_name + corrected_value
    const identicalCount = await prisma.fieldCorrection.count({
      where: {
        user_id: user.id,
        document_type: document_type || 'autre',
        field_name,
        corrected_value: String(corrected_value),
      },
    })

    let learned = false

    if (identicalCount >= 3) {
      // Auto-update UserFieldPreference: add field to preferred_fields
      const existing = await prisma.userFieldPreference.findUnique({
        where: { user_id_document_type: { user_id: user.id, document_type: document_type || 'autre' } },
      })

      const preferred = Array.isArray(existing?.preferred_fields) ? existing.preferred_fields : []
      if (!preferred.includes(field_name)) {
        await prisma.userFieldPreference.upsert({
          where: { user_id_document_type: { user_id: user.id, document_type: document_type || 'autre' } },
          create: {
            user_id: user.id,
            document_type: document_type || 'autre',
            preferred_fields: [field_name],
            excluded_fields: existing?.excluded_fields ?? [],
            field_aliases: existing?.field_aliases ?? {},
          },
          update: {
            preferred_fields: [...preferred, field_name],
          },
        })
        learned = true
      }
    }

    return NextResponse.json({ success: true, learned, count: identicalCount })
  } catch (err) {
    console.error('Corrections save error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
