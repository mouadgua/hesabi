import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import ClientFileManager from './ClientFileManager'

export default async function ClientFileManagerPage({ params, searchParams }) {
  const resolvedParams = await params
  const clientId = resolvedParams.id

  const resolvedSearchParams = await searchParams
  const dossierFilter = resolvedSearchParams.dossier || null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>Non autorisé</div>

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { onboarding_done: true },
  })

  const documentWhereClause = { dossier_id: dossierFilter ?? null }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      dossiers: { orderBy: { createdAt: 'desc' } },
      documents: {
        where: documentWhereClause,
        orderBy: { createdAt: 'desc' },
        include: { template: true }
      },
      cabinet: { include: { templates: true } }
    }
  })

  if (!client) return <div>Client introuvable</div>

  const creditsRestants = client.cabinet.credits

  const documentsWithUrls = await Promise.all(
    client.documents.map(async (doc) => {
      let signedUrl = null
      if (doc.chemin_storage) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(doc.chemin_storage, 3600)
        signedUrl = data?.signedUrl ?? null
      }
      return {
        id: doc.id,
        nom_fichier: doc.nom_fichier,
        chemin_storage: doc.chemin_storage,
        statut: doc.statut,
        createdAt: doc.createdAt.toISOString(),
        dossier_id: doc.dossier_id,
        client_id: doc.client_id,
        donnees_extraites: doc.donnees_extraites ?? null,
        document_type: doc.document_type ?? null,
        document_type_confidence: doc.document_type_confidence ?? null,
        fournisseur_detecte: doc.fournisseur_detecte ?? null,
        error_message: doc.error_message ?? null,
        template: doc.template ? { id: doc.template.id, nom_modele: doc.template.nom_modele } : null,
        signedUrl,
      }
    })
  )

  const currentDossier = dossierFilter
    ? client.dossiers.find(d => d.id === dossierFilter) ?? null
    : null

  // Serialise client to a plain object (Dates → ISO strings)
  const clientData = {
    id: client.id,
    nom_entreprise: client.nom_entreprise,
    ice: client.ice,
    identifiant_fiscal: client.identifiant_fiscal,
    registre_commerce: client.registre_commerce,
    rib: client.rib,
    ville: client.ville,
    cabinet: {
      id: client.cabinet.id,
      templates: client.cabinet.templates.map(t => ({ id: t.id, nom_modele: t.nom_modele })),
    },
    dossiers: client.dossiers.map(d => ({
      id: d.id,
      nom: d.nom,
      createdAt: d.createdAt.toISOString(),
    })),
  }

  return (
    <ClientFileManager
      client={clientData}
      documents={documentsWithUrls}
      currentDossier={currentDossier ? { id: currentDossier.id, nom: currentDossier.nom, createdAt: currentDossier.createdAt.toISOString() } : null}
      creditsRestants={creditsRestants}
      dossierFilter={dossierFilter}
      onboardingDone={utilisateur?.onboarding_done ?? true}
    />
  )
}
