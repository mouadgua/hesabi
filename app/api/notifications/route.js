import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.id },
      select: { cabinet_id: true },
    })
    if (!utilisateur?.cabinet_id) return NextResponse.json({ notifications: [] })

    const docs = await prisma.document.findMany({
      where: {
        statut: { in: ['A_VERIFIER', 'REJETE', 'EN_COURS_IA'] },
        client: { cabinet_id: utilisateur.cabinet_id },
      },
      select: {
        id: true,
        nom_fichier: true,
        statut: true,
        document_type: true,
        fournisseur_detecte: true,
        updatedAt: true,
        client: { select: { nom_entreprise: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    })

    return NextResponse.json({ notifications: docs })
  } catch (err) {
    console.error('Notifications error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
