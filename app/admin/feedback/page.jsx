import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquarePlusIcon, TrendingUpIcon } from "lucide-react"

const DOC_TYPE_LABELS = {
  facture: "Facture",
  releve_bancaire: "Relevé bancaire",
  bon_commande: "Bon de commande",
  recu: "Reçu",
  autre: "Autre",
}

export default async function AdminFeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { role: true },
  })

  if (!utilisateur || utilisateur.role !== 'EXPERT_COMPTABLE') {
    redirect('/dashboard')
  }

  // Aggregate: count per (document_type, field_name), sorted by count desc
  const raw = await prisma.missingFieldRequest.groupBy({
    by: ['document_type', 'field_name'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })

  const total = await prisma.missingFieldRequest.count()

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquarePlusIcon className="w-6 h-6 text-indigo-500" />
            Champs signalés comme manquants
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Suggestions de vos utilisateurs pour enrichir l'extraction IA. {total} signalement{total !== 1 ? "s" : ""} au total.
          </p>
        </div>
      </div>

      {raw.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquarePlusIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Aucun feedback reçu pour l'instant.</p>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUpIcon className="w-4 h-4" />
              Classement par popularité
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50 text-xs uppercase tracking-wider text-gray-400">
                  <th className="text-left px-6 py-3 font-medium">Champ demandé</th>
                  <th className="text-left px-4 py-3 font-medium">Type de document</th>
                  <th className="text-right px-6 py-3 font-medium">Signalements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {raw.map((row, i) => (
                  <tr key={`${row.document_type}-${row.field_name}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-amber-500 text-xs">🥇</span>}
                        {i === 1 && <span className="text-gray-400 text-xs">🥈</span>}
                        {i === 2 && <span className="text-amber-700 text-xs">🥉</span>}
                        {row.field_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
                        {DOC_TYPE_LABELS[row.document_type] ?? row.document_type}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                        row._count.id >= 5
                          ? "bg-red-100 text-red-700"
                          : row._count.id >= 3
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                      }`}>
                        {row._count.id}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
