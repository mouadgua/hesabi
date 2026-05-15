"use client"

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClientAction } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  UsersIcon, FileTextIcon, CheckSquareIcon, BoxesIcon,
  MoreVerticalIcon, FolderOpenIcon, TrashIcon, PlusIcon,
  Loader2Icon, BuildingIcon
} from "lucide-react"

// ─── Skeleton row ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
      <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></td>
    </tr>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyClients({ onAdd }) {
  return (
    <tr>
      <td colSpan={4}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none" className="mb-5 opacity-40">
            <circle cx="50" cy="38" r="22" fill="#e0e7ff" />
            <circle cx="50" cy="38" r="14" fill="#c7d2fe" />
            <circle cx="50" cy="38" r="8" fill="white" />
            <ellipse cx="50" cy="78" rx="32" ry="12" fill="#e0e7ff" />
            <ellipse cx="50" cy="78" rx="22" ry="8" fill="#c7d2fe" />
            <path d="M30 78 C 30 66 70 66 70 78" fill="white" />
          </svg>
          <h3 className="text-lg font-bold text-gray-700 mb-2">Aucun client pour l'instant</h3>
          <p className="text-sm text-gray-400 mb-5 max-w-xs">
            Ajoutez votre premier client pour commencer à gérer vos extractions documentaires.
          </p>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            onClick={onAdd}
          >
            <PlusIcon className="w-4 h-4" /> Ajouter votre premier client
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardHome({ stats, clients }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [newClientOpen, setNewClientOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Keyboard shortcut Ctrl+N → open new client dialog
  useEffect(() => {
    const handler = () => setNewClientOpen(true)
    document.addEventListener('app:new-client', handler)
    return () => document.removeEventListener('app:new-client', handler)
  }, [])

  const handleCreateClient = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setIsCreating(true)
    const id = toast.loading('Création du client…')
    try {
      await createClientAction(fd)
      toast.success('Client créé avec succès !', { id })
      setNewClientOpen(false)
      e.currentTarget?.reset()
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la création', { id })
    } finally {
      setIsCreating(false)
    }
  }

  const { totalClients, totalModeles, documentsAVerifier, documentsExtraits } = stats

  return (
    <div className="p-6 md:p-8 space-y-8 bg-gray-50/50 min-h-[calc(100vh-80px)]">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vue d'ensemble</h1>
          <p className="text-gray-500 mt-1">Gérez vos clients et vos flux d'extraction automatisés.</p>
        </div>
        <Button
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-2"
          onClick={() => setNewClientOpen(true)}
        >
          <PlusIcon className="w-4 h-4" /> Nouveau Client
          <kbd className="ml-1 text-[10px] text-indigo-300 bg-indigo-700/50 border border-indigo-500/50 rounded px-1">⌘N</kbd>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Clients Actifs', value: totalClients, icon: UsersIcon, color: 'text-indigo-600' },
          { label: 'À Vérifier (Inbox)', value: documentsAVerifier, icon: CheckSquareIcon, color: 'text-orange-500', sub: 'Extractions terminées', subColor: 'text-orange-600' },
          { label: 'Documents Validés', value: documentsExtraits, icon: FileTextIcon, color: 'text-green-500', sub: 'Prêts à exporter', subColor: 'text-gray-400' },
          { label: "Modèles d'Extraction", value: totalModeles, icon: BoxesIcon, color: 'text-purple-500', sub: 'Presets configurés', subColor: 'text-gray-400' },
        ].map(({ label, value, icon: Icon, color, sub, subColor }) => (
          <Card key={label} className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
              <Icon className={`w-4 h-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              {sub && <p className={`text-xs mt-1 font-medium ${subColor}`}>{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client list */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="border-b border-gray-100 pb-4">
          <CardTitle className="text-lg">Portefeuille Clients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/50 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Nom de l'entreprise</th>
                  <th className="px-6 py-4 font-medium">ICE</th>
                  <th className="px-6 py-4 font-medium">Documents à vérifier</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                ) : clients.length === 0 ? (
                  <EmptyClients onAdd={() => setNewClientOpen(true)} />
                ) : (
                  clients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-gray-900">{client.nom_entreprise}</td>
                      <td className="px-6 py-4 text-gray-500">{client.ice || 'Non renseigné'}</td>
                      <td className="px-6 py-4">
                        {client.pendingDocs > 0 ? (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                            {client.pendingDocs} en attente
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none">
                            <MoreVerticalIcon className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Gestion du client</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <Link href={`/dashboard/clients/${client.id}`}>
                              <DropdownMenuItem className="cursor-pointer font-medium text-indigo-600">
                                <FolderOpenIcon className="w-4 h-4 mr-2" /> Voir l'espace
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                              onClick={() => setDeleteTarget(client)}
                            >
                              <TrashIcon className="w-4 h-4 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New client dialog */}
      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BuildingIcon className="w-5 h-5 text-indigo-600" /> Ajouter un nouveau client
            </DialogTitle>
            <DialogDescription>
              Renseignez les données maîtresses du client. L'IA les utilisera pour vérifier la conformité des futures factures.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClient} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="nom_entreprise">Nom de l'entreprise *</Label>
              <Input id="nom_entreprise" name="nom_entreprise" placeholder="Ex: Acme Corp" required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ice">ICE</Label>
                <Input id="ice" name="ice" placeholder="15 chiffres" maxLength={15} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="identifiant_fiscal">Identifiant Fiscal (IF)</Label>
                <Input id="identifiant_fiscal" name="identifiant_fiscal" placeholder="Ex: 12345678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registre_commerce">Registre de Commerce (RC)</Label>
                <Input id="registre_commerce" name="registre_commerce" placeholder="Ex: 45678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rib">RIB Principal</Label>
                <Input id="rib" name="rib" placeholder="24 chiffres" maxLength={24} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="adresse">Adresse de facturation</Label>
                <Input id="adresse" name="adresse" placeholder="123 rue de la paix…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ville">Ville</Label>
                <Input id="ville" name="ville" placeholder="Ex: Rabat" />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2"
              disabled={isCreating}
            >
              {isCreating
                ? <><Loader2Icon className="w-4 h-4 mr-2 animate-spin" /> Création en cours…</>
                : 'Enregistrer le client'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer <strong>{deleteTarget?.nom_entreprise}</strong> ainsi que tous ses documents.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                toast.info('Suppression de client à implémenter.')
                setDeleteTarget(null)
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
