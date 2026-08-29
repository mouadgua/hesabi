"use client"

import { ThemeProvider, useTheme } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { useEffect, useState } from "react"

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <Toaster
      richColors
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
    />
  )
}

/**
 * @param {{ children: React.ReactNode, nonce?: string }} props
 *   `nonce` vient de l'en-tête x-nonce posé par le middleware.
 *
 *   next-themes injecte un script inline qui applique le thème AVANT le premier
 *   rendu, pour éviter l'éclair de thème clair. Sans nonce, la CSP stricte des
 *   pages authentifiées le bloquait : l'éclair revenait, et chaque navigation
 *   inscrivait une violation dans la console — 26 sur un simple parcours des
 *   pages, qui noyaient tout le reste.
 */
export function Providers({ children, nonce }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
      nonce={nonce}
      scriptProps={{ suppressHydrationWarning: true, nonce }}
    >
      {children}
      <ThemedToaster />
    </ThemeProvider>
  )
}
