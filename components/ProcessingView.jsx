"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabase } from "@/utils/supabase/client"

const STEPS = [
  { emoji: "📄", label: "Lecture du document" ,         duration: 1400 },
  { emoji: "📊", label: "Détection des tableaux",        duration: 1600 },
  { emoji: "🧠", label: "Analyse par IA (Gemini 2.5)",  duration: 2200 },
  { emoji: "📋", label: "Extraction des champs",         duration: 1200 },
  { emoji: "✅", label: "Vérification de la qualité",   duration: 900  },
]

const TOTAL_DURATION = STEPS.reduce((sum, s) => sum + s.duration, 0)

function SkeletonField() {
  return (
    <div className="space-y-1.5">
      <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
      <div className="h-9 w-full rounded-md bg-gray-100 animate-pulse" style={{
        background: "linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%)",
        backgroundSize: "400px 100%",
        animation: "shimmer 1.4s infinite",
      }} />
    </div>
  )
}

export default function ProcessingView({ documentId }) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [speedUp, setSpeedUp] = useState(false)
  const elapsedMs = useRef(0)
  const stepStart = useRef(Date.now())

  // Subscribe to Document status changes
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
      // All steps done — if status already changed, refresh now
      router.refresh()
      return
    }
    const duration = speedUp ? 280 : STEPS[currentStep].duration
    stepStart.current = Date.now()
    const timer = setTimeout(() => {
      setCurrentStep(s => s + 1)
    }, duration)
    return () => clearTimeout(timer)
  }, [currentStep, speedUp, router])

  // If speedUp fires while we're already past all steps
  useEffect(() => {
    if (speedUp && currentStep >= STEPS.length) {
      router.refresh()
    }
  }, [speedUp, currentStep, router])

  // Progress bar: approximate position
  const progressPct = currentStep >= STEPS.length
    ? 100
    : Math.round((STEPS.slice(0, currentStep).reduce((s, x) => s + x.duration, 0) / TOTAL_DURATION) * 100)

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

      {/* Left — document preview with overlay */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full border-b md:border-b-0 md:border-r bg-gray-100 p-4 relative">
        {/* Frosted overlay */}
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[3px] flex flex-col items-center justify-center gap-5 px-8">

          {/* Animated current step icon */}
          <div className="relative flex items-center justify-center w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-30" />
            <div className="relative w-16 h-16 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-3xl shadow-sm">
              {currentStep < STEPS.length ? STEPS[currentStep].emoji : "✅"}
            </div>
          </div>

          {/* Step list */}
          <div className="space-y-2 w-full max-w-xs">
            {STEPS.map((step, i) => {
              const done = i < currentStep
              const active = i === currentStep
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 text-sm transition-all duration-300 ${
                    done ? "text-emerald-600" : active ? "text-indigo-700 font-semibold" : "text-gray-300"
                  }`}
                >
                  <span className="text-base shrink-0">
                    {done ? "✓" : active ? step.emoji : "○"}
                  </span>
                  <span className={active ? "animate-pulse" : ""}>{step.label}</span>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-xs">
            <div className="h-1 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-indigo-400 text-right mt-1">{progressPct}%</p>
          </div>
        </div>

        {/* Actual document behind the overlay (blurred) */}
        <div className="w-full h-full bg-white rounded-xl shadow-inner border overflow-hidden opacity-40">
          <div className="flex items-center justify-center h-full text-gray-300 text-sm">Document en cours d'analyse…</div>
        </div>
      </div>

      {/* Right — skeleton loaders */}
      <div className="w-full md:w-1/2 h-[50vh] md:h-full overflow-y-auto p-4 md:p-6 bg-gray-50/50">
        <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-6 space-y-5 h-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonField key={i} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position:  400px 0 }
        }
      `}</style>
    </div>
  )
}
