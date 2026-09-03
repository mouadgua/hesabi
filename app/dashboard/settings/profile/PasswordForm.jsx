"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Loader2Icon, EyeIcon, EyeOffIcon } from "lucide-react"
import { changePasswordAction } from "./actions"

/**
 * Changement de mot de passe depuis l'espace connecté.
 *
 * Il fallait auparavant se déconnecter et passer par « mot de passe oublié »,
 * donc attendre un email — un détour absurde quand on est déjà authentifié.
 *
 * Un seul bouton d'affichage pour les trois champs plutôt qu'un par champ :
 * quelqu'un qui veut relire ce qu'il tape veut relire l'ensemble, et trois
 * petits yeux alignés encombrent plus qu'ils n'aident.
 */
export function PasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [visible, setVisible] = useState(false)
  const [erreur, setErreur] = useState(null)

  function handleSubmit(formData) {
    setErreur(null)
    startTransition(async () => {
      // L'action renvoie son erreur au lieu de la lever : le message d'une
      // exception dans une Server Action n'arrive pas jusqu'ici en production.
      // Le try/catch reste pour les pannes réseau, qui elles remontent bien.
      let res
      try {
        res = await changePasswordAction(formData)
      } catch {
        res = { ok: false, error: "Connexion perdue. Réessayez." }
      }

      if (!res?.ok) {
        const message = res?.error || "Erreur lors du changement de mot de passe"
        setErreur(message)
        toast.error(message)
        return
      }

      toast.success("Mot de passe modifié.")
      // Vidage du formulaire : laisser les champs remplis après un
      // changement réussi invite à renvoyer par mégarde.
      document.getElementById("password-form")?.reset()
    })
  }

  const type = visible ? "text" : "password"

  return (
    <form id="password-form" action={handleSubmit}>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Mot de passe actuel</Label>
          <Input
            id="currentPassword" name="currentPassword" type={type}
            autoComplete="current-password" required className="bg-white dark:bg-white/[0.04]"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nouveau mot de passe</Label>
            <Input
              id="newPassword" name="newPassword" type={type}
              autoComplete="new-password" minLength={8} required
              className="bg-white dark:bg-white/[0.04]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer</Label>
            <Input
              id="confirmPassword" name="confirmPassword" type={type}
              autoComplete="new-password" minLength={8} required
              className="bg-white dark:bg-white/[0.04]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#1D9E75] transition-colors cursor-pointer"
        >
          {visible ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
          {visible ? "Masquer les mots de passe" : "Afficher les mots de passe"}
        </button>

        {erreur && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-3 py-2">
            {erreur}
          </p>
        )}
      </CardContent>

      <CardFooter className="bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.06] px-6 py-4 flex justify-end">
        <Button
          type="submit"
          className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white"
          disabled={isPending}
        >
          {isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Modification…" : "Changer le mot de passe"}
        </Button>
      </CardFooter>
    </form>
  )
}
