import { createClient } from '@/utils/supabase/server'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProfileForm } from "./ProfileForm"
import { PasswordForm } from "./PasswordForm"

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const fullName = user?.user_metadata?.full_name || ''
  const initiale = fullName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Profil Utilisateur</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gérez vos informations personnelles et vos préférences de connexion.
        </p>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Informations générales</CardTitle>
          <CardDescription>
            Ces informations seront visibles par les autres membres de votre cabinet comptable.
          </CardDescription>
        </CardHeader>
        <ProfileForm
          fullName={fullName}
          email={user?.email || ''}
          avatarUrl={user?.user_metadata?.avatar_url}
          initiale={initiale}
        />
      </Card>

      {/* Sécurité — cette section n'existait pas. Changer son mot de passe
          imposait de se déconnecter et de passer par « mot de passe oublié »,
          donc d'attendre un email, sur un chemin dont on vient de découvrir
          qu'il était cassé. */}
      <Card className="border-slate-200 dark:border-white/[0.07] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Sécurité</CardTitle>
          <CardDescription>
            Changez votre mot de passe. Votre mot de passe actuel vous sera demandé.
          </CardDescription>
        </CardHeader>
        <PasswordForm />
      </Card>
    </div>
  )
}
