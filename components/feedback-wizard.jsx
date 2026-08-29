"use client"

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, Loader2Icon, XIcon, SunIcon, MoonIcon,
  UserIcon, ClockIcon, SparklesIcon, WalletIcon, PartyPopperIcon,
} from 'lucide-react'
import { submitBetaFeedback } from '@/app/dashboard/feedback/actions'
import { submitBetaRequest } from '@/app/beta/actions'

/**
 * Questionnaire bêta en quatre temps.
 *
 * Les dix-sept questions tenaient sur une seule page : un mur qu'on abandonne.
 * Elles sont regroupées par sujet — qui vous êtes, comment vous travaillez, ce
 * que vaut le produit, ce que vous seriez prêt à payer — de sorte que chaque
 * écran pose une seule question au lecteur.
 *
 * Les réponses sont conservées dans le navigateur à chaque frappe : quelqu'un
 * qui ferme l'onglet au milieu ne recommence pas de zéro. La clé est effacée à
 * l'envoi.
 */
/**
 * Deux usages, un seul questionnaire.
 *
 *   mode="compte" — depuis l'espace connecté, quatre étapes. L'identité vient
 *                   de la session, et les questions sur le produit ont un sens
 *                   puisque la personne s'en est servie.
 *
 *   mode="public" — depuis le site, sans compte, trois étapes. L'email devient
 *                   obligatoire — c'est le seul moyen de recontacter — et les
 *                   questions sur la précision de l'IA ou la page de
 *                   vérification sont retirées : demander à quelqu'un de noter
 *                   un produit qu'il n'a jamais ouvert ne produit pas une
 *                   donnée, ça produit du bruit.
 */
const DRAFT_BASE = 'hesabi_feedback_draft'

const PORTEFEUILLE = ['<20', '20-50', '50-100', '>100']
const RECEPTION    = ['WhatsApp', 'Email', 'Physique', 'Mélange']
const PORTAIL      = ['Oui (portail client)', 'Non (je préfère tout gérer)', 'Ça dépend du client']
const BUDGET       = ['<200 DH', '200-500 DH', '500-1000 DH', '>1000 DH']
const FACTURATION  = ['Abonnement mensuel fixe', 'Par document traité', 'Par client géré', "À l'usage", "N'importe"]
const PAIEMENT     = ['Oui immédiatement', "Oui après 1 mois d'essai", 'Peut-être', 'Non']

const ETAPE_PROFIL    = { cle: 'profil',   titre: 'Votre cabinet',     sous: 'Pour situer vos réponses',             Icon: UserIcon }
const ETAPE_QUOTIDIEN = { cle: 'quotidien', titre: 'Votre quotidien',   sous: 'Comment vous travaillez aujourd\'hui', Icon: ClockIcon }
const ETAPE_PRODUIT   = { cle: 'produit',  titre: 'Hesabi à l\'usage',  sous: 'Ce qui marche, ce qui ne marche pas',  Icon: SparklesIcon }
const ETAPE_DEMAIN    = { cle: 'demain',   titre: 'Et demain',         sous: 'Ce que vous attendez de la suite',     Icon: WalletIcon }

const STEPS_COMPTE = [ETAPE_PROFIL, ETAPE_QUOTIDIEN, ETAPE_PRODUIT, ETAPE_DEMAIN]
const STEPS_PUBLIC = [ETAPE_PROFIL, ETAPE_QUOTIDIEN, ETAPE_DEMAIN]

// ── Éléments de saisie ────────────────────────────────────────────────────────

