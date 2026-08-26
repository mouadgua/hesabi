import prisma from '@/lib/prisma'
import { getDemoStats, getDemoLog } from '@/lib/rateLimiter'
import { getAICacheStats } from '@/lib/ai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  UsersIcon, ZapIcon, MailIcon, TrendingUpIcon,
  ActivityIcon, ClockIcon, DollarSignIcon, CheckCircle2Icon,
  XCircleIcon, AlertCircleIcon,
} from 'lucide-react'
import { ExtractionsLineChart, ProviderBarChart } from './AdminOverviewCharts'

// ── Helpers ────────────────────────────────────────────────────────────────────

// Le coût réel de chaque extraction est calculé et stocké au moment du
// traitement (extraction_cost_est, en USD) : il tient compte du fournisseur
// employé et, sur les voies Azure, du nombre de pages facturées.
//
// L'admin recalculait auparavant un forfait à partir des jetons. Deux défauts :
// le tarif unique ne correspondait à aucun fournisseur en particulier, et
// surtout le worker n'a jamais écrit tokens_in / tokens_out — l'écran affichait
// donc invariablement 0,00 DH alors que la dépense réelle était en base.
const DH_PER_USD = 10

function formatDH(n) {
  return `${n.toFixed(2)} DH`
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1); d.setHours(0, 0, 0, 0)
  return d
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function statusColor(statut) {
  switch (statut) {
    case 'VALIDE':      return 'text-[#1D9E75]'
    case 'A_VERIFIER':  return 'text-amber-500'
    case 'EN_COURS_IA': return 'text-blue-500'
    case 'REJETE':      return 'text-red-500'
    default:            return 'text-slate-400'
  }
}

