import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"

// Optimize font loading - Geist fonts are already optimized
const geistSans = GeistSans
const geistMono = GeistMono
import "./globals.css"
import { Navigation } from "@/components/navigation"
import { ClientLayout } from "@/components/client-layout"
import { GOOGLE_VERIFICATION_CONFIG } from "@/lib/config"

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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sk" className="dark">
      <head>
        {/* Resource hints for external domains */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="preconnect" href="https://infinite-images-dev-349660737637.s3.eu-central-1.amazonaws.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
        
        {/* Critical CSS for above-the-fold content */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Critical styles for LCP elements */
            .font-sans { font-family: ui-sans-serif, system-ui, sans-serif; }
            .antialiased { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            .sticky { position: sticky; }
            .top-0 { top: 0px; }
            .z-50 { z-index: 50; }
            .border-b { border-bottom-width: 1px; }
            .bg-background { background-color: oklch(1 0 0); }
            .dark .bg-background { background-color: oklch(0.145 0 0); }
            .backdrop-blur { backdrop-filter: blur(8px); }
            .supports-\\[backdrop-filter\\]\\:bg-background\\/80:has([style*="backdrop-filter"]) { background-color: rgba(255, 255, 255, 0.8); }
            .dark .supports-\\[backdrop-filter\\]\\:bg-background\\/80:has([style*="backdrop-filter"]) { background-color: rgba(37, 37, 37, 0.8); }
            .min-h-screen { min-height: 100vh; }
            .text-2xl { font-size: 1.5rem; line-height: 2rem; }
            .font-bold { font-weight: 700; }
            .tracking-tight { letter-spacing: -0.025em; }
            .text-foreground { color: oklch(0.145 0 0); }
            .dark .text-foreground { color: oklch(0.985 0 0); }
          `
        }} />
      </head>
      <body className={`font-sans ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientLayout>
          <Navigation />
          <main className="min-h-screen">{children}</main>
        </ClientLayout>
      </body>
    </html>
  )
}