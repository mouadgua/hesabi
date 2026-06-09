'use server'

import prisma from '@/lib/prisma'
import { requireAdmin, logAdminAction } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

async function getIp() {
  const hdrs = await headers()
  return hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
}

// ── Cabinet / User management ──────────────────────────────────────────────────

export async function suspendCabinetAction(formData) {
  await requireAdmin()
  const cabinetId = formData.get('cabinet_id')
  const reason    = formData.get('reason') || null
  const ip        = await getIp()

  if (!cabinetId) throw new Error('cabinet_id manquant')

  await prisma.cabinet.update({
    where: { id: cabinetId },
    data:  { suspended: true, suspend_reason: reason },
  })

  await logAdminAction('SUSPEND_CABINET', { entity: 'cabinet', entityId: cabinetId, details: { reason }, ip })
  revalidatePath('/admin/users')
}

export async function reactivateCabinetAction(formData) {
  await requireAdmin()
  const cabinetId = formData.get('cabinet_id')
  const ip        = await getIp()

  if (!cabinetId) throw new Error('cabinet_id manquant')

  await prisma.cabinet.update({
    where: { id: cabinetId },
    data:  { suspended: false, suspend_reason: null },
  })

  await logAdminAction('REACTIVATE_CABINET', { entity: 'cabinet', entityId: cabinetId, ip })
  revalidatePath('/admin/users')
}

export async function updateCabinetPlanAction(formData) {
  await requireAdmin()
  const cabinetId   = formData.get('cabinet_id')
  const plan        = formData.get('plan')          || 'PRO'
  const planStatus  = formData.get('plan_status')   || 'TRIAL'
  const creditsLimit = parseInt(formData.get('credits_limit') || '15', 10)
  const credits     = parseInt(formData.get('credits')       || '15', 10)
  const ip          = await getIp()

  if (!cabinetId) throw new Error('cabinet_id manquant')

  await prisma.cabinet.update({
    where: { id: cabinetId },
    data: {
      plan_abonnement: plan,
      plan_status:     planStatus,
      credits_limit:   creditsLimit,
      credits:         credits,
    },
  })

  await logAdminAction('UPDATE_PLAN', {
    entity:   'cabinet',
    entityId: cabinetId,
    details:  { plan, planStatus, creditsLimit, credits },
    ip,
  })
  revalidatePath('/admin/users')
}

export async function adjustCreditsAction(formData) {
  await requireAdmin()
  const cabinetId = formData.get('cabinet_id')
  const delta     = parseInt(formData.get('delta') || '0', 10)
  const ip        = await getIp()

  if (!cabinetId) throw new Error('cabinet_id manquant')

  await prisma.cabinet.update({
    where: { id: cabinetId },
    data:  { credits: { increment: delta } },
  })

  await logAdminAction('ADJUST_CREDITS', {
    entity:   'cabinet',
    entityId: cabinetId,
    details:  { delta },
    ip,
  })
  revalidatePath('/admin/users')
}

export async function deleteCabinetAction(formData) {
  await requireAdmin()
  const cabinetId = formData.get('cabinet_id')
  const ip        = await getIp()

  if (!cabinetId) throw new Error('cabinet_id manquant')

  const cabinet = await prisma.cabinet.findUnique({
    where: { id: cabinetId },
    select: { nom: true },
  })

  await prisma.cabinet.delete({ where: { id: cabinetId } })

  await logAdminAction('DELETE_CABINET', {
    entity:   'cabinet',
    entityId: cabinetId,
    details:  { nom: cabinet?.nom },
    ip,
  })
  revalidatePath('/admin/users')
}

// ── Beta key management ────────────────────────────────────────────────────────

export async function generateBetaKeyAction(formData) {
  await requireAdmin()
  const ip      = await getIp()
  const count   = Math.max(1, Math.min(100, parseInt(formData.get('count') || '1', 10)))
  const credits = parseInt(formData.get('credits') || '15', 10)
  const email   = formData.get('email') || null
  const note    = formData.get('note')  || null
  const expiresRaw = formData.get('expires_at')
  const expires_at = expiresRaw ? new Date(expiresRaw) : null
  const max_uses   = formData.get('max_uses') ? parseInt(formData.get('max_uses'), 10) : 1

  const keys = []
  for (let i = 0; i < count; i++) {
    const key = `HESABI-BETA-${Math.random().toString(36).toUpperCase().slice(2, 10)}`
    keys.push({ key, email, note, credits, expires_at, max_uses, is_active: true })
  }

  await prisma.betaKey.createMany({ data: keys })

  await logAdminAction('GENERATE_BETA_KEYS', {
    entity:  'beta_key',
    details: { count, credits, email, note },
    ip,
  })
  revalidatePath('/admin/beta')
  return keys.map(k => k.key)
}

export async function revokeBetaKeyAction(formData) {
  await requireAdmin()
  const keyId = formData.get('key_id')
  const ip    = await getIp()

  await prisma.betaKey.update({
    where: { id: keyId },
    data:  { is_active: false },
  })

  await logAdminAction('REVOKE_BETA_KEY', { entity: 'beta_key', entityId: keyId, ip })
  revalidatePath('/admin/beta')
}

export async function updateBetaKeyCreditsAction(formData) {
  await requireAdmin()
  const keyId   = formData.get('key_id')
  const credits = parseInt(formData.get('credits') || '15', 10)
  const ip      = await getIp()

  await prisma.betaKey.update({
    where: { id: keyId },
    data:  { credits },
  })

  await logAdminAction('UPDATE_KEY_CREDITS', { entity: 'beta_key', entityId: keyId, details: { credits }, ip })
  revalidatePath('/admin/beta')
}

// ── Global controls ────────────────────────────────────────────────────────────

export async function updateGlobalDefaultCreditsAction(formData) {
  await requireAdmin()
  const credits = parseInt(formData.get('credits') || '15', 10)
  const ip      = await getIp()

  // Update all TRIAL cabinets that haven't been manually adjusted
  // (We treat credits_limit as the admin-controlled default)
  // This is stored as an env-style preference in AdminLog for reference
  await logAdminAction('UPDATE_DEFAULT_CREDITS', {
    entity:  'system',
    details: { default_credits: credits },
    ip,
  })
  revalidatePath('/admin/beta')
  return credits
}
