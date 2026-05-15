"use client"

import { useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/utils/supabase/client'
import { Loader2Icon } from 'lucide-react'

/**
 * Shows a live count of documents currently being processed (EN_COURS_IA).
 * Uses Supabase Realtime — requires Realtime enabled on the "Document" table.
 */
export default function RealtimeProcessingCounter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const supabase = createBrowserSupabase()

    const channel = supabase
      .channel('processing-counter')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Document' },
        (payload) => {
          const { old: oldRow, new: newRow } = payload
          setCount(prev => {
            let next = prev
            // Doc became EN_COURS_IA
            if (newRow.statut === 'EN_COURS_IA' && oldRow.statut !== 'EN_COURS_IA') next++
            // Doc left EN_COURS_IA
            if (oldRow.statut === 'EN_COURS_IA' && newRow.statut !== 'EN_COURS_IA') next--
            return Math.max(0, next)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (count === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium">
      <Loader2Icon className="w-3 h-3 animate-spin" />
      {count} en cours
    </div>
  )
}
