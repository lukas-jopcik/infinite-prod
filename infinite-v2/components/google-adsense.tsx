'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { ADSENSE_CONFIG } from '@/lib/config'
import { trackAdView, trackAdClick } from '@/lib/analytics'
import { useGoogleConsent } from './google-consent-mode'

interface AdSenseProps {
  client?: string
  slot?: string
  format?: 'auto' | 'rectangle' | 'vertical' | 'horizontal'
  responsive?: boolean
  style?: React.CSSProperties
  className?: string
  onLoad?: () => void
  onError?: () => void
}

export function AdSense({
  client = ADSENSE_CONFIG.client,
  slot,
  format = 'auto',
  responsive = true,
  style,
  className,
  onLoad,
  onError
}: AdSenseProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const consent = useGoogleConsent()

  useEffect(() => {
    if (isLoaded && slot) {
      // Track ad view
      trackAdView(slot, format, 0) // Revenue will be tracked by AdSense
    }
  }, [isLoaded, slot, format])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  const handleClick = () => {
    if (slot) {
      trackAdClick(slot, format, 0) // Revenue will be tracked by AdSense
    }
  }

  // Check if ads are allowed based on consent
  const adsAllowed = consent?.ad_storage === 'granted' && consent?.ad_user_data === 'granted'
  const isNonPersonalized = consent?.ad_personalization === 'denied'

  if (!ADSENSE_CONFIG.enabled || !client || !slot || client === 'ca-pub-xxxxxxxxxx' || !adsAllowed) {
    return null
  }

  if (hasError) {
    return (
      <div className={`flex items-center justify-center p-4 bg-muted rounded-lg ${className}`}>
        <span className="text-sm text-muted-foreground">Reklama sa nenačítala</span>
      </div>
    )
  }

  return (
    <>
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
        crossOrigin="anonymous"
        onLoad={handleLoad}
        onError={handleError}
      />
      <ins
        className={`adsbygoogle ${className}`}
        style={{
          display: 'block',
          ...style
        }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
        data-npa={isNonPersonalized ? 'true' : 'false'}
        onClick={handleClick}
        suppressHydrationWarning
      />
      <Script
        id={`adsense-${slot}`}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            try {
              (adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
              console.error('AdSense error:', e);
            }
          `,
        }}
      />
    </>
  )
}

// Predefined ad components for different placements
export function HeaderAd() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-4">
        <div className="w-full h-[90px] bg-muted/50 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Načítavam reklamu...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4">
      <AdSense
        slot={ADSENSE_CONFIG.slots.header}
        format="horizontal"
        className="w-full"
        style={{ height: '90px' }}
      />
    </div>
  )
}

export function SidebarAd() {
  return (
    <div className="w-full max-w-xs mx-auto">
      <AdSense
        slot={ADSENSE_CONFIG.slots.sidebar}
        format="vertical"
        className="w-full"
        style={{ height: '600px' }}
      />
    </div>
  )
}

export function FooterAd() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4">
      <AdSense
        slot={ADSENSE_CONFIG.slots.footer}
        format="horizontal"
        className="w-full"
        style={{ height: '90px' }}
      />
    </div>
  )
}

export function ArticleAd() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <AdSense
        slot={ADSENSE_CONFIG.slots.article}
        format="rectangle"
        className="w-full"
        style={{ height: '250px' }}
      />
    </div>
  )
}

// In-feed ad component for article lists
export function InFeedAd({ index }: { index: number }) {
  // Show ad every 6th item
  if (index % 6 !== 5) return null

  return (
    <div className="w-full max-w-md mx-auto my-6">
      <AdSense
        slot={ADSENSE_CONFIG.slots.article}
        format="rectangle"
        className="w-full"
        style={{ height: '250px' }}
      />
    </div>
  )
}

// Responsive ad component
export function ResponsiveAd({ className }: { className?: string }) {
  return (
    <div className={className}>
      <AdSense
        slot={ADSENSE_CONFIG.slots.article}
        format="auto"
        responsive={true}
        className="w-full"
      />
    </div>
  )
}

// Ad placeholder for development
export function AdPlaceholder({ 
  title = "Reklama", 
  className = "" 
}: { 
  title?: string
  className?: string 
}) {
  if (ADSENSE_CONFIG.enabled) return null

  return (
    <div className={`flex items-center justify-center p-8 bg-muted/50 border-2 border-dashed border-muted-foreground/25 rounded-lg ${className}`}>
      <div className="text-center">
        <div className="text-sm font-medium text-muted-foreground mb-1">{title}</div>
        <div className="text-xs text-muted-foreground/75">AdSense reklama</div>
      </div>
    </div>
  )
}
