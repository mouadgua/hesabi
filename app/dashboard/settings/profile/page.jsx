import { createClient } from '@/utils/supabase/server'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
        <CardContent className="space-y-6">
          
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border border-gray-100 shadow-sm">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-blue-50 text-blue-600 text-2xl font-medium">{initiale}</AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm" className="mb-2">Changer l'avatar</Button>
              <p className="text-xs text-gray-500">JPG, GIF ou PNG. 1MB max.</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 pt-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" defaultValue={fullName} placeholder="Ex: Mouad" className="bg-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              {/* L'email est verrouillé pour des raisons de sécurité liées à Supabase */}
              <Input id="email" defaultValue={user?.email} disabled className="bg-gray-50 text-gray-500" />
            </div>
          </div>

        </CardContent>
        <CardFooter className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 flex justify-end">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">Enregistrer les modifications</Button>
        </CardFooter>
      </Card>
    </div>
  )
}