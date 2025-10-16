'use client'

import { useEffect } from 'react'
import { trackPerformance } from '@/lib/analytics'

interface WebVitalsMetric {
  name: string
  value: number
  delta: number
  id: string
  navigationType: string
}

interface WebVitalsThresholds {
  LCP: number // Largest Contentful Paint
  INP: number // Interaction to Next Paint
  CLS: number // Cumulative Layout Shift
  FCP: number // First Contentful Paint
  TTFB: number // Time to First Byte
}

// Core Web Vitals thresholds (Google's recommended values)
const WEB_VITALS_THRESHOLDS: WebVitalsThresholds = {
  LCP: 2500, // 2.5 seconds
  INP: 200,  // 200 milliseconds (replaces FID)
  CLS: 0.1,  // 0.1
  FCP: 1800, // 1.8 seconds
  TTFB: 800  // 800 milliseconds
}

// Performance rating based on thresholds
const getPerformanceRating = (metric: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = WEB_VITALS_THRESHOLDS[metric as keyof WebVitalsThresholds]
  if (!threshold) return 'good'

  // For CLS, lower is better
  if (metric === 'CLS') {
    if (value <= 0.1) return 'good'
    if (value <= 0.25) return 'needs-improvement'
    return 'poor'
  }

  // For other metrics, lower is better
  if (value <= threshold) return 'good'
  if (value <= threshold * 1.5) return 'needs-improvement'
  return 'poor'
}

// Send Web Vitals to Google Analytics
const sendToAnalytics = (metric: WebVitalsMetric) => {
  const rating = getPerformanceRating(metric.name, metric.value)
  
  // Send to Google Analytics
  trackPerformance(metric.name, metric.value, 'ms')
  
  // Send custom event for Web Vitals
  if (typeof window !== 'undefined' && window.gtag && typeof window.gtag === 'function') {
    try {
      window.gtag('event', 'web_vitals', {
        metric_name: metric.name,
        metric_value: metric.value,
        metric_delta: metric.delta,
        metric_id: metric.id,
        metric_rating: rating,
        navigation_type: metric.navigationType,
        page_location: window.location.href,
        page_title: document.title
      })
    } catch (error) {
      console.warn('Web Vitals tracking error:', error)
    }
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating,
      threshold: WEB_VITALS_THRESHOLDS[metric.name as keyof WebVitalsThresholds]
    })
  }
}

// Monitor Core Web Vitals
export function WebVitalsMonitor() {
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return

    // Import web-vitals library dynamically
    import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      // Largest Contentful Paint
      onLCP(sendToAnalytics)
      
      // Interaction to Next Paint (replaces FID)
      onINP(sendToAnalytics)
      
      // Cumulative Layout Shift
      onCLS(sendToAnalytics)
      
      // First Contentful Paint
      onFCP(sendToAnalytics)
      
      // Time to First Byte
      onTTFB(sendToAnalytics)
    }).catch((error) => {
      console.warn('[Web Vitals] Failed to load web-vitals library:', error)
    })

    // Monitor additional performance metrics
    const observePerformance = () => {
      if ('PerformanceObserver' in window) {
        // Monitor Long Tasks (tasks that take longer than 50ms)
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) {
              trackPerformance('long_task', entry.duration, 'ms')
              
              if (process.env.NODE_ENV === 'development') {
                console.warn(`[Performance] Long task detected: ${entry.duration}ms`)
              }
            }
          })
        })
        
        try {
          longTaskObserver.observe({ entryTypes: ['longtask'] })
        } catch (error) {
          console.warn('[Performance] Long task observation not supported:', error)
        }

        // Monitor Resource Timing
        const resourceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resource = entry as PerformanceResourceTiming
              
              // Track slow resources (>1s)
              if (resource.duration > 1000) {
                trackPerformance('slow_resource', resource.duration, 'ms')
                
                if (process.env.NODE_ENV === 'development') {
                  console.warn(`[Performance] Slow resource: ${resource.name} (${resource.duration}ms)`)
                }
              }
            }
          })
        })
        
        try {
          resourceObserver.observe({ entryTypes: ['resource'] })
        } catch (error) {
          console.warn('[Performance] Resource observation not supported:', error)
        }
      }
    }

    // Start observing after a short delay to avoid interfering with initial page load
    setTimeout(observePerformance, 1000)

    // Monitor page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Page is being hidden, track time on page
        const timeOnPage = performance.now()
        trackPerformance('time_on_page', timeOnPage, 'ms')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null // This component doesn't render anything
}

// Hook for manual performance tracking
export function usePerformanceTracking() {
  const trackCustomMetric = (name: string, value: number, unit: string = 'ms') => {
    trackPerformance(name, value, unit)
  }

  const trackPageLoadTime = () => {
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.fetchStart
        trackPerformance('page_load_time', loadTime, 'ms')
      }
    }
  }

  const trackImageLoadTime = (imageUrl: string, loadTime: number) => {
    trackPerformance('image_load_time', loadTime, 'ms')
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] Image loaded: ${imageUrl} (${loadTime}ms)`)
    }
  }

  const trackAPIResponseTime = (endpoint: string, responseTime: number) => {
    trackPerformance('api_response_time', responseTime, 'ms')
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] API response: ${endpoint} (${responseTime}ms)`)
    }
  }

  return {
    trackCustomMetric,
    trackPageLoadTime,
    trackImageLoadTime,
    trackAPIResponseTime
  }
}

// Performance monitoring dashboard data
export const getPerformanceSummary = () => {
  if (typeof window === 'undefined') return null

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  const paint = performance.getEntriesByType('paint')
  
  if (!navigation) return null

  const summary = {
    // Navigation timing
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    ssl: navigation.secureConnectionStart > 0 ? navigation.connectEnd - navigation.secureConnectionStart : 0,
    ttfb: navigation.responseStart - navigation.fetchStart,
    download: navigation.responseEnd - navigation.responseStart,
    domProcessing: navigation.domComplete - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.fetchStart,
    
    // Paint timing
    fcp: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
    lcp: 0, // Will be set by Web Vitals
    cls: 0, // Will be set by Web Vitals
    
    // Resource count
    resourceCount: performance.getEntriesByType('resource').length,
    
    // Memory usage (if available)
    memoryUsage: (performance as any).memory ? {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize,
      limit: (performance as any).memory.jsHeapSizeLimit
    } : null
  }

  return summary
}

// Export thresholds for external use
export { WEB_VITALS_THRESHOLDS, getPerformanceRating }
