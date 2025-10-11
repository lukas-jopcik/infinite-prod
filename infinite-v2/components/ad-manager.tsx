'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  HeaderAd, 
  SidebarAd, 
  FooterAd, 
  ArticleAd, 
  InFeedAd, 
  AdPlaceholder 
} from './google-adsense'
import { ADSENSE_CONFIG } from '@/lib/config'
import { useGoogleConsent } from './google-consent-mode'

interface AdManagerProps {
  children: React.ReactNode
  showAds?: boolean
  adFrequency?: number
}

export function AdManager({ 
  children, 
  showAds = true, 
  adFrequency = 6 
}: AdManagerProps) {
  const [adsEnabled, setAdsEnabled] = useState(false)
  const consent = useGoogleConsent()

  useEffect(() => {
    // Check if ads should be enabled
    const shouldShowAds = showAds && ADSENSE_CONFIG.enabled
    setAdsEnabled(shouldShowAds)
  }, [showAds])

  // Check if ads are allowed based on Google Consent Mode
  const adsAllowed = consent?.ad_storage === 'granted' && consent?.ad_user_data === 'granted'

  return (
    <AdContext.Provider value={{ 
      adsEnabled: adsEnabled && adsAllowed,
      adFrequency 
    }}>
      {children}
    </AdContext.Provider>
  )
}

// Ad context for managing ad state
import { createContext, useContext } from 'react'

interface AdContextType {
  adsEnabled: boolean
  adFrequency: number
}

const AdContext = createContext<AdContextType>({
  adsEnabled: false,
  adFrequency: 6
})

export function useAdContext() {
  const context = useContext(AdContext)
  if (!context) {
    // Return default values if context is not available
    return {
      adsEnabled: false,
      adFrequency: 6
    }
  }
  return context
}

// Ad container component
interface AdContainerProps {
  position: 'header' | 'sidebar' | 'footer' | 'article' | 'in-feed'
  index?: number
  className?: string
}

export function AdContainer({ position, index, className }: AdContainerProps) {
  const { adsEnabled } = useAdContext()

  if (!adsEnabled) {
    return <AdPlaceholder title={`${position} reklama`} className={className} />
  }

  switch (position) {
    case 'header':
      return <HeaderAd />
    case 'sidebar':
      return <SidebarAd />
    case 'footer':
      return <FooterAd />
    case 'article':
      return <ArticleAd />
    case 'in-feed':
      return index !== undefined ? <InFeedAd index={index} /> : null
    default:
      return null
  }
}

// Intersection observer hook for lazy loading ads
export function useAdIntersection() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// Lazy loaded ad component
interface LazyAdProps {
  position: 'header' | 'sidebar' | 'footer' | 'article' | 'in-feed'
  index?: number
  className?: string
}

export function LazyAd({ position, index, className }: LazyAdProps) {
  const { ref, isVisible } = useAdIntersection()

  return (
    <div ref={ref} className={className}>
      {isVisible && <AdContainer position={position} index={index} />}
    </div>
  )
}

// Ad blocker detection
export function useAdBlocker() {
  const [isAdBlockerActive, setIsAdBlockerActive] = useState(false)

  useEffect(() => {
    const checkAdBlocker = () => {
      const testAd = document.createElement('div')
      testAd.innerHTML = '&nbsp;'
      testAd.className = 'adsbox'
      testAd.style.position = 'absolute'
      testAd.style.left = '-999px'
      testAd.style.top = '-999px'
      
      document.body.appendChild(testAd)
      
      setTimeout(() => {
        const isBlocked = testAd.offsetHeight === 0
        setIsAdBlockerActive(isBlocked)
        document.body.removeChild(testAd)
      }, 100)
    }

    checkAdBlocker()
  }, [])

  return isAdBlockerActive
}

// Ad blocker notice component
export function AdBlockerNotice() {
  const isAdBlockerActive = useAdBlocker()
  const { adsEnabled } = useAdContext()

  if (!isAdBlockerActive || !adsEnabled) return null

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="text-yellow-600">⚠️</div>
        <div>
          <h3 className="font-medium text-yellow-800 mb-1">
            Detekovaný blokovač reklám
          </h3>
          <p className="text-sm text-yellow-700">
            Naša stránka je financovaná reklamami. Zvážte vypnutie blokovača reklám 
            alebo podporte nás inak, aby sme mohli pokračovať v poskytovaní bezplatného obsahu.
          </p>
        </div>
      </div>
    </div>
  )
}
