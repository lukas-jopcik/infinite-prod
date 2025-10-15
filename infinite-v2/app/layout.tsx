import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import "./komunita.css"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { PerformanceMonitor } from "@/components/performance-monitor"
import { AnalyticsProvider } from "@/components/google-analytics"
import { AdManager } from "@/components/ad-manager"
import { GoogleConsentMode } from "@/components/google-consent-mode"
import { GOOGLE_VERIFICATION_CONFIG } from "@/lib/config"
import { Suspense } from "react"
import { SpaceLoading } from "@/components/space-loading"

export const metadata: Metadata = {
  title: "Infinite – Objav dňa z vesmíru",
  description: "Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii.",
  generator: "v0.app",
  metadataBase: new URL("https://infinite.sk"),
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }
  },
  manifest: '/manifest.json',
  openGraph: {
    title: "Infinite – Objav dňa z vesmíru",
    description: "Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii.",
    type: "website",
    locale: "sk_SK",
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 1200,
        alt: 'Infinite - Objav dňa z vesmíru',
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinite – Objav dňa z vesmíru",
    description: "Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii.",
    images: ['/opengraph-image.png'],
  },
  alternates: {
    types: {
      'application/rss+xml': [
        { url: '/rss.xml', title: 'Infinite RSS Feed' },
      ],
    },
  },
  verification: {
    google: GOOGLE_VERIFICATION_CONFIG.siteVerification,
  },
  other: {
    'google-adsense-account': 'ca-pub-7836061933361865',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sk" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <GoogleConsentMode />
        <AnalyticsProvider>
          <AdManager>
            <Suspense fallback={<SpaceLoading />}>
              <Navigation />
              <main className="min-h-screen">{children}</main>
              <Footer />
            </Suspense>
            <PerformanceMonitor />
          </AdManager>
        </AnalyticsProvider>
      </body>
    </html>
  )
}