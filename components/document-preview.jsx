"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Loader2Icon, ExternalLinkIcon, SparklesIcon, Trash2Icon,
  AlertCircleIcon, FileTextIcon, CheckCircle2Icon,
} from 'lucide-react'

/**
 * Aperçu d'un document, avec les actions qui s'y rapportent.
 *
 * Le lien n'est pas construit côté navigateur : le bucket est privé, et c'est
 * le serveur qui vérifie l'appartenance au cabinet avant de signer une URL
 * valable cinq minutes. Le composant ne connaît donc jamais le chemin de
 * stockage réel — il ne peut pas servir à en deviner d'autres.
 *
 * Le lien est demandé à l'ouverture et non au chargement de la liste : signer
 * une URL pour chaque ligne affichée reviendrait à créer des dizaines d'accès
 * temporaires pour un document que personne ne regardera.
 */
export default function DocumentPreview({ doc, open, onClose, onExtract, onDelete, onVerify }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  // Sert à relancer manuellement après un échec, sans dupliquer la logique.
  const [attempt, setAttempt] = useState(0)
  const docId = doc?.id

  // Le chargement vit dans l'effet plutôt que dans une fonction mémoïsée : le
  // compilateur React ne pouvait pas préserver la mémoïsation d'un useCallback
  // qui écrit dans un état, et le signalait comme une erreur. Un effet dépendant
  // de l'identifiant exprime la même intention sans ce détour.
  useEffect(() => {
    if (!open || !docId) return
    let annule = false

    setState({ loading: true, error: null, data: null })
    fetch(`/api/documents/${docId}/preview`)
      .then(async res => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `Erreur ${res.status}`)
        }
        return res.json()
      })
      .then(data => { if (!annule) setState({ loading: false, error: null, data }) })
      .catch(err => { if (!annule) setState({ loading: false, error: err.message, data: null }) })

    // Sans ce drapeau, fermer puis rouvrir vite ferait écrire une réponse
    // périmée par-dessus la nouvelle.
    return () => { annule = true }
  }, [open, docId, attempt])

  const data      = state.data
  const canExtract = doc?.statut === 'A_EXTRAIRE' || doc?.statut === 'REJETE'
  const canVerify  = doc?.statut === 'A_VERIFIER' || doc?.statut === 'VALIDE'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose?.()}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-slate-200 dark:border-white/[0.08]">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold pr-8 min-w-0">
            <FileTextIcon className="w-4 h-4 text-[#1D9E75] shrink-0" />
            <span className="truncate">{doc?.nom_fichier ?? 'Document'}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Zone d'aperçu — hauteur fixe pour que la barre d'actions ne saute pas
            entre le chargement et l'affichage. */}
        <div className="bg-slate-100 dark:bg-black/40 h-[60vh] flex items-center justify-center overflow-auto">
          {state.loading && (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2Icon className="w-6 h-6 animate-spin" />
              <span className="text-xs">Chargement de l&apos;aperçu…</span>
            </div>
          )}

          {state.error && (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <AlertCircleIcon className="w-7 h-7 text-red-400" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Aperçu indisponible
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{state.error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAttempt(n => n + 1)}>Réessayer</Button>
            </div>
          )}

          {data?.kind === 'pdf' && (
            <iframe
              src={data.url}
              title={data.filename}
              className="w-full h-full border-0"
            />
          )}

          {data?.kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.url}
              alt={data.filename}
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>

        {/* Barre d'actions — ce qu'on peut faire dépend de l'état du document :
            proposer « Extraire » sur une pièce déjà traitée ne ferait que
            consommer un crédit pour rien. */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-transparent">
          {data?.url && (
            <Button variant="outline" size="sm" className="gap-1.5 h-9" asChild>
              <a href={data.url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="w-3.5 h-3.5" /> Ouvrir
              </a>
            </Button>
          )}

          {canVerify && (
            <Button variant="outline" size="sm" className="gap-1.5 h-9"
              onClick={() => { onVerify?.(doc); onClose?.() }}>
              <CheckCircle2Icon className="w-3.5 h-3.5 text-[#1D9E75]" /> Vérifier les données
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm"
              className="gap-1.5 h-9 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/25"
              onClick={() => { onDelete?.(doc); onClose?.() }}>
              <Trash2Icon className="w-3.5 h-3.5" /> Supprimer
            </Button>

            {canExtract && (
              <Button size="sm"
                className="gap-1.5 h-9 bg-[#1D9E75] hover:bg-[#0F6E56] text-white"
                onClick={() => { onExtract?.(doc); onClose?.() }}>
                <SparklesIcon className="w-3.5 h-3.5" /> Extraire
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
