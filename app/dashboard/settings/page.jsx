import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch" 
import { Badge } from "@/components/ui/badge"
import { BuildingIcon, BotIcon, UsersIcon, FileTextIcon, LandmarkIcon } from "lucide-react"

import CabinetSettingsPage from "./cabinet/page" // Ton composant avec Logo et Nom[cite: 3]
import TeamPage from "../team/page" // Ta page de gestion des collaborateurs[cite: 3]

export default function GeneralSettings() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez votre cabinet, votre équipe et votre moteur d'IA.</p>
      </div>

      <Tabs defaultValue="cabinet" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="cabinet" className="flex items-center gap-2">
            <BuildingIcon className="w-4 h-4" /> Profil Cabinet
          </TabsTrigger>
        </TabsList>

        {/* ONGLET 1 : PROFIL CABINET */}
        <TabsContent value="cabinet">
          <CabinetSettingsPage />
        </TabsContent>

        {/* ONGLET 2 : ÉQUIPE */}
        <TabsContent value="team">
          <TeamPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}