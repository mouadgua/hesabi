import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersIcon, UserPlusIcon, ActivityIcon, ShieldCheckIcon, HistoryIcon } from "lucide-react"

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const currentUser = await prisma.utilisateur.findUnique({
    where: { id: user.id },
  })

  // Sécurité : Seul le boss (Expert-Comptable) peut voir cette page
  if (!currentUser || currentUser.role !== 'EXPERT_COMPTABLE') {
    redirect('/dashboard') // On le renvoie à l'accueil
  }

  // 1. Récupérer tous les collaborateurs du cabinet
  const equipe = await prisma.utilisateur.findMany({
    where: { cabinet_id: currentUser.cabinet_id },
    orderBy: { createdAt: 'asc' }
  })

  // 2. Récupérer le journal d'activité (Audit Logs)
  const logs = await prisma.auditLog.findMany({
    where: { 
      utilisateur: { cabinet_id: currentUser.cabinet_id } 
    },
    include: { utilisateur: true }, // Pour afficher qui a fait l'action
    orderBy: { date: 'desc' },
    take: 50 // On limite aux 50 dernières actions pour la performance
  })

  // Fonction utilitaire pour la couleur des badges de rôle
  const getRoleBadge = (role) => {
    switch (role) {
      case 'EXPERT_COMPTABLE': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">Admin</Badge>
      case 'CHEF_MISSION': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Chef de mission</Badge>
      default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200">Collaborateur</Badge>
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            Gestion de l'équipe
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez les accès de vos collaborateurs et suivez l'activité du cabinet.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <UserPlusIcon className="w-4 h-4 mr-2" /> Inviter un membre
        </Button>
      </div>

      <Tabs defaultValue="membres" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="membres" className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4" /> Membres
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <ActivityIcon className="w-4 h-4" /> Journal d'audit
          </TabsTrigger>
        </TabsList>
        
        {/* ONGLET 1 : LA LISTE DES MEMBRES */}
        <TabsContent value="membres">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Rôle d'accès</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Rejoint le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipe.map((membre) => (
                  <TableRow key={membre.id} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-gray-900">{membre.nom}</span>
                        <span className="text-xs text-gray-500 font-normal">{membre.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(membre.role)}</TableCell>
                    <TableCell>
                      {membre.actif ? (
                        <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full ring-1 ring-inset ring-green-600/20">Actif</span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full ring-1 ring-inset ring-red-600/20">Désactivé</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(membre.createdAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {membre.id !== currentUser.id && (
                        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-600">Gérer</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ONGLET 2 : LE JOURNAL D'ACTIVITÉ */}
        <TabsContent value="logs">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <HistoryIcon className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Aucune activité enregistrée.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action effectuée</TableHead>
                    <TableHead>Détails techniques</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="text-sm hover:bg-gray-50/50">
                      <TableCell className="text-gray-500 whitespace-nowrap">
                        {new Date(log.date).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 flex items-center gap-2">
                        {log.utilisateur.role === 'EXPERT_COMPTABLE' ? (
                          <ShieldCheckIcon className="w-4 h-4 text-purple-600" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-200" />
                        )}
                        {log.utilisateur.nom}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-gray-700">{log.action}</span>
                      </TableCell>
                      <TableCell className="text-gray-500 font-mono text-xs max-w-xs truncate" title={log.details}>
                        {log.details || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

    </div>
  )
}