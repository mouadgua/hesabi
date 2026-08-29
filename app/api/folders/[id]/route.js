import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

/**
 * Renommer, déplacer ou supprimer un dossier.
 *
 * Toute recherche passe par la relation client → cabinet : un dossier d'un
 * autre cabinet est introuvable, et non « trouvé puis refusé ». C'est ce qui
 * empêche de renommer ou supprimer par identifiant deviné.
 */

/** Charge un dossier en s'assurant qu'il appartient au cabinet de la session. */
async function chargerDossier(id, cabinetId) {
  return prisma.dossier.findFirst({
    where:  { id, client: { cabinet_id: cabinetId } },
    select: { id: true, nom: true, parent_id: true, client_id: true },
  })
}

async function cabinetDeLaSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const u = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true },
  })
  if (!u?.cabinet_id) return { erreur: NextResponse.json({ error: 'Aucun cabinet' }, { status: 403 }) }
  return { cabinetId: u.cabinet_id }
}

/**
 * Un dossier ne peut pas devenir son propre descendant.
 *
 * Sans ce contrôle, déplacer un dossier dans l'un de ses enfants créerait un
 * cycle : la branche disparaîtrait de l'arborescence, et la reconstruction du
 * fil d'Ariane tournerait jusqu'à sa borne de sécurité à chaque affichage.
 */
async function creeraitUnCycle(idDeplace, nouveauParent, cabinetId) {
  if (!nouveauParent) return false
  if (nouveauParent === idDeplace) return true

  const tous = await prisma.dossier.findMany({
    where:  { client: { cabinet_id: cabinetId } },
    select: { id: true, parent_id: true },
  })
  const parents = new Map(tous.map(d => [d.id, d.parent_id]))

  let courant = nouveauParent
  let garde = 0
  while (courant && garde++ < 200) {
    if (courant === idDeplace) return true
    courant = parents.get(courant) ?? null
  }
  return false
}

export async function PATCH(request, { params }) {
  try {
    const { cabinetId, erreur } = await cabinetDeLaSession()
    if (erreur) return erreur

    const { id } = await params
    const dossier = await chargerDossier(id, cabinetId)
    if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const data = {}

    if (body.nom !== undefined) {
      const nom = sanitizeText(body.nom, 80)
      if (!nom) return NextResponse.json({ error: 'Nom invalide' }, { status: 400 })
      data.nom = nom
    }

    if (body.parent_id !== undefined) {
      const parent = body.parent_id || null
      if (parent) {
        const cible = await chargerDossier(parent, cabinetId)
        if (!cible) return NextResponse.json({ error: 'Dossier de destination introuvable' }, { status: 404 })
        if (cible.client_id !== dossier.client_id) {
          return NextResponse.json({ error: 'Déplacement entre clients impossible' }, { status: 400 })
        }
      }
      if (await creeraitUnCycle(id, parent, cabinetId)) {
        return NextResponse.json({ error: "Un dossier ne peut pas être déplacé dans l'un de ses sous-dossiers." }, { status: 400 })
      }
      data.parent_id = parent
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })
    }

    // updateMany scopé plutôt qu'update par identifiant : la condition de
    // cabinet fait partie de l'écriture, pas d'un contrôle qui la précède.
    const { count } = await prisma.dossier.updateMany({
      where: { id, client: { cabinet_id: cabinetId } },
      data,
    })
    if (count === 0) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.exception('Modification de dossier impossible', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { cabinetId, erreur } = await cabinetDeLaSession()
    if (erreur) return erreur

    const { id } = await params
    const dossier = await chargerDossier(id, cabinetId)
    if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    // Le contenu remonte d'un niveau au lieu d'être supprimé ou abandonné.
    //
    // Les documents ne risquaient rien — la relation est optionnelle, ils
    // seraient simplement détachés. Les sous-dossiers, si : parent_id ne porte
    // aucune clé étrangère en base, ils garderaient donc un parent inexistant
    // et disparaîtraient de l'arborescence, ni à la racine ni ailleurs. Avec
    // les documents qu'ils contiennent.
    const [docs, enfants] = await prisma.$transaction([
      prisma.document.updateMany({ where: { dossier_id: id }, data: { dossier_id: dossier.parent_id } }),
      prisma.dossier.updateMany({ where: { parent_id: id },   data: { parent_id: dossier.parent_id } }),
    ])
    await prisma.dossier.deleteMany({ where: { id, client: { cabinet_id: cabinetId } } })

    return NextResponse.json({
      ok: true,
      documentsDeplaces: docs.count,
      dossiersDeplaces:  enfants.count,
    })
  } catch (err) {
    logger.exception('Suppression de dossier impossible', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
