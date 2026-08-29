import prisma from '@/lib/prisma'
import {
  ClipboardListIcon, UserPlusIcon, MessageSquareIcon,
  WalletIcon, TrendingUpIcon,
} from 'lucide-react'

export const metadata = { title: 'Questionnaire bêta' }

/**
 * Réponses au questionnaire bêta.
 *
 * L'écran est construit pour la décision qu'il doit servir : fixer un prix et
 * un modèle de facturation. Les répartitions viennent donc en premier, le détail
 * ensuite — l'inverse obligerait à lire quarante réponses pour en tirer une
 * moyenne qu'on peut afficher directement.
 *
 * Deux publics dans la même table, distingués par user_id : les demandes
 * d'accès viennent du site public, les retours de comptes existants. Les
 * mélanger fausserait les chiffres — quelqu'un qui n'a jamais utilisé le
 * produit ne juge pas la même chose.
 */

function Repartition({ titre, entrees, total }) {
  if (!entrees.length) return null
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{titre}</h3>
      <div className="space-y-1.5">
        {entrees.map(([label, n]) => {
          const pct = total > 0 ? Math.round((n / total) * 100) : 0
          return (
            <div key={label} className="flex items-center gap-2.5 text-[13px]">
              <span className="w-44 shrink-0 truncate text-slate-600 dark:text-slate-300">{label}</span>
              <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full bg-[#1D9E75]" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">
                {n} · {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, valeur, sous }) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{valeur}</p>
      {sous && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sous}</p>}
    </div>
  )
}

/** Compte les occurrences, du plus fréquent au moins fréquent. */
function compter(valeurs) {
  const m = new Map()
  for (const v of valeurs) {
    if (v === null || v === undefined || v === '') continue
    m.set(v, (m.get(v) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

/** Moyenne d'une échelle, en ignorant les réponses sautées. */
function moyenne(valeurs) {
  const n = valeurs.filter(v => typeof v === 'number')
  if (!n.length) return null
  return (n.reduce((a, b) => a + b, 0) / n.length).toFixed(1)
}

export default async function QuestionnairePage() {
  const toutes = await prisma.betaFeedback.findMany({ orderBy: { createdAt: 'desc' } })

  const demandes = toutes.filter(f => f.user_id === null)
  const retours  = toutes.filter(f => f.user_id !== null)

  const npsMoy       = moyenne(retours.map(f => f.nps))
  const precisionMoy = moyenne(retours.map(f => f.precision_ia))
  const reviewMoy    = moyenne(retours.map(f => f.review_room))

  const budgets      = compter(toutes.map(f => f.budget_mensuel))
  const portefeuille = compter(toutes.map(f => f.portefeuille))
  const paiement     = compter(toutes.map(f => f.pret_a_payer))
  const facturation  = compter(toutes.flatMap(f => f.modele_facturation ?? []))
  const reception    = compter(toutes.flatMap(f => f.reception ?? []))

  const dateFr = d => new Date(d).toLocaleDateString('fr-FR',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Questionnaire bêta</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Demandes d&apos;accès du site public et retours des comptes existants.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Réponses" valeur={toutes.length} sous="toutes origines" />
        <Stat label="Demandes d'accès" valeur={demandes.length} sous="depuis /beta, sans compte" />
        <Stat label="Retours utilisateurs" valeur={retours.length} sous="comptes existants" />
        <Stat label="Recommandation" valeur={npsMoy ? `${npsMoy} / 5` : '—'} sous="moyenne des retours" />
      </div>

      {toutes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.07] p-10 text-center">
          <ClipboardListIcon className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Aucune réponse pour l&apos;instant.</p>
          <p className="mt-1 text-xs text-slate-400">
            Le questionnaire est accessible sur <span className="font-mono">/beta</span> (public)
            et depuis Support (comptes existants).
          </p>
        </div>
      ) : (
        <>
          {/* Répartitions — ce qui sert à décider d'un prix */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] p-5 space-y-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <WalletIcon className="h-4 w-4 text-[#1D9E75]" /> Ce que ça dit du prix
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Repartition titre="Budget mensuel envisagé"   entrees={budgets}     total={toutes.length} />
              <Repartition titre="Prêt à payer à la sortie"  entrees={paiement}    total={toutes.length} />
              <Repartition titre="Modèle de facturation"     entrees={facturation} total={toutes.length} />
              <Repartition titre="Taille du portefeuille"    entrees={portefeuille} total={toutes.length} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] p-5 space-y-6">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <TrendingUpIcon className="h-4 w-4 text-[#1D9E75]" /> Usage et perception
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Stat label="Précision IA"   valeur={precisionMoy ? `${precisionMoy} / 5` : '—'} sous="moyenne" />
              <Stat label="Page vérif."    valeur={reviewMoy ? `${reviewMoy} / 5` : '—'}      sous="intuitivité" />
              <Stat label="Heures/semaine" valeur={moyenne(toutes.map(f => f.heures_saisie)) ?? '—'} sous="saisie manuelle" />
            </div>
            <Repartition titre="Réception des justificatifs" entrees={reception} total={toutes.length} />
          </div>

          {/* Détail — les réponses libres, qui ne s'agrègent pas */}
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <MessageSquareIcon className="h-4 w-4 text-[#1D9E75]" /> Réponses ({toutes.length})
            </h2>

            {toutes.map(f => (
              <div key={f.id} className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {f.nom_complet}
                      {f.cabinet_nom && <span className="font-normal text-slate-400"> · {f.cabinet_nom}</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {f.email ?? '—'} · portefeuille {f.portefeuille}
                      {f.logiciel_actuel && ` · ${f.logiciel_actuel}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border
                      ${f.user_id === null
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                        : 'bg-[#E1F5EE] dark:bg-[#1D9E75]/10 text-[#085041] dark:text-[#1D9E75] border-[#A8DCC9] dark:border-[#1D9E75]/20'}`}>
                      {f.user_id === null ? <UserPlusIcon className="h-2.5 w-2.5" /> : <MessageSquareIcon className="h-2.5 w-2.5" />}
                      {f.user_id === null ? "Demande d'accès" : 'Retour utilisateur'}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{dateFr(f.createdAt)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {f.budget_mensuel && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">Budget : {f.budget_mensuel}</span>}
                  {f.pret_a_payer   && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">{f.pret_a_payer}</span>}
                  {f.nps != null    && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">Recommande : {f.nps}/5</span>}
                  {f.portail_client && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">{f.portail_client}</span>}
                </div>

                {[['Pire expérience', f.pire_experience], ['Surprise', f.surprise], ['Bugs', f.bugs], ['Autres cabinets', f.autres_cabinets]]
                  .filter(([, v]) => v)
                  .map(([label, v]) => (
                    <div key={label} className="text-[13px]">
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider">{label}</span>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{v}</p>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
