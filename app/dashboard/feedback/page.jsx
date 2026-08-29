import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import FeedbackWizard from '@/components/feedback-wizard'

export const metadata = { title: 'Votre avis' }

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Le nom est pré-rempli depuis le compte : le redemander alors qu'on le
  // connaît donne l'impression d'un formulaire qui ne sait rien de vous.
  const utilisateur = await prisma.utilisateur.findUnique({
    where:  { id: user.id },
    select: { nom: true },
  })

  return <FeedbackWizard defaultNom={utilisateur?.nom ?? ''} />
}
