'use client'

import Script from 'next/script'
import { GA_TRACKING_ID } from '@/lib/analytics'

interface GoogleAnalyticsProps {
  trackingId?: string
}

export function GoogleAnalytics({ trackingId = GA_TRACKING_ID }: GoogleAnalyticsProps) {
  if (!trackingId || trackingId === 'G-XXXXXXXXXX') {
    return null
  }

  return (
    <>
      <Script
        id="google-consent-mode"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            
            // Initialize consent mode with denied defaults
            gtag('consent', 'default', {
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'analytics_storage': 'denied'
            });
          `,
        }}
      />
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${trackingId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            // Ensure gtag is available before calling it
            function initializeGA() {
              if (typeof gtag !== 'undefined') {
                gtag('js', new Date());
                gtag('config', '${trackingId}', {
                  page_title: document.title,
                  page_location: window.location.href,
                  custom_map: {
                    'dimension1': 'content_type',
                    'dimension2': 'user_segment', 
                    'dimension3': 'device_type',
                    'dimension4': 'traffic_source'
                  },
                  // Enhanced measurement
                  enhanced_measurement: {
                    scrolls: true,
                    outbound_clicks: true,
                    site_search: true,
                    video_engagement: true,
                    file_downloads: true
                  },
                  // Privacy settings - let consent mode control these
                  anonymize_ip: true,
                  // Content grouping for astronomy platform
                  content_group1: 'astronomy_content',
                  content_group2: 'article_type',
                  content_group3: 'content_source'
                });
              } else {
                // Retry after a short delay if gtag is not yet available
                setTimeout(initializeGA, 100);
              }
            }
            
            // Start initialization
            initializeGA();
          `,
        }}
      />
    </>
  )
}

// Enhanced Analytics Provider for context
import { createContext, useContext, useEffect, ReactNode } from 'react'
import { trackPageView, trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics'

interface AnalyticsContextType {
  trackEvent: (eventName: string, parameters?: Record<string, unknown>) => void
  trackPageView: (url: string, title: string, customDimensions?: Record<string, unknown>) => void
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null)

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (!context) {
    // Return default no-op functions if context is not available
    return {
      trackEvent: () => {},
      trackPageView: () => {}
    }
  }
  return context
}

interface AnalyticsProviderProps {
  children: ReactNode
  trackingId?: string
}

export function AnalyticsProvider({ children, trackingId = GA_TRACKING_ID }: AnalyticsProviderProps) {
  useEffect(() => {
    // Track initial page view
    if (typeof window !== 'undefined') {
      trackPageView(window.location.href, document.title)
    }
  }, [])

  const contextValue: AnalyticsContextType = {
    trackEvent,
    trackPageView
  }

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
      <GoogleAnalytics trackingId={trackingId} />
    </AnalyticsContext.Provider>
  )
}

// Hook for tracking article engagement
export function useArticleTracking() {
  const { trackEvent } = useAnalytics()

  const trackArticleView = (article: {
    slug: string
    title: string
    category: string
    author?: string
    readTime?: number
    originalDate?: string
  }) => {
    trackEvent(ANALYTICS_EVENTS.ARTICLE_VIEW, {
      article_slug: article.slug,
      article_title: article.title,
      content_category: article.category,
      author: article.author || 'Infinite AI',
      content_type: 'astronomy_article',
      publication_date: article.originalDate,
      estimated_read_time: article.readTime
    })
  }

  const trackReadingProgress = (articleSlug: string, progress: number) => {
    trackEvent('article_reading_progress', {
      article_slug: articleSlug,
      reading_progress: progress,
      progress_milestone: progress >= 0.75 ? 'completed' : progress >= 0.5 ? 'halfway' : 'started'
    })
  }

  const trackArticleShare = (articleSlug: string, platform: string) => {
    trackEvent(ANALYTICS_EVENTS.ARTICLE_SHARE, {
      article_slug: articleSlug,
      share_platform: platform
    })
  }

  return {
    trackArticleView,
    trackReadingProgress,
    trackArticleShare
  }
}

// Hook for tracking user engagement
export function useEngagementTracking() {
  const { trackEvent } = useAnalytics()

  const trackTimeOnPage = (timeSpent: number, pageType: string) => {
    trackEvent('time_on_page', {
      time_spent_seconds: timeSpent,
      page_type: pageType,
      engagement_level: timeSpent > 60 ? 'high' : timeSpent > 30 ? 'medium' : 'low'
    })
  }

  const trackScrollDepth = (depth: number, pageType: string) => {
    trackEvent('scroll_depth', {
      scroll_depth_percentage: depth,
      page_type: pageType,
      engagement_level: depth > 75 ? 'high' : depth > 50 ? 'medium' : 'low'
    })
  }

  const trackCategoryInterest = (category: string, timeSpent: number) => {
    trackEvent('category_interest', {
      category_name: category,
      time_spent_seconds: timeSpent,
      interest_level: timeSpent > 120 ? 'high' : timeSpent > 60 ? 'medium' : 'low'
    })
  }

  return {
    trackTimeOnPage,
    trackScrollDepth,
    trackCategoryInterest
  }
}
