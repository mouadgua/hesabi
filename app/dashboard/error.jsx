'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from 'lucide-react'
import Link from 'next/link'

export default function DashboardError({ error, unstable_retry }) {
  useEffect(() => {
    console.error('[DashboardError]', error?.digest, error)
  }, [error])

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
        <AlertTriangleIcon className="h-8 w-8 text-red-500" />
      </div>

      <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
        Quelque chose s'est mal passé
      </h2>
      <p className="mb-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        Une erreur inattendue s'est produite dans le tableau de bord.
      </p>
      {error?.digest && (
        <p className="mb-6 font-mono text-xs text-slate-400 dark:text-slate-600">
          Réf : {error.digest}
        </p>
      )}

      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={() => unstable_retry()}
          className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white"
        >
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Réessayer
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <HomeIcon className="mr-2 h-4 w-4" />
            Tableau de bord
          </Link>
        </Button>
      </div>
    </div>
  )
}