function StatusIcon({ statut }) {
  switch (statut) {
    case 'VALIDE':      return <CheckCircle2Icon className="h-3.5 w-3.5 text-[#1D9E75]" />
    case 'REJETE':      return <XCircleIcon className="h-3.5 w-3.5 text-red-500" />
    case 'EN_COURS_IA': return <ActivityIcon className="h-3.5 w-3.5 text-blue-500" />
    default:            return <AlertCircleIcon className="h-3.5 w-3.5 text-amber-500" />
  }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color = '#1D9E75' }) {
  return (
    <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{value}</p>
            {sub && <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{sub}</p>}
          </div>
          <div className="shrink-0 rounded-xl p-2.5" style={{ backgroundColor: `${color}18` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const monthStart = startOfMonth()
  const thirtyDaysAgo = daysAgo(30)

  const [
    totalUsers,
    activeUsersThisMonth,
    totalExtractions,
    extractionsThisMonth,
    totalCabinets,
    trialCabinets,
    betaKeys,
    avgConfidence,
    recentDocs,
    extractionsByDay,
    providerBreakdown,
    costAgg,
  ] = await Promise.all([
    // Users
    prisma.utilisateur.count(),
    prisma.utilisateur.count({ where: { createdAt: { gte: monthStart } } }),

    // Extractions
    prisma.document.count({ where: { statut: { in: ['A_VERIFIER', 'VALIDE', 'REJETE'] } } }),
    prisma.document.count({ where: { createdAt: { gte: monthStart }, statut: { in: ['A_VERIFIER', 'VALIDE', 'REJETE'] } } }),

    // Cabinets
    prisma.cabinet.count(),
    prisma.cabinet.count({ where: { plan_status: 'TRIAL' } }),

    // Beta keys
    prisma.betaKey.count({ where: { is_active: true } }),

    // Average confidence score
    prisma.document.aggregate({
      _avg: { document_type_confidence: true },
      where: { document_type_confidence: { not: null } },
    }),

    // Recent activity (last 10 docs)
    prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        nom_fichier: true,
        statut: true,
        ai_provider: true,
        createdAt: true,
        client: { select: { cabinet: { select: { nom: true } } } },
      },
    }),

    // Extractions per day — last 30 days
    prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC'), 'DD/MM') AS date,
        COUNT(*)::int AS count
      FROM "Document"
      WHERE "createdAt" >= ${thirtyDaysAgo}
        AND statut IN ('A_VERIFIER','VALIDE','REJETE')
      GROUP BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')
      ORDER BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') ASC
    `,

    // Provider breakdown (last 30 days)
    prisma.$queryRaw`
      SELECT
        COALESCE("ai_provider", 'unknown') AS provider,
        COUNT(*)::int AS count
      FROM "Document"
      WHERE "createdAt" >= ${thirtyDaysAgo}
        AND statut IN ('A_VERIFIER','VALIDE','REJETE')
      GROUP BY "ai_provider"
      ORDER BY count DESC
    `,

    // Coût réel cumulé, tel qu'enregistré à chaque extraction
    prisma.document.aggregate({
      _sum:   { extraction_cost_est: true },
      _count: { extraction_cost_est: true },
    }),
  ])

  // Demo stats from in-memory rate limiter
  const demoStats = getDemoStats()
  const demoLog   = getDemoLog()
  const demoEmails = [...new Set(demoLog.filter(e => e.status === 'SUCCESS').map(e => e.email))]

  // Coût réel cumulé (USD en base) converti en dirhams pour l'affichage.
  const costUsd        = costAgg._sum.extraction_cost_est || 0
  const costedDocs     = costAgg._count.extraction_cost_est || 0
  const estimatedCost  = costUsd * DH_PER_USD

  const avgScore = avgConfidence._avg.document_type_confidence
    ? Math.round(avgConfidence._avg.document_type_confidence * 100)
    : null

  const cacheStats = getAICacheStats()

  // Serialize for client charts
  const chartDays      = extractionsByDay.map(r => ({ date: r.date, count: Number(r.count) }))
  const chartProviders = providerBreakdown.map(r => ({ provider: r.provider, count: Number(r.count) }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Données en temps réel — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={UsersIcon}       label="Utilisateurs"         value={totalUsers}            sub={`+${activeUsersThisMonth} ce mois`}  />
        <KpiCard icon={ZapIcon}         label="Extractions totales"  value={totalExtractions}      sub={`+${extractionsThisMonth} ce mois`}  color="#8B5CF6" />
        <KpiCard icon={MailIcon}        label="Emails démo"          value={demoEmails.length}     sub={`${demoStats.total} tentatives`}     color="#F59E0B" />
        <KpiCard icon={TrendingUpIcon}  label="Score IA moyen"       value={avgScore ? `${avgScore}%` : '—'} sub="confiance classification"  color="#EC4899" />
      </div>

      {/* KPIs row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={UsersIcon}        label="Cabinets"         value={totalCabinets}       sub={`${trialCabinets} en TRIAL`}           color="#3B82F6" />
        <KpiCard icon={ZapIcon}          label="Codes beta actifs" value={betaKeys}            sub="codes non révoqués"                    color="#1D9E75" />
        <KpiCard icon={DollarSignIcon}   label="Coût IA estimé"   value={formatDH(estimatedCost)} sub={`sur ${costedDocs} extraction${costedDocs > 1 ? 's' : ''} mesurée${costedDocs > 1 ? 's' : ''}`} color="#F59E0B" />
        <KpiCard icon={ActivityIcon}     label="Cache IA"         value={`${cacheStats.size}/${cacheStats.max}`} sub="réponses en mémoire" color="#8B5CF6" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Extractions — 30 derniers jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartDays.length > 0
              ? <ExtractionsLineChart data={chartDays} />
              : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Pas encore de données</div>
            }
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Providers IA utilisés — 30 derniers jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartProviders.length > 0
              ? <ProviderBarChart data={chartProviders} />
              : <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Aucune extraction tracée</div>
            }
          </CardContent>
        </Card>
      </div>

      {/* Live activity feed */}
      <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-[#1D9E75]" />
            Activité récente (10 derniers documents)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentDocs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Aucune activité</div>
          ) : (
            <div className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {recentDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <StatusIcon statut={doc.statut} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                      {doc.nom_fichier || 'Document sans nom'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {doc.client?.cabinet?.nom ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.ai_provider && (
                      <Badge variant="outline" className="text-[10px] border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-mono">
                        {doc.ai_provider}
                      </Badge>
                    )}
                    <span className="text-[11px] text-slate-400 tabular-nums flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {new Date(doc.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
