import { createClient } from '@/utils/supabase/server'
import { redirect }     from 'next/navigation'
import prisma           from '@/lib/prisma'
import PlanComptableClient from './PlanComptableClient'

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
  try {
    comptes = await prisma.compteComptable.findMany({
      where: {
        actif: true,
        OR: [{ cabinet_id }, { is_standard: true }],
      },
      orderBy: [{ is_standard: 'asc' }, { code: 'asc' }],
    })
  } catch {
    migrationPending = true
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
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-5 text-sm text-amber-800 dark:text-amber-300 space-y-2">
          <p className="font-semibold">Migration SQL en attente</p>
          <p>Exécutez <code className="font-mono text-xs bg-amber-100 dark:bg-amber-500/10 px-1 rounded">prisma/add_plan_comptable.sql</code> dans l'éditeur SQL Supabase pour activer cette fonctionnalité.</p>
        </div>
      ) : (
        <PlanComptableClient comptes={comptes} cabinetId={cabinet_id} />
      )}
    </div>
  )
}
