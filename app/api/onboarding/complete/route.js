import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { logiciel, preferred_fields } = await request.json()

    // Mark onboarding as done
    await prisma.utilisateur.update({
      where: { id: user.id },
      data: { onboarding_done: true },
    })

    // Save preferred fields for all common document types
    if (Array.isArray(preferred_fields) && preferred_fields.length > 0) {
      const docTypes = ['facture', 'recu', 'bon_commande']
      await Promise.all(
        docTypes.map(docType =>
          prisma.userFieldPreference.upsert({
            where: { user_id_document_type: { user_id: user.id, document_type: docType } },
            create: {
              user_id: user.id,
              document_type: docType,
              preferred_fields,
              excluded_fields: [],
              field_aliases: logiciel ? { _logiciel: logiciel } : {},
            },
            update: {
              preferred_fields,
              field_aliases: logiciel ? { _logiciel: logiciel } : {},
            },
          })
        )
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Onboarding complete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
