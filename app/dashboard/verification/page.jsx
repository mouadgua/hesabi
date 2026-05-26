import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import {
  BellIcon, CheckCircle2Icon, AlertCircleIcon, ClockIcon,
  ChevronRightIcon, SparklesIcon,
} from 'lucide-react'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const NOTIF_CONFIG = {
  A_VERIFIER: {
    Icon: SparklesIcon,
    iconBg: 'bg-amber-100 dark:bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    label: 'À vérifier',
    getMessage: (name) => `${name ?? 'Document'} est prêt à vérifier`,
    cta: 'Vérifier →',
  },
  REJETE: {
    Icon: AlertCircleIcon,
    iconBg: 'bg-red-100 dark:bg-red-500/10',
    iconColor: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    label: 'Rejeté',
    getMessage: (name) => `Erreur d'extraction : ${name ?? 'Document'}`,
    cta: 'Voir →',
  },
  EN_COURS_IA: {
    Icon: ClockIcon,
    iconBg: 'bg-blue-100 dark:bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    label: 'En cours',
    getMessage: (name) => `Extraction IA en cours : ${name ?? 'Document'}`,
    cta: null,
  },
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { cabinet_id: true },
  })
  if (!utilisateur?.cabinet_id) redirect('/onboarding')

  const notifications = await prisma.document.findMany({
    where: {
      client: { cabinet_id: utilisateur.cabinet_id },
      statut: { in: ['A_VERIFIER', 'REJETE', 'EN_COURS_IA'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      nom_fichier: true,
      statut: true,
      error_message: true,
      updatedAt: true,
    },
  })

  const aVerifier = notifications.filter(n => n.statut === 'A_VERIFIER')
  const enErreur = notifications.filter(n => n.statut === 'REJETE')
  const enCours = notifications.filter(n => n.statut === 'EN_COURS_IA')

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/10">
          <BellIcon className="size-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {notifications.length === 0
              ? 'Aucune action en attente'
              : `${notifications.length} notification${notifications.length > 1 ? 's' : ''} en attente`}
          </p>
        </div>
        {notifications.length > 0 && (
          <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-[#1D9E75] text-[11px] font-bold text-white">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl text-center space-y-3">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/[0.05]">
            <CheckCircle2Icon className="size-8 text-[#1D9E75]" />
          </div>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Tout est à jour !</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
            Aucun document n'attend votre attention. Revenez après vos prochaines extractions.
          </p>
          <Link
            href="/dashboard/extraction"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 hover:scale-[0.99]"
          >
            <SparklesIcon className="size-4" /> Lancer une extraction
          </Link>
        </div>
      )}

      {/* Section — À vérifier */}
      {aVerifier.length > 0 && (
        <NotifSection
          title="Prêts à vérifier"
          count={aVerifier.length}
          countColor="bg-amber-500"
          items={aVerifier}
        />
      )}

      {/* Section — Erreurs */}
      {enErreur.length > 0 && (
        <NotifSection
          title="Erreurs d'extraction"
          count={enErreur.length}
          countColor="bg-red-500"
          items={enErreur}
        />
      )}

      {/* Section — En cours */}
      {enCours.length > 0 && (
        <NotifSection
          title="En cours de traitement"
          count={enCours.length}
          countColor="bg-blue-500"
          items={enCours}
        />
      )}
    </div>
  )
}

function NotifSection({ title, count, countColor, items }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100/80 dark:border-white/[0.05] px-5 py-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1">{title}</h2>
        <span className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${countColor}`}>
          {count}
        </span>
      </div>

      <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
        {items.map(item => {
          const cfg = NOTIF_CONFIG[item.statut]
          if (!cfg) return null
          const { Icon, iconBg, iconColor, badge, label, getMessage, cta } = cfg

          return (
            <div key={item.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group">
              {/* Icon */}
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.05] dark:border-white/10 ${iconBg} ${iconColor}`}>
                <Icon className="size-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  {getMessage(item.nom_fichier)}
                </p>
                {item.error_message && (
                  <p className="text-xs text-red-500 dark:text-red-400 truncate">
                    {item.error_message}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${badge}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-600">
                    {timeAgo(item.updatedAt)}
                  </span>
                </div>
              </div>

              {/* CTA */}
              {cta && (
                <Link
                  href={`/dashboard/verification/${item.id}`}
                  className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#1D9E75] hover:text-[#0F6E56] dark:hover:text-[#2DD4A0] transition-colors opacity-0 group-hover:opacity-100"
                >
                  {cta} <ChevronRightIcon className="size-3" />
                </Link>
              )}

              {/* Always visible arrow for mobile */}
              {cta && (
                <Link href={`/dashboard/verification/${item.id}`} className="shrink-0 sm:hidden">
                  <ChevronRightIcon className="size-4 text-slate-400" />
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
