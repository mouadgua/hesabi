import Link from 'next/link'
import { login, signInWithGoogle } from './actions'

// Ajout de 'async' pour Next.js 15
export default async function LoginPage({ searchParams }) {
  // Déballage de la promesse pour éviter l'erreur dans le terminal
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        
        {/* En-tête */}
        <div className="mb-8 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">
            Bon retour
          </h1>
          <p className="text-sm text-gray-500">
            Connectez-vous à votre espace cabinet.
          </p>
        </div>

        {/* Bouton Google */}
        <form action={signInWithGoogle} className="mb-6">
          <button className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 rounded-xl transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-gray-100 outline-none">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>
        </form>

        {/* Séparateur */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute border-t border-gray-200 w-full"></div>
          <span className="bg-white px-4 text-xs font-medium text-gray-400 relative z-10">OU</span>
        </div>

        {/* Formulaire Classique */}
        <form className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="email">
              Adresse Email
            </label>
            <input
              className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm text-gray-900 focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-400 shadow-sm"
              id="email"
              name="email"
              type="email"
              placeholder="contact@cabinet.ma"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="password">
              Mot de passe
            </label>
            <input
              className="w-full bg-white border border-gray-300 px-4 py-2.5 rounded-xl text-sm text-gray-900 focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-400 shadow-sm"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Messages d'erreur */}
          {params?.message && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl text-center">
              {params.message}
            </div>
          )}

          <button
            formAction={login}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 outline-none"
          >
            Se connecter
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Pas encore de compte ?{' '}
          <Link href="/register" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
            Créer un espace
          </Link>
        </p>

      </div>
    </div>
  )
}