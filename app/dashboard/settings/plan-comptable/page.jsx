import { createClient } from '@/utils/supabase/server'
import { redirect }     from 'next/navigation'
import prisma           from '@/lib/prisma'
import PlanComptableClient from './PlanComptableClient'
import MigrationBanner from './MigrationBanner'

export const metadata = { title: 'Plan comptable — Hesabi' }

export default async function PlanComptablePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const utilisateur = await prisma.utilisateur.findUnique({
    where:  { id: user.id },
    select: { cabinet_id: true },
  })
  if (!utilisateur?.cabinet_id) redirect('/dashboard')

  const { cabinet_id } = utilisateur

  let comptes = []
  let migrationPending = false
  let errorDetail = null
  try {
    comptes = await prisma.compteComptable.findMany({
      where: {
        actif: true,
        OR: [{ cabinet_id }, { is_standard: true }],
      },
      orderBy: [{ is_standard: 'asc' }, { code: 'asc' }],
    })
  } catch (err) {
    migrationPending = true
    errorDetail = err?.message ?? null
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Plan comptable</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consultez les comptes CGNC et gérez les comptes personnalisés de votre cabinet.
        </p>
      </div>

      {migrationPending ? (
        <MigrationBanner sqlPath="prisma/add_plan_comptable.sql" />
      ) : comptes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aucun compte disponible</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Exécutez le script de seed pour importer les 566 comptes CGNC officiels.
          </p>
          <code className="inline-block text-xs font-mono bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
            node prisma/seed-cgnc.js
          </code>
        </div>
      ) : (
        <PlanComptableClient comptes={comptes} cabinetId={cabinet_id} />
      )}
    </div>
  )
}
