import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import NavigationProgress from "@/components/navigation-progress"
import { Providers } from "./providers"
import PublicAnalytics from '@/components/public-analytics'
import { siteUrl } from '@/lib/site'

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

const SITE_URL   = siteUrl()
const SITE_TITLE = "Hesabi — L'IA de votre cabinet comptable"
const SITE_DESC  =
  "Hesabi lit vos factures, reçus et relevés bancaires et en extrait les données " +
  "comptables en quelques secondes. Conçu pour les cabinets comptables marocains, " +
  "avec plan comptable CGNC et export Excel."

/**
 * Métadonnées du site.
 *
 * Il n'y avait qu'un titre et une description. Trois manques comptaient :
 *
 * - aucune URL canonique. Une même page atteignable sous plusieurs adresses
 *   (avec ou sans www, avec ou sans barre finale, via l'URL de déploiement)
 *   peut être comptée comme plusieurs pages distinctes, qui se concurrencent
 *   au lieu de s'additionner ;
 *
 * - aucune balise Open Graph. Un lien partagé sur WhatsApp, LinkedIn ou
 *   Facebook s'affichait sans titre ni description — ce qui coûte des clics
 *   précisément là où se fait le bouche-à-oreille d'un produit local ;
 *
 * - une description qui décrivait la technologie plutôt que le bénéfice, et ne
 *   contenait aucun des termes qu'un comptable marocain saisit réellement.
 */
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:  SITE_TITLE,
    template: '%s — Hesabi',
  },
  description: SITE_DESC,
  applicationName: 'Hesabi',
  keywords: [
    'extraction factures', 'saisie comptable automatique', 'cabinet comptable Maroc',
    'OCR facture', 'plan comptable CGNC', 'expert-comptable Maroc',
    'logiciel comptabilité Maroc', 'extraction relevé bancaire',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type:        'website',
    locale:      'fr_MA',
    url:         SITE_URL,
    siteName:    'Hesabi',
    title:       SITE_TITLE,
    description: SITE_DESC,
  },
  twitter: {
    card:        'summary_large_image',
    title:       SITE_TITLE,
    description: SITE_DESC,
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
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
          <PublicAnalytics />
        </Providers>
      </body>
    </html>
  )
}