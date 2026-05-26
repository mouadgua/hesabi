import Link from 'next/link'
import { SparklesIcon } from 'lucide-react'
import { login } from './actions'

export default async function LoginPage({ searchParams }) {
  const params = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafcff] p-6">

      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-300/20 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-200/20 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-8 sm:p-10 space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1D9E75]">
                <SparklesIcon className="size-6 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bon retour</h1>
            <p className="text-sm text-slate-500">Connectez-vous à votre espace cabinet.</p>
          </div>

          {/* Form */}
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider" htmlFor="email">
                Email
              </label>
              <input
                id="email" name="email" type="email"
                placeholder="contact@cabinet.ma"
                className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] outline-none transition-all"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="password">
                  Mot de passe
                </label>
                <Link href="/forgot-password" className="text-xs text-[#1D9E75] hover:opacity-80 transition-opacity">
                  Mot de passe oublié ?
                </Link>
              </div>
              <input
                id="password" name="password" type="password"
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] outline-none transition-all"
                required
              />
            </div>

            {params?.message && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{params.message}</span>
              </div>
            )}

            <button
              formAction={login}
              className="w-full bg-[#1D9E75] hover:opacity-90 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#1D9E75] outline-none text-sm cursor-pointer mt-2"
            >
              Se connecter →
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-[#1D9E75] font-semibold hover:opacity-80 transition-opacity">
              Créer un espace
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}