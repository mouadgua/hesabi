"use client"

import { useState, useRef } from "react"
import { KeyRoundIcon , TriangleAlertIcon } from "lucide-react"
import { registerUser } from "./actions"

export default function RegisterForm({ errorMsg }) {
  const [confirmError, setConfirmError] = useState(null)
  const formRef = useRef(null)

  function handleSubmit(e) {
    const form = formRef.current
    const password = form.password.value
    const confirm = form.confirm_password.value
    if (password !== confirm) {
      e.preventDefault()
      setConfirmError("Les mots de passe ne correspondent pas.")
    } else {
      setConfirmError(null)
    }
  }

  const inputClass = "w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] outline-none transition-all"
  const labelClass = "block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider"

  return (
    <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>

      {/* Beta key */}
      <div className="rounded-xl border border-[#A8DCC9] bg-[#E1F5EE]/40 p-4 space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[#085041] uppercase tracking-wider" htmlFor="beta_key">
          <KeyRoundIcon className="size-3.5" />
          Clé d'accès bêta
        </label>
        <input
          id="beta_key" name="beta_key" type="text"
          placeholder="FC-XXXX-XXXX-XXXX"
          autoComplete="off" spellCheck="false"
          className="w-full bg-white border border-[#A8DCC9] px-3 py-2.5 rounded-lg text-sm font-mono text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] outline-none transition-all tracking-widest"
          style={{ textTransform: "uppercase" }}
          required
        />
        <p className="text-[11px] text-[#1D9E75]/70">Reçue de l'équipe Hesabi. Usage unique.</p>
      </div>

      {/* Name */}
      <div>
        <label className={labelClass} htmlFor="nom">Nom complet</label>
        <input id="nom" name="nom" type="text" placeholder="Mouad Guarraz" className={inputClass} required />
      </div>

      {/* Email */}
      <div>
        <label className={labelClass} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="contact@cabinet.ma" className={inputClass} required />
      </div>

      {/* Password */}
      <div>
        <label className={labelClass} htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" placeholder="••••••••" minLength={6} className={inputClass} required />
      </div>

      {/* Confirm password */}
      <div>
        <label className={labelClass} htmlFor="confirm_password">Confirmer le mot de passe</label>
        <input
          id="confirm_password" name="confirm_password" type="password"
          placeholder="••••••••" minLength={6}
          className={`${inputClass} ${confirmError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
          required
        />
        {confirmError && (
          <p className="mt-1 text-xs text-red-500">{confirmError}</p>
        )}
      </div>

      {/* Server error */}
      {errorMsg && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Avertissement bêta — placé avant le bouton, pas après l'inscription :
          quelqu'un doit pouvoir renoncer avant d'avoir créé un compte, pas
          l'apprendre une fois ses documents déjà téléversés. La case est
          obligatoire, et le serveur la revérifie : sans quoi une requête forgée
          contournerait l'avertissement et il ne resterait aucune trace de
          l'avoir présenté. */}
      {/* Avertissement bêta — placé avant le bouton, pas après l'inscription :
          quelqu'un doit pouvoir renoncer avant d'avoir créé un compte, pas
          l'apprendre une fois ses documents déjà téléversés. La case est
          obligatoire, et le serveur la revérifie : sans quoi une requête forgée
          contournerait l'avertissement et il ne resterait aucune trace de
          l'avoir présenté.

          Le bloc était entièrement ambre. Sur une page blanche à accent vert,
          c'était le seul élément chaud : il attirait l'œil comme une erreur
          plutôt que comme une consigne à lire. Le signal tient maintenant à
          l'icône et à une phrase mise en avant ; le reste suit la neutralité du
          formulaire, ce qui le rend aussi plus lisible. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 mt-2">
        <div className="flex items-center gap-2">
          <TriangleAlertIcon className="size-3.5 shrink-0 text-amber-500" />
          <p className="text-xs font-semibold text-slate-800">
            Version bêta — à lire avant de créer votre espace
          </p>
        </div>

        <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 marker:text-slate-300">
          <li>
            Les documents que vous téléversez (factures, reçus, relevés) sont
            <strong className="font-semibold text-slate-800"> conservés sur nos serveurs</strong> afin
            d&apos;être traités et de vous être restitués.
          </li>
          <li>
            <strong className="font-semibold text-slate-800">N&apos;utilisez pas de documents
            contenant des données sensibles ou confidentielles</strong> : cette période sert à
            éprouver le produit. Préférez des pièces de test ou déjà publiques.
          </li>
          <li>
            Le service est en cours de test : des interruptions, des pertes de
            données ou des erreurs d&apos;extraction restent possibles. Ne vous en
            servez pas comme source unique pour votre comptabilité.
          </li>
        </ul>

        <label htmlFor="beta_ack" className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/80 mt-1">
          <input
            id="beta_ack" name="beta_ack" type="checkbox" required
            className="mt-2.5 h-4 w-4 shrink-0 cursor-pointer accent-[#1D9E75] rounded"
          />
          <span className="text-xs text-slate-700 leading-snug pt-2">
            J&apos;ai lu et compris ces conditions, et je m&apos;engage à ne pas
            téléverser de documents sensibles pendant la bêta.
          </span>
        </label>
      </div>

      <button
        formAction={registerUser}
        className="w-full bg-[#1D9E75] hover:opacity-90 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#1D9E75] outline-none text-sm cursor-pointer mt-2"
      >
        Créer mon espace →
      </button>
    </form>
  )
}
