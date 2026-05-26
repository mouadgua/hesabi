import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import NavigationProgress from "@/components/navigation-progress"
import { Providers } from "./providers"

const sansFont = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata = {
  title: "Hesabi — L'IA de votre cabinet",
  description: "Plateforme d'extraction documentaire IA pour cabinets comptables",
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${sansFont.variable} ${monoFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <NavigationProgress />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}