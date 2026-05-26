"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { setupWorkspace } from "./actions"
import {
  CloudUploadIcon, SparklesIcon, TableIcon,
  ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon,
  CheckIcon,
} from "lucide-react"

// ─── Slide content ────────────────────────────────────────────────────────────

function SlideUpload() {
  return (
    <div className="flex flex-col items-center text-center px-12 py-10 h-full justify-center gap-5">
      <div className="relative flex items-end justify-center gap-3 h-24">
        <div className="anim-fall-1 flex h-14 w-11 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="h-1.5 w-6 rounded bg-gray-200" />
          <div className="h-1.5 w-4 rounded bg-gray-100" />
          <div className="h-1.5 w-5 rounded bg-gray-100" />
          <span className="text-[9px] font-bold text-red-400 mt-1">PDF</span>
        </div>
        <div className="anim-fall-2 flex h-16 w-11 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#1D9E75]/40 bg-[#E1F5EE]">
          <CloudUploadIcon className="size-6 text-[#1D9E75]" />
        </div>
        <div className="anim-fall-3 flex h-14 w-11 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="h-1.5 w-6 rounded bg-blue-200" />
          <div className="h-1.5 w-4 rounded bg-blue-100" />
          <div className="h-1.5 w-5 rounded bg-blue-100" />
          <span className="text-[9px] font-bold text-blue-400 mt-1">JPG</span>
        </div>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Glissez, déposez, extrayez</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
          Uploadez vos factures, relevés bancaires et reçus en PDF ou image. FiduCaire les analyse automatiquement.
        </p>
      </div>
    </div>
  )
}

function SlideAI() {
  return (
    <div className="flex flex-col items-center text-center px-12 py-10 h-full justify-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
        <SparklesIcon className="size-8 text-violet-500" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Extraction intelligente par IA</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
          Gemini analyse chaque document et extrait les champs importants — montants, fournisseurs, dates — selon vos modèles personnalisés.
        </p>
      </div>
      <div className="flex flex-col gap-2 mt-1">
        <div className="anim-badge-1 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-[13px] font-medium text-[#085041]">
          <CheckIcon className="size-3.5" /> Fournisseur trouvé
        </div>
        <div className="anim-badge-2 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-[13px] font-medium text-[#085041]">
          <CheckIcon className="size-3.5" /> Montant TTC trouvé
        </div>
        <div className="anim-badge-3 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-[13px] font-medium text-[#085041]">
          <CheckIcon className="size-3.5" /> Date de facture trouvée
        </div>
      </div>
    </div>
  )
}

function SlideExport() {
  return (
    <div className="flex flex-col items-center text-center px-12 py-10 h-full justify-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
        <TableIcon className="size-8 text-[#217346]" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Export Excel en un clic</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
          Une fois vérifiées, exportez toutes vos données en Excel structuré, prêt à utiliser dans Sage, Cegid ou votre tableur habituel.
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
        <TableIcon className="size-4 text-[#217346]" />
        <span>extraction_mai_2026.xlsx</span>
        <span className="ml-2 rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] font-medium text-[#085041]">
          Prêt
        </span>
      </div>
    </div>
  )
}

const SLIDES = [
  { id: "upload",  component: SlideUpload },
  { id: "ai",      component: SlideAI },
  { id: "export",  component: SlideExport },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)          // 1=welcome 2=tour
  const [slide, setSlide] = useState(0)
  const [prenom, setPrenom] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTour, setShowTour] = useState(false)

  // Reset slide animations when changing slides
  const [slideKey, setSlideKey] = useState(0)
  const changeSlide = (i) => {
    setSlide(i)
    setSlideKey((k) => k + 1)
  }

  const goToTour = () => {
    setShowTour(false)
    setStep(2)
    setTimeout(() => setShowTour(true), 50) // trigger entrance animation
  }

  const finish = async () => {
    setIsLoading(true)
    try {
      await setupWorkspace({ prenom })
    } catch {
      setIsLoading(false)
    }
  }

  const SlideComponent = SLIDES[slide].component

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #F8F8F7 0%, #ffffff 60%)" }}
    >
      {/* ── STEP 1 — Welcome ── */}
      <div
        className={[
          "flex flex-col items-center gap-7 max-w-sm w-full text-center",
          "transition-all duration-300",
          step === 1 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none absolute",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1D9E75]">
          <SparklesIcon className="size-7 text-white" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-[26px] font-semibold tracking-tight text-gray-900">
            Bienvenue sur FiduCaire
          </h1>
          <p className="text-sm text-gray-500">
            Votre assistant d'extraction comptable intelligent
          </p>
        </div>

        <div className="w-full space-y-3">
          <input
            type="text"
            placeholder="Votre prénom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && prenom.trim().length >= 2 && goToTour()}
            autoFocus
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none ring-0 focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 transition-all"
          />
          <button
            onClick={goToTour}
            disabled={prenom.trim().length < 2}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90 hover:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Commencer <ArrowRightIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* ── STEP 2 — Tour ── */}
      <div
        className={[
          "flex flex-col items-center gap-5 w-full max-w-[600px]",
          "transition-all duration-300",
          step === 2 && showTour ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none absolute",
        ].join(" ")}
      >
        {/* Card */}
        <div className="w-full rounded-2xl border border-gray-100 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Slide viewport */}
          <div className="relative h-[340px] overflow-hidden">
            <div
              className="flex h-full transition-transform duration-400 ease-in-out"
              style={{ transform: `translateX(-${slide * 100}%)`, width: `${SLIDES.length * 100}%` }}
            >
              {SLIDES.map((s, i) => (
                <div key={`${s.id}-${slideKey}`} className="h-full" style={{ width: `${100 / SLIDES.length}%` }}>
                  {i === slide && <SlideComponent />}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation bar */}
          <div className="flex items-center justify-between border-t border-gray-50 px-5 py-3.5">
            <button
              onClick={() => changeSlide(Math.max(0, slide - 1))}
              disabled={slide === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="size-4" />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => changeSlide(i)}
                  className={[
                    "rounded-full transition-all duration-200",
                    i === slide
                      ? "w-5 h-2 bg-[#1D9E75]"
                      : "w-2 h-2 bg-gray-200 hover:bg-gray-300",
                  ].join(" ")}
                />
              ))}
            </div>

            {slide < SLIDES.length - 1 ? (
              <button
                onClick={() => changeSlide(slide + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>
        </div>

        {/* Finish button (shown only on last slide) */}
        <div
          className={[
            "w-full transition-all duration-300",
            slide === SLIDES.length - 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
          ].join(" ")}
        >
          <button
            onClick={finish}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-5 py-3 text-[13px] font-medium text-white transition-all hover:opacity-90 hover:scale-[0.99] disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <svg className="size-4 badge-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Création de votre espace…
              </>
            ) : (
              <>
                Terminer et accéder à l'app <ArrowRightIcon className="size-4" />
              </>
            )}
          </button>
        </div>

        {/* Skip link */}
        {slide < SLIDES.length - 1 && (
          <button
            onClick={() => changeSlide(SLIDES.length - 1)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Passer la visite guidée →
          </button>
        )}
      </div>
    </div>
  )
}
