import prisma from '@/lib/prisma'
import { getDemoLog, getDemoStats } from '@/lib/rateLimiter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart2Icon, SmartphoneIcon, MonitorIcon, ActivityIcon } from 'lucide-react'

function Stat({ label, value, sub }) {
  return (
    <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03]">
      <CardContent className="p-5">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default async function AdminVisitsPage() {
  const [siteVisits, demoAttempts] = await Promise.all([
    prisma.siteVisit.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.demoAttempt.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  ])

  const demoStats = getDemoStats()
  const demoLog   = getDemoLog()

  const mobileCount  = siteVisits.filter(v => v.device === 'mobile').length
  const desktopCount = siteVisits.filter(v => v.device === 'desktop').length
  const uniqueIps    = new Set(siteVisits.map(v => v.ip_hash).filter(Boolean)).size
  const dbUniqueEmails = new Set(demoAttempts.map(a => a.email))
  const recentLog = demoLog.slice(0, 20)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Visits & Demo</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Trafic site + activité de la démo</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
          <BarChart2Icon className="h-4 w-4 text-[#1D9E75]" /> Visites site
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Visites totales" value={siteVisits.length} sub="depuis l'activation du tracking" />
          <Stat label="Visiteurs uniques" value={uniqueIps} sub="par IP hashée" />
          <Stat label="hesabi.ma" value={siteVisits.filter(v => v.site === 'main').length} />
          <Stat label="demo.hesabi.ma" value={siteVisits.filter(v => v.site === 'demo').length} />
        </div>
        {siteVisits.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.07] p-5 text-center text-sm text-slate-400">
            Aucune visite enregistrée. Appelez{' '}
            <code className="bg-slate-100 dark:bg-white/10 px-1 rounded text-xs">POST /api/track-visit</code>{' '}
            depuis vos pages marketing pour commencer le tracking.
          </div>
        )}
        {(mobileCount + desktopCount) > 0 && (
          <div className="mt-3 flex gap-5 text-sm text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5"><SmartphoneIcon className="h-4 w-4 text-slate-400" /> Mobile : <strong>{mobileCount}</strong></span>
            <span className="flex items-center gap-1.5"><MonitorIcon className="h-4 w-4 text-slate-400" /> Desktop : <strong>{desktopCount}</strong></span>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-[#1D9E75]" /> Démo
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Extractions réussies" value={demoStats.total} sub="en mémoire (depuis restart)" />
          <Stat label="Tentatives bloquées" value={demoStats.blocked} sub="rate limit" />
          <Stat label="Emails uniques (mém.)" value={demoStats.uniqueEmails} />
          <Stat label="Emails en DB" value={dbUniqueEmails.size} sub="persistés après démo" />
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-[#1D9E75]" />
            Activité démo récente
            <span className="text-[10px] font-normal text-slate-400">(en mémoire — réinitialisé au restart)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentLog.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Aucune activité</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/[0.05] text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2 text-left font-medium">Heure</th>
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-left font-medium">Statut</th>
                    <th className="px-4 py-2 text-left font-medium">Type doc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-white/[0.03]">
                  {recentLog.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">
                        {new Date(e.ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 text-[13px] text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{e.email}</td>
                      <td className="px-4 py-2">
                        <Badge className={`text-[10px] border-0 ${e.status === 'SUCCESS' ? 'bg-[#E1F5EE] text-[#085041] dark:bg-[#1D9E75]/20 dark:text-[#1D9E75]' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-[12px] text-slate-500">{e.docType ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
