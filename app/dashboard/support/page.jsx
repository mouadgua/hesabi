"use client"

import { useState } from "react"
import { ChevronDownIcon, MailIcon, PhoneIcon, SparklesIcon, ClipboardListIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const FAQ = [
  {
    q: "Comment uploader un dossier complet ?",
    a: "Sur la page Extraction, cliquez sur « Dossier complet ». Votre navigateur vous permet de sélectionner un dossier — tous les fichiers qu'il contient (et ses sous-dossiers) sont uploadés en conservant la hiérarchie originale.",
  },
  {
    q: "Quelle est la différence entre IA Libre et un modèle ?",
    a: "L'IA Libre laisse Gemini décider quels champs extraire — utile pour découvrir la structure d'un nouveau type de document. Un modèle personnalisé lui indique exactement quels champs chercher (ex : montant_ht, fournisseur, date_facture), ce qui donne des résultats plus précis et homogènes.",
  },
  {
    q: "Comment exporter en Excel ?",
    a: "Sur la page de vérification d'un document (après extraction), cliquez sur « Exporter ». Vous pouvez choisir les colonnes à inclure et le format (Excel ou CSV). Les données de type tableau sont automatiquement placées dans un onglet séparé.",
  },
  {
    q: "Que faire si l'extraction est incorrecte ?",
    a: "Corrigez directement les champs dans la page de vérification — chaque correction est mémorisée. Après 3 corrections identiques sur le même champ, Hesabi apprend votre préférence et l'applique automatiquement aux prochaines extractions du même type de document.",
  },
  {
    q: "Comment créer un modèle personnalisé ?",
    a: "Rendez-vous sur la page Modèles. Vous pouvez créer un modèle en saisissant manuellement les noms de champs, ou en laissant l'IA analyser un exemple de document pour suggérer une structure.",
  },
]

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-100/80 dark:border-white/[0.05] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03] cursor-pointer"
      >
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{q}</span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function SupportPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">

      {/* Beta banner */}
      <div className="flex items-center gap-3 rounded-xl border border-[#1D9E75]/20 bg-[#E1F5EE] dark:bg-[#1D9E75]/10 dark:border-[#1D9E75]/20 px-4 py-3">
        <SparklesIcon className="size-4 shrink-0 text-[#1D9E75]" />
        <p className="text-sm text-[#085041] dark:text-[#1D9E75]">
          Vous utilisez la version bêta — vos retours nous aident à améliorer le produit.
        </p>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100/80 dark:border-white/[0.05] px-5 py-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Questions fréquentes</h2>
        </div>
        {FAQ.map((item) => (
          <AccordionItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>

      {/* Feedback form */}
      <div className="rounded-2xl border border-[#1D9E75]/20 dark:border-[#1D9E75]/20 bg-[#E1F5EE]/50 dark:bg-[#1D9E75]/5 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1D9E75]/15">
            <ClipboardListIcon className="size-4 text-[#1D9E75]" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">Donnez votre avis</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              2 minutes pour nous aider à améliorer Hesabi. Vos retours sont lus et pris en compte.
            </p>
            <a
              href="https://forms.gle/votre-form-id"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-2 text-[13px] font-medium text-white transition-all hover:opacity-90"
            >
              <ClipboardListIcon className="size-4" />
              Remplir le formulaire de feedback
            </a>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm px-5 py-5">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Nous contacter</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Vous ne trouvez pas ce que vous cherchez ? Notre équipe répond sous 24h.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:mouadguarraz@gmail.com"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-2 text-[13px] font-medium text-white transition-all hover:opacity-90 hover:scale-[0.99]"
          >
            <MailIcon className="size-4" /> mouadguarraz@gmail.com
          </a>
          <a
            href="https://wa.me/212674451180"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#1D9E75]/30 bg-[#E1F5EE] dark:bg-[#1D9E75]/10 px-4 py-2 text-[13px] font-medium text-[#085041] dark:text-[#1D9E75] transition-all hover:opacity-90 hover:scale-[0.99]"
          >
            <PhoneIcon className="size-4" /> WhatsApp : +212 6 74 45 11 80
          </a>
        </div>
      </div>
    </div>
  )
}
