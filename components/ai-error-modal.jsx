"use client"

import { AlertTriangleIcon, RefreshCwIcon, XIcon } from "lucide-react"

const ERROR_CONTENT = {
  QUOTA_ERROR: {
    title: "Quota IA dépassé",
    description: "Notre quota d'appels à l'IA a été atteint temporairement. Le service reprendra automatiquement dans quelques minutes. Vous pouvez relancer l'extraction.",
    icon: "🚦",
  },
  TIMEOUT_ERROR: {
    title: "Délai d'attente dépassé",
    description: "L'IA a mis trop de temps à répondre (504). Cela arrive parfois sur des fichiers volumineux ou lors de pics de charge. Réessayez dans un instant.",
    icon: "⏱",
  },
  AI_ERROR: {
    title: "Erreur IA inattendue",
    description: "L'IA n'a pas pu traiter ce document. Vérifiez que le fichier est lisible et réessayez. Si le problème persiste, contactez le support.",
    icon: "⚠️",
  },
}

export default function AIErrorModal({ errorCode, filename, onClose, onRetry }) {
  const content = ERROR_CONTENT[errorCode] ?? ERROR_CONTENT.AI_ERROR

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">

        {/* Red top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-red-400 to-orange-400" />

        <div className="p-6 space-y-4">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <XIcon className="size-4" />
          </button>

          {/* Icon + title */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
              <AlertTriangleIcon className="size-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{content.title}</h3>
              {filename && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[260px]">{filename}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-[52px]">
            {content.description}
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1 pl-[52px]">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1D9E75] hover:opacity-90 text-white text-sm font-medium transition-all cursor-pointer"
              >
                <RefreshCwIcon className="size-3.5" />
                Relancer
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function getAIErrorCode(errorMessage) {
  if (!errorMessage) return null
  if (errorMessage.startsWith('QUOTA_ERROR')) return 'QUOTA_ERROR'
  if (errorMessage.startsWith('TIMEOUT_ERROR')) return 'TIMEOUT_ERROR'
  if (errorMessage.startsWith('AI_ERROR')) return 'AI_ERROR'
  return null
}
