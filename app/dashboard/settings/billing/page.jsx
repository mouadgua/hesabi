import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { Button } from "@/components/ui/button"
import {
  Tooltip, TooltipContent, TooltipTrigger
} from "@/components/ui/tooltip"
import {
  CheckCircle2Icon, SparklesIcon, LockIcon,
  PartyPopperIcon,
} from "lucide-react"

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let credits = 0
  if (user) {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.id },
      include: { cabinet: { select: { credits: true } } },
    })
    credits = utilisateur?.cabinet?.credits ?? 0
  }

  const creditsPercent = Math.min(100, Math.round((credits / 15) * 100))

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Abonnement</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consultez vos extractions restantes et votre plan actuel.
        </p>
      </div>

      {/* Beta banner */}
      <div className="flex items-start gap-3 bg-[#E1F5EE] dark:bg-[#1D9E75]/10 border border-[#A8DCC9] dark:border-[#1D9E75]/20 rounded-2xl p-4">
        <PartyPopperIcon className="w-5 h-5 text-[#1D9E75] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#085041] dark:text-[#1D9E75] text-sm">
            Bêta gratuite — Toutes les fonctionnalités, gratuitement.
          </p>
          <p className="text-xs text-[#1D9E75]/80 dark:text-[#1D9E75]/60 mt-0.5">
            Votre cabinet bénéficie d'un accès complet pendant la bêta, sans engagement ni carte bancaire.
          </p>
        </div>
      </div>

      {/* Plan card */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="h-1 bg-[#1D9E75]" />

        <div className="p-6 space-y-5">
          {/* Plan name */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Plan Bêta Gratuit</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[#E1F5EE] dark:bg-[#1D9E75]/10 text-[#085041] dark:text-[#1D9E75] border border-[#A8DCC9] dark:border-[#1D9E75]/20">
              BÊTA
            </span>
            <span className="ml-auto text-lg font-bold text-[#1D9E75]">Gratuit</span>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 -mt-3">
            Accès complet. Valable jusqu'à la fin de la période bêta.
          </p>

          {/* Features */}
          <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Inclus :</p>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300">
              {[
                'Extractions illimitées',
                'Extraction IA (Gemini 2.5 Flash)',
                'Export Excel & CSV',
                "Modèles d'extraction personnalisés",
                'Historique complet',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2Icon className="w-4 h-4 text-[#1D9E75] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Credits counter */}
          <div className="border border-[#A8DCC9] dark:border-[#1D9E75]/20 rounded-xl p-4 bg-[#E1F5EE]/40 dark:bg-[#1D9E75]/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-[#1D9E75]" />
                <span className="text-sm font-semibold text-[#085041] dark:text-[#1D9E75]">
                  Extractions restantes
                </span>
              </div>
              <span className={`text-lg font-bold ${credits > 3 ? 'text-[#1D9E75]' : 'text-red-600'}`}>
                {credits} / 15
              </span>
            </div>
            <div className="h-2 bg-[#A8DCC9]/40 dark:bg-[#1D9E75]/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${credits > 3 ? 'bg-[#1D9E75]' : 'bg-red-400'}`}
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
            <p className="text-xs text-[#1D9E75]/70 dark:text-[#1D9E75]/60 mt-1.5">
              {credits === 0
                ? 'Crédits épuisés — contactez-nous pour en obtenir plus.'
                : credits <= 3
                  ? `Plus que ${credits} extraction${credits > 1 ? 's' : ''} — contactez-nous pour en obtenir plus.`
                  : 'Les crédits seront illimités après la bêta.'}
            </p>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <LockIcon className="w-3.5 h-3.5" />
              Aucune carte bancaire requise pendant la bêta
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">
                    Gérer l'abonnement
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Disponible après la bêta</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

    </div>
  )
}
