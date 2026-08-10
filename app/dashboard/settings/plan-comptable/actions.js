'use server'

import { revalidatePath } from 'next/cache'
import { createClient }   from '@/utils/supabase/server'
import { redirect }       from 'next/navigation'
import prisma             from '@/lib/prisma'

async function getCabinetId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const util = await prisma.utilisateur.findUnique({
    where:  { id: user.id },
    select: { cabinet_id: true },
  })
  if (!util?.cabinet_id) throw new Error('Cabinet introuvable')
  return util.cabinet_id
}

export async function createCompteAction(formData) {
  const cabinet_id = await getCabinetId()

  const code    = formData.get('code')?.trim()
  const libelle = formData.get('libelle')?.trim()
  const classe  = parseInt(formData.get('classe'), 10)

  if (!code || !libelle || isNaN(classe) || classe < 1 || classe > 8) {
    return { error: 'Champs invalides' }
  }

  // Single round trip: reject both a duplicate inside this cabinet and a
  // collision with the shared CGNC standard plan.
  const conflict = await prisma.compteComptable.findFirst({
    where: {
      code,
      OR: [{ cabinet_id }, { is_standard: true }],
    },
    select: { is_standard: true },
  })
  if (conflict) {
    return {
      error: conflict.is_standard
        ? `Le code ${code} est déjà utilisé dans le plan CGNC standard`
        : `Le code ${code} existe déjà dans votre plan`,
    }
  }

  await prisma.compteComptable.create({
    data: {
      cabinet_id,
      code,
      libelle,
      classe,
      actif:       true,
      is_standard: false,
    },
  })

  revalidatePath('/dashboard/settings/plan-comptable')
  return { success: true }
}

export async function updateCompteAction(formData) {
  const cabinet_id = await getCabinetId()

  const id      = formData.get('id')
  const libelle = formData.get('libelle')?.trim()
  const actif   = formData.get('actif') !== 'false'

  if (!id || !libelle) return { error: 'Données invalides' }

  // Security: ensure this compte belongs to this cabinet and is NOT standard
  const compte = await prisma.compteComptable.findFirst({
    where: { id, cabinet_id, is_standard: false },
  })
  if (!compte) return { error: 'Compte introuvable ou non modifiable' }

  await prisma.compteComptable.update({
    where: { id },
    data:  { libelle, actif },
  })

  revalidatePath('/dashboard/settings/plan-comptable')
  return { success: true }
}

export async function toggleActifAction(id, actif) {
  const cabinet_id = await getCabinetId()

  const compte = await prisma.compteComptable.findFirst({
    where: { id, cabinet_id, is_standard: false },
  })
  if (!compte) return { error: 'Compte introuvable ou non modifiable' }

  await prisma.compteComptable.update({
    where: { id },
    data:  { actif },
  })

  revalidatePath('/dashboard/settings/plan-comptable')
  return { success: true }
}

/**
 * Bulk activate / deactivate. Only ever touches this cabinet's own comptes —
 * shared CGNC standards are never modifiable.
 */
export async function setActifBulkAction(ids, actif) {
  const cabinet_id = await getCabinetId()
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'Aucun compte sélectionné' }

  const { count } = await prisma.compteComptable.updateMany({
    where: { id: { in: ids }, cabinet_id, is_standard: false },
    data:  { actif },
  })

  revalidatePath('/dashboard/settings/plan-comptable')
  return { success: true, count }
}

/**
 * Dry run for the delete confirmation dialog: reports which comptes can be
 * deleted and which are blocked, without mutating anything.
 * A compte is blocked when at least one VALIDE document is assigned to it —
 * removing it would strip the account from an already-closed entry.
 */
export async function inspectDeleteAction(ids) {
  const cabinet_id = await getCabinetId()
  if (!Array.isArray(ids) || ids.length === 0) return { deletable: [], blocked: [] }

  const comptes = await prisma.compteComptable.findMany({
    where:  { id: { in: ids }, cabinet_id, is_standard: false },
    select: { id: true, code: true, libelle: true },
  })
  if (comptes.length === 0) return { deletable: [], blocked: [] }

  const ownedIds = comptes.map(c => c.id)

  // Assignments grouped by compte, split on whether the document is closed.
  const links = await prisma.documentCompteComptable.findMany({
    where:  { compte_id: { in: ownedIds } },
    select: { compte_id: true, document: { select: { statut: true } } },
  })

  const valideCount = new Map()
  const detachCount = new Map()
  for (const l of links) {
    const map = l.document?.statut === 'VALIDE' ? valideCount : detachCount
    map.set(l.compte_id, (map.get(l.compte_id) ?? 0) + 1)
  }

  const deletable = []
  const blocked   = []
  for (const c of comptes) {
    const nbValide = valideCount.get(c.id) ?? 0
    if (nbValide > 0) {
      blocked.push({ ...c, documentsValides: nbValide })
    } else {
      deletable.push({ ...c, documentsADetacher: detachCount.get(c.id) ?? 0 })
    }
  }
  return { deletable, blocked }
}

/**
 * Permanently delete cabinet comptes.
 * Refuses any compte assigned to a VALIDE document; for the rest, detaches
 * the pending assignments and drops the learned suggestion preferences first,
 * all in one transaction so a partial delete can't leave dangling rows.
 */
export async function deleteComptesAction(ids) {
  const cabinet_id = await getCabinetId()
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'Aucun compte sélectionné' }

  const comptes = await prisma.compteComptable.findMany({
    where:  { id: { in: ids }, cabinet_id, is_standard: false },
    select: { id: true, code: true },
  })
  if (comptes.length === 0) return { error: 'Aucun compte supprimable dans la sélection' }

  const ownedIds = comptes.map(c => c.id)

  const lockedLinks = await prisma.documentCompteComptable.findMany({
    where:  { compte_id: { in: ownedIds }, document: { statut: 'VALIDE' } },
    select: { compte_id: true },
  })
  const lockedIds = new Set(lockedLinks.map(l => l.compte_id))

  const toDelete = ownedIds.filter(id => !lockedIds.has(id))
  if (toDelete.length === 0) {
    return { error: 'Ces comptes sont utilisés par des écritures validées et ne peuvent pas être supprimés.' }
  }

  await prisma.$transaction([
    prisma.documentCompteComptable.deleteMany({ where: { compte_id: { in: toDelete } } }),
    prisma.cabinetAccountPreference.deleteMany({ where: { compte_id: { in: toDelete } } }),
    prisma.compteComptable.deleteMany({ where: { id: { in: toDelete }, cabinet_id, is_standard: false } }),
  ])

  revalidatePath('/dashboard/settings/plan-comptable')
  return {
    success:      true,
    deletedCount: toDelete.length,
    blockedCount: lockedIds.size,
  }
}
