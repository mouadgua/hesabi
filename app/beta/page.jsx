import FeedbackWizard from '@/components/feedback-wizard'

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
  // Le questionnaire occupe toute la page : un en-tête ici serait recouvert.
  // Il porte son propre titre, sa progression et sa sortie.
  return <FeedbackWizard mode="public" />
}
