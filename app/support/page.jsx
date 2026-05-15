import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MailIcon, MessageCircleIcon, LifeBuoyIcon, ClockIcon, ArrowLeftIcon } from "lucide-react"

export default function SupportPage() {
  // Remplace ces variables par tes vraies informations
  const monEmail = "ton-email@cabinet.com"
  const monWhatsApp = "212600000000" // Format international sans le '+'
  const messagePredefini = "Bonjour, j'ai besoin d'aide concernant le logiciel Mycompta."

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 p-4 md:p-8">
      
      {/* 👈 NOUVEAU : BOUTON DE RETOUR */}
      <div className="flex items-center">
        <Link href="/dashboard">
          <Button variant="ghost" className="text-gray-500 hover:text-gray-900 -ml-4">
            <ArrowLeftIcon className="w-4 h-4 mr-2" /> Retour au tableau de bord
          </Button>
        </Link>
      </div>

      {/* En-tête de la page */}
      <div className="text-center space-y-2 mt-2">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <LifeBuoyIcon className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Comment pouvons-nous vous aider ?
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Notre équipe technique est à votre disposition pour répondre à toutes vos questions et vous accompagner dans l'utilisation de la plateforme.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 pt-8">
        
        {/* CARTE WHATSAPP */}
        <Card className="border-green-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageCircleIcon className="w-6 h-6 text-green-500" />
              Assistance WhatsApp
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Pour les questions rapides ou les urgences. Nous répondons généralement en quelques minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 w-fit px-3 py-1.5 rounded-md">
              <ClockIcon className="w-4 h-4 text-green-600" />
              Lundi - Vendredi • 09:00 - 18:00
            </div>
            
            <a 
              href={`https://wa.me/${monWhatsApp}?text=${encodeURIComponent(messagePredefini)}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white text-base h-12">
                Discuter sur WhatsApp
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* CARTE EMAIL */}
        <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MailIcon className="w-6 h-6 text-blue-500" />
              Support par Email
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Idéal pour les demandes détaillées, l'envoi de captures d'écran ou les questions techniques.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 w-fit px-3 py-1.5 rounded-md">
              <ClockIcon className="w-4 h-4 text-blue-600" />
              Réponse sous 24h ouvrées
            </div>

            <a 
              href={`mailto:${monEmail}?subject=Demande de support - Application`} 
              className="block w-full"
            >
              <Button variant="outline" className="w-full border-2 border-blue-600 text-blue-700 hover:bg-blue-50 text-base h-12">
                Envoyer un email
              </Button>
            </a>
          </CardContent>
        </Card>

      </div>

      {/* Section FAQ ou astuces */}
      <div className="mt-12 bg-gray-50 border border-gray-200 rounded-2xl p-6 md:p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Avant de nous contacter
        </h3>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          Assurez-vous de capturer une image complète de votre écran si vous rencontrez une erreur (incluant l'URL de la page) pour que nous puissions résoudre le problème plus rapidement.
        </p>
      </div>

    </div>
  )
}