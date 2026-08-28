import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { SparklesIcon, InfoIcon } from "lucide-react"

/**
 * Page Abonnement — réduite à ce qui est vrai aujourd'hui.
 *
 * Elle affichait auparavant tout l'appareil d'une page d'abonnement : nom de
 * plan, tarif, liste de fonctionnalités, bouton « Gérer l'abonnement » désactivé.
 * Rien de tout cela ne correspondait à une réalité — et deux affirmations se
 * contredisaient sur le même écran : « Extractions illimitées » dans la liste
 * des avantages, juste au-dessus d'un compteur plafonné.
 *
 * Ne restent que le nombre d'extractions et l'explication du moment. Le reste
 * reviendra quand il aura un sens, c'est-à-dire quand il y aura un abonnement.
 */
export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let credits = 0
  let creditsLimit = 15
  if (user) {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.id },
      include: { cabinet: { select: { credits: true, credits_limit: true } } },
    })
    credits      = utilisateur?.cabinet?.credits ?? 0
    // Le plafond était écrit en dur à 15. Un cabinet dont le quota avait été
    // ajusté depuis l'administration voyait donc une barre fausse, et pouvait
    // dépasser les 100 %.
    creditsLimit = utilisateur?.cabinet?.credits_limit ?? 15
  }

  const used    = Math.max(0, creditsLimit - credits)
  const percent = creditsLimit > 0 ? Math.min(100, Math.round((credits / creditsLimit) * 100)) : 0
  const low     = credits <= 3

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">

      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Abonnement</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Vos extractions disponibles pendant la bêta.
        </p>
      </div>

      {/* Compteur d'extractions — la seule donnée réelle de cette page */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="h-1 bg-[#1D9E75]" />
        <div className="p-6 space-y-4">

          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <SparklesIcon className="w-5 h-5 text-[#1D9E75]" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Extractions restantes
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-bold tabular-nums ${low ? 'text-red-600' : 'text-[#1D9E75]'}`}>
                {credits}
              </span>
              <span className="text-sm text-slate-400 dark:text-slate-500 tabular-nums">
                / {creditsLimit}
              </span>
            </div>
          </div>

          <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${low ? 'bg-red-400' : 'bg-[#1D9E75]'}`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {used} extraction{used > 1 ? 's' : ''} utilisée{used > 1 ? 's' : ''} sur {creditsLimit}
            {credits === 0
              ? ' — écrivez-nous pour en obtenir davantage.'
              : low
                ? ` — il vous en reste ${credits}, écrivez-nous pour en obtenir davantage.`
                : '.'}
          </p>
        </div>
      </div>

      {/* Explication — sans promesse sur ce que sera la suite */}
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.02] p-4">
        <InfoIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Hesabi est en version bêta
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            L&apos;accès est gratuit et sans carte bancaire. Vos extractions sont
            décomptées du quota ci-dessus ; si vous en manquez, écrivez-nous depuis
            la page Support et nous l&apos;ajusterons. Cette page accueillera la
            gestion de l&apos;abonnement lorsque celui-ci existera.
          </p>
        </div>
      </div>

    </div>
  )
}
