'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2Icon, ArrowRightIcon, BuildingIcon, UserIcon } from "lucide-react"
import { setupWorkspace } from './actions' // La fonction qu'on va créer juste après

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // On stocke les données des étapes
  const [formData, setFormData] = useState({
    nomComplet: '',
    nomCabinet: ''
  })

  const handleNext = () => setStep(2)
  const handleBack = () => setStep(1)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    // Appel de la Server Action pour sauvegarder dans Prisma
    await setupWorkspace(formData)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg">
        
        {/* Indicateur d'étapes (Stepper) */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
            1
          </div>
          <div className={`w-16 h-1 mx-2 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
            2
          </div>
        </div>

        <Card className="border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          
          {/* ÉTAPE 1 : Profil Utilisateur */}
          {step === 1 && (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <UserIcon className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Bienvenue sur la plateforme</CardTitle>
                <CardDescription>Commençons par configurer votre profil d'expert.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Comment doit-on vous appeler ?</Label>
                  <Input 
                    id="nom" 
                    placeholder="Ex: Mouad Guarraz" 
                    value={formData.nomComplet}
                    onChange={(e) => setFormData({...formData, nomComplet: e.target.value})}
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50/50 border-t border-gray-100 px-6 py-4">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700" 
                  onClick={handleNext}
                  disabled={formData.nomComplet.length < 2}
                >
                  Continuer <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* ÉTAPE 2 : Création du Cabinet */}
          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <BuildingIcon className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Votre Cabinet</CardTitle>
                <CardDescription>Créez l'espace de travail pour votre équipe.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="cabinet">Nom du cabinet comptable</Label>
                  <Input 
                    id="cabinet" 
                    placeholder="Ex: Fiduciaire Atlas" 
                    value={formData.nomCabinet}
                    onChange={(e) => setFormData({...formData, nomCabinet: e.target.value})}
                    autoFocus
                  />
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 mt-4">
                  <CheckCircle2Icon className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-900">
                    Vous serez automatiquement assigné comme <strong>Expert-Comptable</strong> (Administrateur) de ce cabinet.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 flex gap-3">
                <Button type="button" variant="outline" className="w-1/3" onClick={handleBack}>
                  Retour
                </Button>
                <Button 
                  type="submit" 
                  className="w-2/3 bg-blue-600 hover:bg-blue-700" 
                  disabled={formData.nomCabinet.length < 2 || isLoading}
                >
                  {isLoading ? "Création en cours..." : "Terminer et Démarrer"}
                </Button>
              </CardFooter>
            </form>
          )}

        </Card>
      </div>
    </div>
  )
}