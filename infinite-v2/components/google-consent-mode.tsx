'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Shield, BarChart3, Lock, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { PRIVACY_CONFIG } from '@/lib/config'

interface ConsentState {
  ad_storage: 'granted' | 'denied'
  ad_user_data: 'granted' | 'denied'
  ad_personalization: 'granted' | 'denied'
  analytics_storage: 'granted' | 'denied'
}

interface GoogleConsentModeProps {
  onConsentChange?: (consent: ConsentState) => void
}

export function GoogleConsentMode({ onConsentChange }: GoogleConsentModeProps) {
  const [mounted, setMounted] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [consent, setConsent] = useState<ConsentState>({
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  })

  useEffect(() => {
    // Mark component as mounted to prevent hydration mismatch
    setMounted(true)
    
    // Check if consent was already given
    const savedConsent = localStorage.getItem('google-consent')
    if (savedConsent) {
      const parsedConsent = JSON.parse(savedConsent)
      setConsent(parsedConsent)
      updateGoogleConsent(parsedConsent)
    } else {
      // Show banner on first visit
      setShowBanner(true)
      // Initialize with denied consent
      updateGoogleConsent(consent)
    }
  }, [])

  const updateGoogleConsent = (newConsent: ConsentState) => {
    // Update Google Tag Manager consent
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', newConsent)
    }
    
    // Store in localStorage
    localStorage.setItem('google-consent', JSON.stringify(newConsent))
    
    // Notify parent component
    onConsentChange?.(newConsent)
  }

  const handleAcceptAll = () => {
    const newConsent: ConsentState = {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    }
    setConsent(newConsent)
    updateGoogleConsent(newConsent)
    setShowBanner(false)
    setShowSettings(false)
  }

  const handleRejectAll = () => {
    const newConsent: ConsentState = {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    }
    setConsent(newConsent)
    updateGoogleConsent(newConsent)
    setShowBanner(false)
    setShowSettings(false)
  }

  const handleCustomConsent = () => {
    updateGoogleConsent(consent)
    setShowBanner(false)
    setShowSettings(false)
  }

  const toggleConsent = (key: keyof ConsentState) => {
    setConsent(prev => ({
      ...prev,
      [key]: prev[key] === 'granted' ? 'denied' : 'granted'
    }))
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null
  }

  if (!showBanner && !showSettings) {
    return (
      <button
        onClick={() => setShowSettings(true)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        title="Nastavenia súhlasu"
      >
        <Settings className="h-5 w-5" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 max-h-[80vh] overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {showSettings ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Nastavenia súhlasu</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground mb-4">
                  Táto stránka používa cookies a podobné technológie na poskytovanie služieb, 
                  personalizáciu obsahu a analýzu návštevnosti. Môžete si vybrať, ktoré cookies 
                  chcete povoliť.
                </div>
                
                <div className="mb-6">
                  <Link 
                    href={PRIVACY_CONFIG.privacyPageUrl}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Viac informácií o ochrane údajov a cookies
                  </Link>
                </div>

                <div className="space-y-4">
                  {/* Necessary Cookies - Always Enabled */}
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-green-500" />
                      <div>
                        <h3 className="font-medium text-foreground">Nevyhnutné cookies</h3>
                        <p className="text-sm text-muted-foreground">
                          Potrebné pre základné fungovanie stránky (vždy aktívne)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          • Session cookies • Bezpečnostné cookies • Nastavenia súhlasu
                        </p>
                      </div>
                    </div>
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-500">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                      <div>
                        <h3 className="font-medium text-foreground">Analytické cookies</h3>
                        <p className="text-sm text-muted-foreground">
                          Pomáhajú nám pochopiť, ako návštevníci používajú stránku
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          • Google Analytics • Výkonnostné metriky • Doba platnosti: {PRIVACY_CONFIG.cookieConsent.expiry} dní
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleConsent('analytics_storage')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        consent.analytics_storage === 'granted' ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          consent.analytics_storage === 'granted' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-orange-500" />
                      <div>
                        <h3 className="font-medium text-foreground">Reklamné cookies</h3>
                        <p className="text-sm text-muted-foreground">
                          Používajú sa na zobrazovanie relevantných reklám
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          • Google AdSense • Reklamné metriky • Doba platnosti: {PRIVACY_CONFIG.cookieConsent.expiry} dní
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleConsent('ad_storage')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        consent.ad_storage === 'granted' ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          consent.ad_storage === 'granted' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-purple-500" />
                      <div>
                        <h3 className="font-medium text-foreground">Personalizácia reklám</h3>
                        <p className="text-sm text-muted-foreground">
                          Umožňuje zobrazovať personalizované reklamy
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          • Cielené reklamy • Záujmy používateľa • Doba platnosti: {PRIVACY_CONFIG.cookieConsent.expiry} dní
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleConsent('ad_personalization')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        consent.ad_personalization === 'granted' ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          consent.ad_personalization === 'granted' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleRejectAll}
                    className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Odmietnuť všetko
                  </button>
                  <button
                    onClick={handleCustomConsent}
                    className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Uložiť nastavenia
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Súhlas s cookies</h2>
                <button
                  onClick={() => setShowBanner(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Táto stránka používa reklamy na poskytovanie bezplatného obsahu. 
                Súhlasíte s ich zobrazovaním a používaním analytických cookies?
              </p>
              
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">
                  <strong>Doba platnosti súhlasu:</strong> {PRIVACY_CONFIG.cookieConsent.expiry} dní
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Posledná aktualizácia:</strong> {new Date(PRIVACY_CONFIG.lastUpdated).toLocaleDateString('sk-SK')}
                </p>
              </div>
              
              <div className="mb-6">
                <Link 
                  href={PRIVACY_CONFIG.privacyPageUrl}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Viac informácií o ochrane údajov
                </Link>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleRejectAll}
                  className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Odmietnuť
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Nastavenia
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Súhlasiť
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook to check consent state
export function useGoogleConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(null)

  useEffect(() => {
    const savedConsent = localStorage.getItem('google-consent')
    if (savedConsent) {
      setConsent(JSON.parse(savedConsent))
    }
  }, [])

  return consent
}

// Declare gtag function for TypeScript
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}
