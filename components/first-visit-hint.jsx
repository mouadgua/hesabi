"use client"

import { useEffect, useState } from "react"
import { XIcon, UploadIcon } from "lucide-react"

const STORAGE_KEY = "fiducaire-upload-hint-shown"

export function FirstVisitHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // Small delay so the page is fully rendered
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, "1")
  }

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(dismiss, 5000)
    return () => clearTimeout(t)
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="anim-fade-up fixed bottom-24 right-6 z-50 flex max-w-[260px] items-start gap-3 rounded-xl border border-[#1D9E75]/30 bg-white p-4 shadow-lg"
      role="status"
    >
      {/* Arrow pointer */}
      <span className="absolute -bottom-2 right-8 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-white drop-shadow-sm" />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E1F5EE]">
        <UploadIcon className="size-4 text-[#1D9E75]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900">Commencez ici</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Uploadez votre premier document pour lancer une extraction.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="Fermer"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}
