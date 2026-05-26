import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import ExtractionHub from './ExtractionHub'

export default async function ExtractionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { cabinet_id: true },
  })
  if (!utilisateur?.cabinet_id) redirect('/onboarding')

  const [templates, cabinet, rawDocs] = await Promise.all([
    prisma.templateExtraction.findMany({
      where: { cabinet_id: utilisateur.cabinet_id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nom_modele: true },
    }),
    prisma.cabinet.findUnique({
      where: { id: utilisateur.cabinet_id },
      select: { credits: true },
    }),
    prisma.document.findMany({
      where: { client: { cabinet_id: utilisateur.cabinet_id } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { dossier: { select: { nom: true } } },
    }),
  ])

  const documents = rawDocs.map(d => ({
    id: d.id,
    nom_fichier: d.nom_fichier ?? null,
    statut: d.statut,
    document_type: d.document_type ?? null,
    dossier_id: d.dossier_id ?? null,
    dossier_nom: d.dossier?.nom ?? null,
    error_message: d.error_message ?? null,
    createdAt: d.createdAt.toISOString(),
  }))

  return (
    <ExtractionHub
      initialDocuments={documents}
      templates={templates}
      credits={cabinet?.credits ?? 0}
    />
  )
}
