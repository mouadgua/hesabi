"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SparklesIcon, XIcon, ThumbsUpIcon, ThumbsDownIcon } from "lucide-react"

const STORAGE_KEY = "fiduc_survey"
const SESSION_KEY = "fiduc_session_count"
const SHOW_AFTER_SESSIONS = 3
const REPEAT_AFTER_DAYS = 30

function shouldShowSurvey() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const { lastShown, dismissed } = JSON.parse(raw)
      if (dismissed && !lastShown) return false
      if (lastShown) {
        const daysSince = (Date.now() - lastShown) / (1000 * 60 * 60 * 24)
        if (daysSince < REPEAT_AFTER_DAYS) return false
      }
    }
    const sessions = Number(localStorage.getItem(SESSION_KEY) ?? 0)
    return sessions >= SHOW_AFTER_SESSIONS
  } catch {
    return false
  }
}

function markShown() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastShown: Date.now() }))
  } catch {}
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: true }))
  } catch {}
}

export default function QualitySurvey() {
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Increment session counter
    try {
      const count = Number(localStorage.getItem(SESSION_KEY) ?? 0) + 1
      localStorage.setItem(SESSION_KEY, String(count))
    } catch {}

    // Delay slightly so the page settles before the survey pops
    const timer = setTimeout(() => {
      if (shouldShowSurvey()) setVisible(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  function handleYes() {
    markDismissed()
    setVisible(false)
  }

  function handleNo() {
    markShown()
    setVisible(false)
    router.push("/dashboard/support")
  }

  function handleClose() {
    markShown()
    setVisible(false)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="h-0.5 w-full bg-gradient-to-r from-[#1D9E75] to-cyan-400" />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1D9E75]/10">
              <SparklesIcon className="size-3.5 text-[#1D9E75]" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Comment ça se passe ?</p>
          </div>
          <button
            onClick={handleClose}
            className="p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Hesabi vous plaît-il jusqu'ici ?
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleYes}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 text-[#1D9E75] text-sm font-medium transition-colors cursor-pointer"
          >
            <ThumbsUpIcon className="size-3.5" />
            Oui !
          </button>
          <button
            onClick={handleNo}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors cursor-pointer"
          >
            <ThumbsDownIcon className="size-3.5" />
            À améliorer
          </button>
        </div>
      </div>
    </div>
  )
}
