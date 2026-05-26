"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabase } from "@/utils/supabase/client"

const STEPS = [
  { label: "Lecture du document",        duration: 1400 },
  { label: "Détection des tableaux",     duration: 1600 },
  { label: "Analyse par IA (Gemini 2.5)", duration: 2200 },
  { label: "Extraction des champs",      duration: 1200 },
  { label: "Vérification de la qualité", duration: 900  },
]

const TOTAL_DURATION = STEPS.reduce((sum, s) => sum + s.duration, 0)

function SkeletonField() {
  return (
    <div className="space-y-1.5">
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
      <div className="h-9 w-full rounded-md bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
    </div>
  )
}

export default function ProcessingView({ documentId }) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [animDone, setAnimDone] = useState(false)
  const [speedUp, setSpeedUp] = useState(false)

  // Supabase Realtime — speeds up animation if status changes early
  useEffect(() => {
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel(`proc-${documentId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "Document",
        filter: `id=eq.${documentId}`,
      }, (payload) => {
        const newStatut = payload.new?.statut
        if (newStatut && newStatut !== "EN_COURS_IA") {
          setSpeedUp(true)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [documentId])

  // Step progression
  useEffect(() => {
    if (currentStep >= STEPS.length) {
      setAnimDone(true)
      return
    }
    const duration = speedUp ? 200 : STEPS[currentStep].duration
    const timer = setTimeout(() => setCurrentStep(s => s + 1), duration)
    return () => clearTimeout(timer)
  }, [currentStep, speedUp])

  // Polling fallback: once animation is done, poll every 3s until doc changes
  useEffect(() => {
    if (!animDone) return
    router.refresh()
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [animDone, router])

  // Realtime fired after animation already done → refresh immediately
  useEffect(() => {
    if (speedUp && animDone) router.refresh()
  }, [speedUp, animDone, router])

  const progressPct = currentStep >= STEPS.length
    ? 100
    : Math.round((STEPS.slice(0, currentStep).reduce((s, x) => s + x.duration, 0) / TOTAL_DURATION) * 100)

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

      {/* Left — animated progress */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full border-b md:border-b-0 md:border-r border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] p-4 relative flex items-center justify-center">

        <div className="flex flex-col items-center gap-6 w-full max-w-xs">

          {/* Spinning ring */}
          <div className="relative flex items-center justify-center w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-[#1D9E75]/15 dark:border-[#1D9E75]/10" />
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1D9E75] transition-all duration-500"
              style={{
                transform: `rotate(${progressPct * 3.6}deg)`,
                transition: 'transform 0.5s ease',
              }}
            />
            <div className="relative w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 flex items-center justify-center shadow-sm">
              {currentStep < STEPS.length ? (
                <div className="w-3 h-3 rounded-full bg-[#1D9E75] animate-pulse" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              )}
            </div>
          </div>

          {/* Step list */}
          <div className="space-y-2 w-full">
            {STEPS.map((step, i) => {
              const done = i < currentStep
              const active = i === currentStep
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 text-sm transition-all duration-300 ${
                    done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : active
                        ? "text-[#1D9E75] font-semibold"
                        : "text-slate-300 dark:text-slate-600"
                  }`}
                >
                  <span className="text-xs shrink-0 w-3 text-center">
                    {done ? "✓" : active ? "›" : "○"}
                  </span>
                  <span className={active ? "animate-pulse" : ""}>{step.label}</span>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <div className="h-1.5 bg-[#1D9E75]/12 dark:bg-[#1D9E75]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1D9E75] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 text-right mt-1">{progressPct}%</p>
          </div>
        </div>
      </div>

      {/* Right — skeleton loaders */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full overflow-y-auto p-4 md:p-6 bg-transparent">
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm p-6 space-y-5 h-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonField key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
