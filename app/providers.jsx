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

export function Providers({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      {children}
      <ThemedToaster />
    </ThemeProvider>
  )
}
