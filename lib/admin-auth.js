/**
 * lib/admin-auth.js
 *
 * Server-side admin identity guard.
 * Call requireAdmin() at the top of every /api/admin/* route and admin Server Action.
 * Middleware (proxy.js) already blocks non-admins — this is defense-in-depth.
 */

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

export { ADMIN_EMAIL } from '@/lib/admin-email'
import { ADMIN_EMAIL } from '@/lib/admin-email'


export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || user.email !== ADMIN_EMAIL) {
    throw new Error('UNAUTHORIZED')
  }

  return user
}

/**
 * Logs an admin action to the AdminLog table.
 * Non-throwing — failures go to stderr only.
 */
export async function logAdminAction(action, { entity, entityId, details, ip } = {}) {
  try {
    await prisma.adminLog.create({
      data: {
        action,
        entity:    entity    ?? null,
        entity_id: entityId  ?? null,
        details:   details   ?? null,
        ip:        ip        ?? null,
      },
    })
  } catch (err) {
    console.error('[AdminLog] Failed to write log:', err.message)
  }
}
