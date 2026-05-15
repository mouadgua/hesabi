import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { document_type, field_name, document_id } = await request.json()

    if (!field_name) {
      return NextResponse.json({ error: 'Nom du champ requis' }, { status: 400 })
    }

    await prisma.missingFieldRequest.create({
      data: {
        user_id: user.id,
        document_type: document_type || 'autre',
        field_name: field_name.trim(),
        document_id: document_id ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Missing field feedback error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