function Choice({ label, options, value, onChange, hint }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{label}</legend>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <div className="flex flex-wrap gap-2 pt-0.5">
        {options.map(o => {
          const actif = value === o
          return (
            <button
              key={o} type="button" onClick={() => onChange(actif ? null : o)}
              aria-pressed={actif}
              className={`px-4 py-2.5 rounded-xl text-[14px] border transition-colors cursor-pointer
                ${actif
                  ? 'bg-[#1D9E75] border-[#1D9E75] text-white font-medium'
                  : 'bg-white dark:bg-white/[0.06] border-slate-300 dark:border-white/[0.18] text-slate-700 dark:text-slate-200 hover:border-[#1D9E75] hover:bg-[#1D9E75]/5'}`}
            >
              {o}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function MultiChoice({ label, options, values = [], onChange, hint }) {
  const toggle = o => onChange(values.includes(o) ? values.filter(v => v !== o) : [...values, o])
  return (
    <fieldset className="space-y-2">
      <legend className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{label}</legend>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <div className="flex flex-wrap gap-2 pt-0.5">
        {options.map(o => {
          const actif = values.includes(o)
          return (
            <button
              key={o} type="button" onClick={() => toggle(o)}
              aria-pressed={actif}
              className={`px-4 py-2.5 rounded-xl text-[14px] border transition-colors cursor-pointer inline-flex items-center gap-1.5
                ${actif
                  ? 'bg-[#1D9E75] border-[#1D9E75] text-white font-medium'
                  : 'bg-white dark:bg-white/[0.06] border-slate-300 dark:border-white/[0.18] text-slate-700 dark:text-slate-200 hover:border-[#1D9E75] hover:bg-[#1D9E75]/5'}`}
            >
              {actif && <CheckIcon className="w-3 h-3" />}
              {o}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Scale({ label, min, max, value, onChange, minLabel, maxLabel }) {
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <fieldset className="space-y-2">
      <legend className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{label}</legend>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {points.map(n => {
          const actif = value === n
          return (
            <button
              key={n} type="button" onClick={() => onChange(actif ? null : n)}
              aria-pressed={actif} aria-label={`${label} : ${n}`}
              className={`w-11 h-11 rounded-xl text-[15px] font-semibold border transition-colors cursor-pointer tabular-nums
                ${actif
                  ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                  : 'bg-white dark:bg-white/[0.06] border-slate-300 dark:border-white/[0.18] text-slate-700 dark:text-slate-200 hover:border-[#1D9E75] hover:bg-[#1D9E75]/5'}`}
            >
              {n}
            </button>
          )
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
          <span>{minLabel}</span><span>{maxLabel}</span>
        </div>
      )}
    </fieldset>
  )
}

// Les champs par défaut sont dimensionnés pour un formulaire dense. Ici chaque
// écran ne pose que quelques questions : ils étaient trop petits et leur contour
// trop pâle pour qu'on repère où écrire. Hauteur, taille de texte et contraste
// du contour sont relevés.
const CHAMP = "h-12 text-base rounded-xl border-slate-300 dark:border-white/[0.18] " +
  "bg-white dark:bg-white/[0.06] placeholder:text-slate-400 " +
  "focus-visible:ring-2 focus-visible:ring-[#1D9E75]/40 focus-visible:border-[#1D9E75]"

const ZONE = "text-base rounded-xl border-slate-300 dark:border-white/[0.18] " +
  "bg-white dark:bg-white/[0.06] placeholder:text-slate-400 " +
  "focus-visible:ring-2 focus-visible:ring-[#1D9E75]/40 focus-visible:border-[#1D9E75]"

/**
 * Bascule clair / sombre.
 *
 * Le questionnaire occupe tout l'écran : il masque l'en-tête du site et donc la
 * bascule qui s'y trouve. Sans elle ici, quelqu'un qui remplit le formulaire en
 * plein soleil ne pourrait plus repasser en thème clair.
 *
 * Le rendu est différé jusqu'au montage : le thème n'est connu qu'une fois le
 * navigateur actif, et afficher une icône avant produirait un clignotement au
 * chargement — voire une différence entre serveur et client.
 */
function BasculeTheme() {
  const { theme, setTheme } = useTheme()
  const [monte, setMonte] = useState(false)
  useEffect(() => setMonte(true), [])
  if (!monte) return <span className="h-9 w-9 shrink-0" />

  const sombre = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(sombre ? 'light' : 'dark')}
      aria-label={sombre ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={sombre ? 'Thème clair' : 'Thème sombre'}
      className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
    >
      {sombre ? <SunIcon className="w-5 h-5 text-amber-400" /> : <MoonIcon className="w-5 h-5 text-slate-500" />}
    </button>
  )
}

function Champ({ label, children, hint }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{label}</Label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function FeedbackWizard({ defaultNom = '', mode = 'compte' }) {
  const publik = mode === 'public'
  const STEPS  = publik ? STEPS_PUBLIC : STEPS_COMPTE
  // Brouillons séparés : un visiteur qui crée ensuite un compte ne doit pas
  // retrouver ses réponses publiques préremplies dans le questionnaire interne.
  const draftKey = `${DRAFT_BASE}_${mode}`
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [a, setA] = useState({ nom_complet: defaultNom, reception: [], modele_facturation: [] })

  // Reprise d'un brouillon
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) setA(prev => ({ ...prev, ...JSON.parse(raw) }))
    } catch { /* stockage indisponible — le formulaire marche quand même */ }
  }, [])

  useEffect(() => {
    if (done) return
    try { localStorage.setItem(draftKey, JSON.stringify(a)) } catch { /* idem */ }
  }, [a, done])

  const set = (k, v) => setA(prev => ({ ...prev, [k]: v }))

  // Le premier écran porte les deux seules questions obligatoires : on ne bloque
  // qu'ici, et jamais sur la suite — un retour partiel vaut mieux qu'un abandon.
  const emailValide = !publik || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email?.trim() ?? '')
  const premierEcranComplet = Boolean(a.nom_complet?.trim() && a.portefeuille && emailValide)
  const dernier = step === STEPS.length - 1

  // Quitter renvoie là d'où l'on vient : le tableau de bord pour un compte,
  // l'accueil pour un visiteur. Le brouillon reste en mémoire, donc revenir
  // reprend là où on s'était arrêté.
  function quitter() {
    router.push(publik ? '/' : '/dashboard')
  }

  async function envoyer() {
    setSending(true)
    const res = publik ? await submitBetaRequest(a) : await submitBetaFeedback(a)
    setSending(false)
    if (!res?.ok) { toast.error(res?.error ?? 'Envoi impossible.'); return }
    try { localStorage.removeItem(draftKey) } catch {}
    setDone(true)
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0d1a11] text-center px-6 space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E1F5EE] dark:bg-[#1D9E75]/15">
          <PartyPopperIcon className="w-7 h-7 text-[#1D9E75]" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Merci — c&apos;est enregistré.</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Vos réponses servent directement à décider de la suite : ce qu&apos;on corrige
          en premier, et à quel prix Hesabi sortira de la bêta.
        </p>
        <Button className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white mt-2"
          onClick={quitter}>
          {publik ? "Retour à l'accueil" : 'Retour au tableau de bord'}
        </Button>
      </div>
    )
  }

  // Les écrans sont désignés par leur clé et non par leur rang : en mode
  // public « demain » est la 3e étape et non la 4e, un index se décalerait.
  const { titre, sous, Icon, cle } = STEPS[step]

  return (
    // Plein écran plutôt qu'une carte au milieu : dix-sept questions dans un
    // encart étroit donnent l'impression d'un formulaire administratif. En
    // occupant la page, chaque étape respire et se lit comme une seule question.
    //
    // Trois zones : l'en-tête et le pied restent en place, seul le contenu
    // défile. La progression et les boutons ne disparaissent donc jamais, même
    // sur l'étape la plus longue.
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50 dark:bg-[#0d1a11]">

      {/* En-tête */}
      <header className="shrink-0 border-b border-slate-200/70 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1F5EE] dark:bg-[#1D9E75]/15">
              <Icon className="w-5 h-5 text-[#1D9E75]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{titre}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{sous}</p>
            </div>
            <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0 hidden sm:inline">
              Étape {step + 1} / {STEPS.length}
            </span>
            <BasculeTheme />

            {/* Quitter — les réponses sont déjà en mémoire, donc partir ne coûte
                rien. Le dire évite qu'on remplisse par crainte de tout perdre. */}
            <button
              type="button"
              onClick={quitter}
              title="Quitter — vos réponses sont conservées"
              className="shrink-0 p-2 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors
                ${i <= step ? 'bg-[#1D9E75]' : 'bg-slate-200 dark:bg-white/[0.08]'}`} />
            ))}
          </div>
        </div>
      </header>

      {/* Contenu — seule zone qui défile */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">

        {cle === 'profil' && (
          <>
            <Champ label="Nom complet *">
              <Input className={CHAMP} value={a.nom_complet ?? ''} onChange={e => set('nom_complet', e.target.value)}
                placeholder="Mouad Guarraz" />
            </Champ>
            {/* Piège à robots. Retiré du flux et de l'ordre de tabulation, et
                annoncé comme tel aux lecteurs d'écran : un humain ne le voit ni
                ne l'atteint, un automate le remplit parce qu'il lit le HTML. */}
            {publik && (
              <input
                type="text" name="site_web" tabIndex={-1} autoComplete="off"
                aria-hidden="true"
                value={a.site_web ?? ''} onChange={e => set('site_web', e.target.value)}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />
            )}

            {publik && (
              <Champ label="Email *" hint="C'est par là qu'on vous enverra votre accès.">
                <Input className={CHAMP} type="email" value={a.email ?? ''} onChange={e => set('email', e.target.value)}
                  placeholder="contact@cabinet.ma" />
              </Champ>
            )}
            <Champ label="Nom du cabinet">
              <Input className={CHAMP} value={a.cabinet_nom ?? ''} onChange={e => set('cabinet_nom', e.target.value)}
                placeholder="Fiduciaire Atlas" />
            </Champ>
            <Choice label="Taille de votre portefeuille clients *"
              options={PORTEFEUILLE} value={a.portefeuille} onChange={v => set('portefeuille', v)} />
            <Champ label="Logiciel comptable actuel">
              <Input className={CHAMP} value={a.logiciel_actuel ?? ''} onChange={e => set('logiciel_actuel', e.target.value)}
                placeholder="Sage, Ciel, Excel…" />
            </Champ>
          </>
        )}

        {cle === 'quotidien' && (
          <>
            <MultiChoice label="Comment recevez-vous les justificatifs aujourd'hui ?"
              hint="Plusieurs réponses possibles"
              options={RECEPTION} values={a.reception} onChange={v => set('reception', v)} />
            <Scale label="Combien d'heures par semaine passez-vous à saisir des factures ?"
              min={1} max={11} value={a.heures_saisie} onChange={v => set('heures_saisie', v)}
              minLabel="très peu" maxLabel="énorme" />
            <Champ label="Décrivez votre pire expérience avec la saisie de factures"
              hint="C'est souvent là qu'on apprend le plus">
              <Textarea className={ZONE} rows={4} value={a.pire_experience ?? ''}
                onChange={e => set('pire_experience', e.target.value)}
                placeholder="Un lot de 300 factures reçues la veille de la clôture…" />
            </Champ>
          </>
        )}

        {cle === 'produit' && (
          <>
            <Scale label="De 0 à 5, recommanderiez-vous Hesabi à un confrère ?"
              min={0} max={5} value={a.nps} onChange={v => set('nps', v)}
              minLabel="jamais" maxLabel="sans hésiter" />
            <Scale label="L'extraction IA était-elle suffisamment précise ?"
              min={1} max={5} value={a.precision_ia} onChange={v => set('precision_ia', v)}
              minLabel="beaucoup d'erreurs" maxLabel="parfait" />
            <Scale label="La page de vérification est-elle intuitive ?"
              min={1} max={5} value={a.review_room} onChange={v => set('review_room', v)}
              minLabel="perdu" maxLabel="évident" />
            <Champ label="Qu'est-ce qui vous a le plus surpris ?">
              <Textarea className={ZONE} rows={3} value={a.surprise ?? ''} onChange={e => set('surprise', e.target.value)}
                placeholder="En bien comme en mal." />
            </Champ>
            <Champ label="Y a-t-il eu des bugs ou des moments de blocage ?">
              <Textarea className={ZONE} rows={3} value={a.bugs ?? ''} onChange={e => set('bugs', e.target.value)}
                placeholder="Même un détail agaçant nous intéresse." />
            </Champ>
          </>
        )}

        {cle === 'demain' && (
          <>
            <Choice label="Préféreriez-vous que vos clients déposent eux-mêmes leurs factures ?"
              options={PORTAIL} value={a.portail_client} onChange={v => set('portail_client', v)} />
            <Choice label="Quel budget mensuel seriez-vous prêt à allouer à Hesabi ?"
              options={BUDGET} value={a.budget_mensuel} onChange={v => set('budget_mensuel', v)} />
            <MultiChoice label="Quel modèle de facturation préférez-vous ?"
              hint="Plusieurs réponses possibles"
              options={FACTURATION} values={a.modele_facturation} onChange={v => set('modele_facturation', v)} />
            <Choice label="Seriez-vous prêt à payer dès la sortie officielle ?"
              options={PAIEMENT} value={a.pret_a_payer} onChange={v => set('pret_a_payer', v)} />
            <Champ label="Connaissez-vous d'autres cabinets que ça intéresserait ?">
              <Input className={CHAMP} value={a.autres_cabinets ?? ''} onChange={e => set('autres_cabinets', e.target.value)}
                placeholder="Un nom, un contact — sans engagement" />
            </Champ>
          </>
        )}
        </div>
      </div>

      {/* Pied fixe — les boutons restent atteignables sans avoir à faire
          défiler jusqu'en bas d'une étape longue. */}
      <footer className="shrink-0 border-t border-slate-200/70 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            {/* À la première étape, « Précédent » ne mène nulle part : il devient
                la sortie, ce qui évite un bouton mort dans le coin de l'écran. */}
            <Button variant="outline" disabled={sending}
              onClick={() => (step === 0 ? quitter() : setStep(s => s - 1))} className="gap-1.5">
              <ArrowLeftIcon className="w-4 h-4" /> {step === 0 ? 'Quitter' : 'Précédent'}
            </Button>

            <span className="text-xs text-slate-400 tabular-nums sm:hidden">
              {step + 1} / {STEPS.length}
            </span>

            {dernier ? (
              <Button onClick={envoyer} disabled={sending || !premierEcranComplet}
                className="gap-1.5 bg-[#1D9E75] hover:bg-[#0F6E56] text-white">
                {sending ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {sending ? 'Envoi…' : 'Envoyer mes réponses'}
              </Button>
            ) : (
              <Button onClick={() => setStep(s => s + 1)}
                disabled={step === 0 && !premierEcranComplet}
                className="gap-1.5 bg-[#1D9E75] hover:bg-[#0F6E56] text-white">
                Suivant <ArrowRightIcon className="w-4 h-4" />
              </Button>
            )}
          </div>

          <p className="text-[11px] text-center text-slate-400">
            {step === 0 && !premierEcranComplet
              ? (publik ? 'Nom, email et portefeuille sont requis pour continuer.' : 'Nom et portefeuille sont requis pour continuer.')
              : 'Vos réponses sont enregistrées au fur et à mesure — vous pouvez quitter et revenir.'}
          </p>
        </div>
      </footer>
    </div>
  )
}
