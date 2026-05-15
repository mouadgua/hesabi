import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip, TooltipContent, TooltipTrigger
} from "@/components/ui/tooltip"
import {
  CheckCircle2Icon, SparklesIcon, LockIcon,
  PartyPopperIcon, ZapIcon, BuildingIcon, CrownIcon
} from "lucide-react"

const FUTURE_PLANS = [
  {
    name: 'Starter',
    price: '199 DH',
    description: 'Pour les cabinets en démarrage',
    features: ['3 utilisateurs', '200 extractions/mois', 'Export Excel', 'Support email'],
    highlight: false,
  },
  {
    name: 'Expert Comptable',
    price: '499 DH',
    description: 'Idéal pour un cabinet établi',
    features: ['5 utilisateurs', 'Extractions illimitées', 'Modèles personnalisés', 'Support prioritaire', 'API access'],
    highlight: true,
  },
  {
    name: 'Cabinet Pro',
    price: '999 DH',
    description: 'Pour les grands cabinets',
    features: ['Utilisateurs illimités', 'Extractions illimitées', 'Intégration Sage/Cegid', 'SLA garanti', 'Formation incluse'],
    highlight: false,
  },
]

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
    <div className="max-w-3xl mx-auto w-full space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Abonnement & Facturation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gérez l'abonnement de votre cabinet et consultez vos extractions restantes.
        </p>
      </div>

      {/* Beta banner */}
      <div className="flex items-start gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
        <PartyPopperIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-emerald-800 text-sm">
            Bêta gratuite — Toutes les fonctionnalités, gratuitement.
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Votre cabinet est automatiquement sur le plan <strong>Expert Comptable</strong> pendant la bêta.
            Profitez-en sans engagement ni carte bancaire.
          </p>
        </div>
      </div>

      {/* Current plan card */}
      <Card className="border-indigo-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />

        <CardHeader className="pb-4">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Plan Bêta Gratuit
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold tracking-wide">
                  BÊTA
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Accès complet Expert Comptable. Valable jusqu'à la fin de la période bêta.
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900 line-through opacity-30">499 DH</span>
                <span className="text-lg font-bold text-emerald-600">Gratuit</span>
              </div>
              <span className="text-xs text-gray-400">pendant la bêta</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Features */}
          <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Inclus dans votre plan actuel :</h4>
            <ul className="grid sm:grid-cols-2 gap-2.5 text-sm text-gray-600">
              {[
                'Dossiers clients illimités',
                'Extraction IA des factures',
                'Export vers logiciels comptables',
                "Jusqu'à 5 collaborateurs",
                'Modèles d\'extraction personnalisés',
                'Historique complet',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Credits counter */}
          <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-900">Extractions restantes (Bêta)</span>
              </div>
              <span className={`text-lg font-bold ${credits > 3 ? 'text-indigo-700' : 'text-red-600'}`}>
                {credits} / 15
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${credits > 3 ? 'bg-indigo-500' : 'bg-red-400'}`}
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
            <p className="text-xs text-indigo-600 mt-1.5">
              {credits === 0
                ? 'Crédits épuisés — nouvelles extractions bloquées.'
                : credits <= 3
                  ? `Plus que ${credits} extraction${credits > 1 ? 's' : ''} — contactez-nous pour en obtenir plus.`
                  : 'Les crédits seront illimités après la bêta.'}
            </p>
          </div>
        </CardContent>

        <CardFooter className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <LockIcon className="w-3.5 h-3.5" />
            Aucune carte bancaire requise pendant la bêta
          </p>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">
                    Mettre à jour la carte
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Disponible après la bêta</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button className="bg-gray-900 text-white hover:bg-gray-800 opacity-50 cursor-not-allowed" disabled>
                    Gérer l'abonnement
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Disponible après la bêta</TooltipContent>
            </Tooltip>
          </div>
        </CardFooter>
      </Card>

      {/* Post-beta plans preview */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ZapIcon className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-700">Après la bêta — Aperçu des tarifs</h2>
          <Badge variant="outline" className="text-gray-400 border-gray-200 text-xs">Preview</Badge>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {FUTURE_PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-5 space-y-4 ${
                plan.highlight
                  ? 'border-indigo-300 bg-indigo-50/40 shadow-sm'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Votre plan actuel
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  {plan.highlight ? (
                    <CrownIcon className="w-4 h-4 text-indigo-500" />
                  ) : (
                    <BuildingIcon className="w-4 h-4 text-gray-400" />
                  )}
                  <h3 className="font-semibold text-gray-900 text-sm">{plan.name}</h3>
                </div>
                <p className="text-xs text-gray-500">{plan.description}</p>
              </div>

              <div>
                <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-xs text-gray-400"> / mois</span>
              </div>

              <ul className="space-y-1.5 text-xs text-gray-600">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <CheckCircle2Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <Button
                      size="sm"
                      disabled
                      className={`w-full cursor-not-allowed opacity-60 ${
                        plan.highlight
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      Choisir ce plan
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Disponible après la bêta</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
