'use client'

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { SpaceLoading } from "@/components/space-loading"

// Dynamic imports for non-critical components
const Footer = dynamic(() => import("@/components/footer").then(mod => ({ default: mod.Footer })), {
  ssr: false,
  loading: () => <div className="h-32 bg-muted/20 animate-pulse" />
})

const GoogleConsentMode = dynamic(() => import("@/components/google-consent-mode").then(mod => ({ default: mod.GoogleConsentMode })), {
  ssr: false
})

const AnalyticsProvider = dynamic(() => import("@/components/google-analytics").then(mod => ({ default: mod.AnalyticsProvider })), {
  ssr: false
})

const AdManager = dynamic(() => import("@/components/ad-manager").then(mod => ({ default: mod.AdManager })), {
  ssr: false
})

const PerformanceMonitor = dynamic(() => import("@/components/performance-monitor").then(mod => ({ default: mod.PerformanceMonitor })), {
  ssr: false
})

const WebVitalsMonitor = dynamic(() => import("@/components/web-vitals-monitor").then(mod => ({ default: mod.WebVitalsMonitor })), {
  ssr: false
})

const SearchConsoleMonitor = dynamic(() => import("@/components/search-console-monitor").then(mod => ({ default: mod.SearchConsoleMonitor })), {
  ssr: false
})

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <>
      <GoogleConsentMode />
      <AnalyticsProvider>
        <AdManager>
          <Suspense fallback={<SpaceLoading />}>
            {children}
            <Footer />
          </Suspense>
          <PerformanceMonitor />
          <WebVitalsMonitor />
          <SearchConsoleMonitor />
        </AdManager>
      </AnalyticsProvider>
    </>
  )
}
