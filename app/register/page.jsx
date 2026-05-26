import Link from 'next/link'
import { CheckCircle2Icon, SparklesIcon } from 'lucide-react'
import RegisterForm from './RegisterForm'

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams
  const errorMsg   = params?.error   ? decodeURIComponent(params.error)   : null
  const successMsg = params?.success ? decodeURIComponent(params.success) : null

  if (successMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafcff] p-6">
        <div className="w-full max-w-md rounded-2xl border border-[#A8DCC9] bg-[#E1F5EE] p-10 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1D9E75]">
              <CheckCircle2Icon className="size-7 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-[#085041]">Vérifiez votre email</h1>
          <p className="text-sm text-[#1D9E75]/80">{successMsg}</p>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-all">
            Aller à la connexion
          </Link>
        </div>
      </div>
    )
  }

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
                <SparklesIcon className="size-6 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accès bêta Hesabi</h1>
            <p className="text-sm text-slate-500">Saisissez votre clé d'accès pour rejoindre la bêta.</p>
          </div>

          <RegisterForm errorMsg={errorMsg} />

          <p className="text-center text-sm text-slate-500">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-[#1D9E75] font-semibold hover:opacity-80 transition-opacity">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
