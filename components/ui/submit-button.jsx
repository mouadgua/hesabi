"use client"

import { useFormStatus } from "react-dom"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2Icon } from "lucide-react"

export function SubmitButton({ children, loadingText, steppedTexts = [], icon, ...props }) {
  const { pending } = useFormStatus()
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    // Si on a défini des étapes, on change le texte toutes les 2.5 secondes
    if (pending && steppedTexts.length > 0) {
      const interval = setInterval(() => {
        setStepIndex((prev) => (prev + 1) % steppedTexts.length)
      }, 2500)
      return () => clearInterval(interval)
    } else {
      setStepIndex(0)
    }
  }, [pending, steppedTexts])

  return (
    <Button disabled={pending} {...props}>
      {pending ? (
        <>
          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          {steppedTexts.length > 0 ? steppedTexts[stepIndex] : (loadingText || "Chargement...")}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </Button>
  )
}