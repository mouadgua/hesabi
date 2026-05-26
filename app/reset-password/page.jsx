"use client"

import { useState, useRef } from 'react'
import Link from 'next/link'
import { KeyRoundIcon } from 'lucide-react'
import { updatePassword } from './actions'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ResetForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') ? decodeURIComponent(searchParams.get('error')) : null
  const [confirmError, setConfirmError] = useState(null)
  const formRef = useRef(null)

  function handleSubmit(e) {
    const password = formRef.current.password.value
    const confirm = formRef.current.confirm.value
    if (password !== confirm) {
      e.preventDefault()
      setConfirmError('Les mots de passe ne correspondent pas.')
    } else {
      setConfirmError(null)
    }
  }

  const inputClass = "w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] outline-none transition-all"

  return (
    <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider" htmlFor="password">
          Nouveau mot de passe
        </label>
        <input
          id="password" name="password" type="password"
          placeholder="••••••••" minLength={6}
          className={inputClass} required autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider" htmlFor="confirm">
          Confirmer le mot de passe
        </label>
        <input
          id="confirm" name="confirm" type="password"
          placeholder="••••••••" minLength={6}
          className={`${inputClass} ${confirmError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
          required
        />
        {confirmError && <p className="mt-1 text-xs text-red-500">{confirmError}</p>}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>{error}</span>
        </div>
      )}

      <button
        formAction={updatePassword}
        className="w-full bg-[#1D9E75] hover:opacity-90 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all text-sm cursor-pointer mt-2"
      >
        Enregistrer le nouveau mot de passe →
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafcff] p-6">
      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-300/20 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-200/20 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-8 sm:p-10 space-y-6">

          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1D9E75]">
                <KeyRoundIcon className="size-6 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nouveau mot de passe</h1>
            <p className="text-sm text-slate-500">Choisissez un mot de passe sécurisé d'au moins 6 caractères.</p>
          </div>

          <Suspense fallback={null}>
            <ResetForm />
          </Suspense>

          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="text-[#1D9E75] font-semibold hover:opacity-80 transition-opacity">
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
