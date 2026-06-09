"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2Icon } from "lucide-react"
import { updateProfileAction } from "./actions"

export function ProfileForm({ fullName, email, avatarUrl, initiale }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData) {
    startTransition(async () => {
      try {
        await updateProfileAction(formData)
        toast.success("Profil mis à jour")
      } catch (err) {
        toast.error(err.message || "Erreur lors de la mise à jour")
      }
    })
  }

  return (
    <form action={handleSubmit}>
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20 border border-gray-100 shadow-sm">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-blue-50 text-blue-600 text-2xl font-medium">{initiale}</AvatarFallback>
          </Avatar>
          <div>
            <Button variant="outline" size="sm" className="mb-2" type="button" disabled>Changer l'avatar</Button>
            <p className="text-xs text-gray-500">JPG, GIF ou PNG. 1MB max.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 pt-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={fullName}
              placeholder="Ex: Mouad"
              className="bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              defaultValue={email}
              disabled
              className="bg-gray-50 text-gray-500"
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 flex justify-end">
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={isPending}
        >
          {isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </CardFooter>
    </form>
  )
}
