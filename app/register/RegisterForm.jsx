"use client"

import { useState, useRef } from "react"
import { KeyRoundIcon } from "lucide-react"
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

      <button
        formAction={registerUser}
        className="w-full bg-[#1D9E75] hover:opacity-90 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#1D9E75] outline-none text-sm cursor-pointer mt-2"
      >
        Créer mon espace →
      </button>
    </form>
  )
}
