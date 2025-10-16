/**
 * Google Analytics 4 (GA4) Integration
 * Enhanced tracking for astronomy content platform
 */

import { GA_CONFIG, ANALYTICS_EVENTS } from './config'

// GA4 Configuration
export const GA_TRACKING_ID = GA_CONFIG.trackingId

// Re-export events from config
export { ANALYTICS_EVENTS }

// Utility function to safely call gtag
const safeGtagCall = (callback: () => void) => {
  if (typeof window !== 'undefined' && window.gtag && typeof window.gtag === 'function') {
    try {
      callback()
    } catch (error) {
      console.warn('Analytics tracking error:', error)
    }
  }
}

// Enhanced GA4 event tracking
export const trackEvent = (eventName: string, parameters?: Record<string, unknown>) => {
  safeGtagCall(() => {
    window.gtag!('event', eventName, {
      ...parameters,
      custom_map: {
        dimension1: 'content_type',
        dimension2: 'user_segment',
        dimension3: 'device_type'
      }
    })
  })
}

// Track article views with enhanced metadata
export const trackArticleView = (article: {
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
    estimated_read_time: article.readTime,
    page_location: window.location.href,
    page_title: article.title
  })
}

// Track reading time for engagement analysis
export const trackReadingTime = (articleSlug: string, timeSpent: number, totalTime: number) => {
  const engagementRate = (timeSpent / totalTime) * 100
  
  trackEvent(ANALYTICS_EVENTS.ARTICLE_READ_TIME, {
    article_slug: articleSlug,
    time_spent_seconds: timeSpent,
    total_reading_time: totalTime,
    engagement_rate: engagementRate,
    engagement_level: engagementRate > 75 ? 'high' : engagementRate > 50 ? 'medium' : 'low'
  })
}

// Track category views
export const trackCategoryView = (category: string, articleCount: number) => {
  trackEvent(ANALYTICS_EVENTS.CATEGORY_VIEW, {
    category_name: category,
    article_count: articleCount,
    page_location: window.location.href
  })
}

// Track search queries
export const trackSearch = (query: string, resultsCount: number, filters?: string[]) => {
  trackEvent(ANALYTICS_EVENTS.SEARCH_QUERY, {
    search_term: query,
    results_count: resultsCount,
    search_filters: filters?.join(',') || '',
    page_location: window.location.href
  })
}

// Track newsletter signups
export const trackNewsletterSignup = (email: string, source: string) => {
  trackEvent(ANALYTICS_EVENTS.NEWSLETTER_SIGNUP, {
    email_domain: email.split('@')[1],
    signup_source: source,
    page_location: window.location.href
  })
}

// Track social shares
export const trackSocialShare = (platform: string, articleSlug: string, articleTitle: string) => {
  trackEvent(ANALYTICS_EVENTS.SOCIAL_SHARE, {
    social_platform: platform,
    article_slug: articleSlug,
    article_title: articleTitle,
    page_location: window.location.href
  })
}

// Track performance metrics
export const trackPerformance = (metric: string, value: number, unit: string = 'ms') => {
  trackEvent(ANALYTICS_EVENTS.PAGE_LOAD_TIME, {
    metric_name: metric,
    metric_value: value,
    metric_unit: unit,
    page_location: window.location.href
  })
}

// Track monetization events
export const trackAdView = (adSlot: string, adSize: string, revenue?: number) => {
  trackEvent(ANALYTICS_EVENTS.AD_VIEW, {
    ad_slot: adSlot,
    ad_size: adSize,
    estimated_revenue: revenue || 0,
    page_location: window.location.href
  })
}

export const trackAdClick = (adSlot: string, adSize: string, revenue?: number) => {
  trackEvent(ANALYTICS_EVENTS.AD_CLICK, {
    ad_slot: adSlot,
    ad_size: adSize,
    estimated_revenue: revenue || 0,
    page_location: window.location.href
  })
}

export const trackAffiliateClick = (affiliateId: string, product: string, revenue?: number) => {
  trackEvent(ANALYTICS_EVENTS.AFFILIATE_CLICK, {
    affiliate_id: affiliateId,
    product_name: product,
    estimated_revenue: revenue || 0,
    page_location: window.location.href
  })
}

// Enhanced e-commerce tracking for affiliate revenue
export const trackRevenue = (transactionId: string, value: number, currency: string = 'EUR', items: unknown[] = []) => {
  trackEvent(ANALYTICS_EVENTS.REVENUE_EVENT, {
    transaction_id: transactionId,
    value: value,
    currency: currency,
    items: items,
    page_location: window.location.href
  })
}

// User engagement scoring
export const calculateEngagementScore = (actions: {
  pageViews: number
  timeOnSite: number
  articlesRead: number
  shares: number
  newsletterSignups: number
}) => {
  const score = 
    (actions.pageViews * 1) +
    (actions.timeOnSite / 60 * 2) + // 2 points per minute
    (actions.articlesRead * 5) +
    (actions.shares * 10) +
    (actions.newsletterSignups * 20)
  
  return Math.round(score)
}

// Track user engagement score
export const trackEngagementScore = (score: number, userSegment: string) => {
  trackEvent('user_engagement_score', {
    engagement_score: score,
    user_segment: userSegment,
    page_location: window.location.href
  })
}

// Enhanced page view tracking with custom dimensions
export const trackPageView = (url: string, title: string, customDimensions?: Record<string, unknown>) => {
  safeGtagCall(() => {
    window.gtag!('config', GA_TRACKING_ID, {
      page_location: url,
      page_title: title,
      custom_map: {
        dimension1: 'content_type',
        dimension2: 'user_segment',
        dimension3: 'device_type',
        dimension4: 'traffic_source'
      },
      ...customDimensions
    })
  })
}

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}
