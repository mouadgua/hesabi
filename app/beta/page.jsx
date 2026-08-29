import FeedbackWizard from '@/components/feedback-wizard'
import Link from 'next/link'

export const metadata = {
  title: 'Demander un accès',
  description:
    "Rejoignez la bêta d'Hesabi. Quelques questions sur votre cabinet pour préparer votre accès " +
    "et adapter le produit à votre façon de travailler.",
  alternates: { canonical: '/beta' },
}

/**
 * Demande d'accès bêta, ouverte sans compte.
 *
 * Le questionnaire interne est derrière la connexion : un prospect ne peut pas
 * l'atteindre. Cette page sert ce même questionnaire aux visiteurs, amputé des
 * questions sur le produit — on n'y a pas encore touché — et avec l'email en
 * obligatoire, puisqu'il n'y a pas de session pour dire qui écrit.
 */
export default function BetaPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#0d1a11]">
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-2 text-center space-y-2">
        <Link href="/" className="text-sm text-[#1D9E75] hover:underline">← Hesabi</Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Demander un accès à la bêta</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Quelques questions sur votre cabinet. Elles servent à préparer votre accès
          et à savoir ce qu&apos;il faut construire en premier.
        </p>
      </div>
      <FeedbackWizard mode="public" />

      {/* Ceux qui ont déjà reçu une clé ne doivent pas repasser par ici. */}
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 pb-10">
        Vous avez déjà une clé d&apos;accès ?{' '}
        <Link href="/register" className="text-[#1D9E75] hover:underline font-medium">
          Créer votre espace
        </Link>
      </p>
    </main>
  )
}
