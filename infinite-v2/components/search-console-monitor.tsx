'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

interface SearchConsoleAlert {
  type: 'error' | 'warning' | 'info'
  message: string
  timestamp: Date
  url?: string
  details?: Record<string, unknown>
}

// Google Search Console monitoring and alerting
export function SearchConsoleMonitor() {
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return

    // Monitor for common SEO issues
    const monitorSEOIssues = () => {
      const alerts: SearchConsoleAlert[] = []

      // Check for missing meta descriptions
      const metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription || !metaDescription.getAttribute('content')) {
        alerts.push({
          type: 'warning',
          message: 'Missing meta description',
          timestamp: new Date(),
          url: window.location.href
        })
      }

      // Check for missing title tags
      const title = document.querySelector('title')
      if (!title || !title.textContent?.trim()) {
        alerts.push({
          type: 'error',
          message: 'Missing title tag',
          timestamp: new Date(),
          url: window.location.href
        })
      }

      // Check for missing alt text on images
      const images = document.querySelectorAll('img')
      const imagesWithoutAlt = Array.from(images).filter(img => !img.alt)
      if (imagesWithoutAlt.length > 0) {
        alerts.push({
          type: 'warning',
          message: `${imagesWithoutAlt.length} images missing alt text`,
          timestamp: new Date(),
          url: window.location.href,
          details: { count: imagesWithoutAlt.length }
        })
      }

      // Check for missing h1 tags
      const h1Tags = document.querySelectorAll('h1')
      if (h1Tags.length === 0) {
        alerts.push({
          type: 'warning',
          message: 'Missing H1 tag',
          timestamp: new Date(),
          url: window.location.href
        })
      } else if (h1Tags.length > 1) {
        alerts.push({
          type: 'warning',
          message: 'Multiple H1 tags found',
          timestamp: new Date(),
          url: window.location.href,
          details: { count: h1Tags.length }
        })
      }

      // Check for broken internal links
      const internalLinks = document.querySelectorAll('a[href^="/"], a[href*="infinite.sk"]')
      const brokenLinks: string[] = []
      
      internalLinks.forEach(link => {
        const href = link.getAttribute('href')
        if (href && href.includes('#')) {
          const fragment = href.split('#')[1]
          const target = document.getElementById(fragment)
          if (!target) {
            brokenLinks.push(href)
          }
        }
      })

      if (brokenLinks.length > 0) {
        alerts.push({
          type: 'warning',
          message: `${brokenLinks.length} broken internal links`,
          timestamp: new Date(),
          url: window.location.href,
          details: { brokenLinks }
        })
      }

      // Check for missing canonical URLs
      const canonical = document.querySelector('link[rel="canonical"]')
      if (!canonical) {
        alerts.push({
          type: 'warning',
          message: 'Missing canonical URL',
          timestamp: new Date(),
          url: window.location.href
        })
      }

      // Check for duplicate content (basic check)
      const duplicateContent = checkForDuplicateContent()
      if (duplicateContent.length > 0) {
        alerts.push({
          type: 'warning',
          message: 'Potential duplicate content detected',
          timestamp: new Date(),
          url: window.location.href,
          details: { duplicateContent }
        })
      }

      // Send alerts to analytics
      alerts.forEach(alert => {
        trackEvent('seo_issue_detected', {
          issue_type: alert.type,
          issue_message: alert.message,
          page_url: alert.url,
          timestamp: alert.timestamp.toISOString(),
          ...alert.details
        })

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[SEO Alert] ${alert.type.toUpperCase()}: ${alert.message}`, alert.details)
        }
      })

      return alerts
    }

    // Check for duplicate content (simplified version)
    const checkForDuplicateContent = (): string[] => {
      const issues: string[] = []
      
      // Check for duplicate meta descriptions
      const metaDescriptions = document.querySelectorAll('meta[name="description"]')
      if (metaDescriptions.length > 1) {
        issues.push('Multiple meta description tags')
      }

      // Check for very short content
      const mainContent = document.querySelector('main, article, .content')
      if (mainContent) {
        const textContent = mainContent.textContent?.trim() || ''
        if (textContent.length < 300) {
          issues.push('Content too short (less than 300 characters)')
        }
      }

      return issues
    }

    // Monitor Core Web Vitals thresholds
    const monitorWebVitals = () => {
      // This will be handled by the WebVitalsMonitor component
      // Here we just set up alerts for when thresholds are exceeded
      
      const checkPerformanceThresholds = () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          const loadTime = navigation.loadEventEnd - navigation.fetchStart
          
          // Alert if page load time exceeds 3 seconds
          if (loadTime > 3000) {
            trackEvent('performance_alert', {
              metric: 'page_load_time',
              value: loadTime,
              threshold: 3000,
              severity: 'high',
              page_url: window.location.href
            })
          }
        }
      }

      // Check performance after page load
      setTimeout(checkPerformanceThresholds, 2000)
    }

    // Monitor mobile-friendliness
    const monitorMobileFriendliness = () => {
      const viewport = document.querySelector('meta[name="viewport"]')
      if (!viewport) {
        trackEvent('seo_issue_detected', {
          issue_type: 'error',
          issue_message: 'Missing viewport meta tag',
          page_url: window.location.href
        })
      }

      // Check for touch targets that are too small
      const touchTargets = document.querySelectorAll('a, button, input, select, textarea')
      const smallTargets = Array.from(touchTargets).filter(target => {
        const rect = target.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      })

      if (smallTargets.length > 0) {
        trackEvent('seo_issue_detected', {
          issue_type: 'warning',
          issue_message: `${smallTargets.length} touch targets too small`,
          page_url: window.location.href,
          details: { count: smallTargets.length }
        })
      }
    }

    // Monitor accessibility issues
    const monitorAccessibility = () => {
      const issues: string[] = []

      // Check for missing form labels
      const inputs = document.querySelectorAll('input, select, textarea')
      inputs.forEach(input => {
        const id = input.getAttribute('id')
        const ariaLabel = input.getAttribute('aria-label')
        const ariaLabelledBy = input.getAttribute('aria-labelledby')
        
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`)
          if (!label && !ariaLabel && !ariaLabelledBy) {
            issues.push(`Input missing label: ${id}`)
          }
        }
      })

      // Check for missing alt text on images
      const images = document.querySelectorAll('img')
      images.forEach(img => {
        if (!img.alt && !img.getAttribute('aria-label')) {
          issues.push(`Image missing alt text: ${img.src}`)
        }
      })

      // Check for proper heading hierarchy
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      let previousLevel = 0
      headings.forEach(heading => {
        const level = parseInt(heading.tagName.charAt(1))
        if (level > previousLevel + 1) {
          issues.push(`Heading hierarchy skip: ${heading.tagName}`)
        }
        previousLevel = level
      })

      if (issues.length > 0) {
        trackEvent('accessibility_issue_detected', {
          issue_count: issues.length,
          issues: issues.slice(0, 10), // Limit to first 10 issues
          page_url: window.location.href
        })
      }
    }

    // Run initial checks
    monitorSEOIssues()
    monitorWebVitals()
    monitorMobileFriendliness()
    monitorAccessibility()

    // Set up periodic monitoring
    const interval = setInterval(() => {
      monitorSEOIssues()
    }, 30000) // Check every 30 seconds

    // Cleanup
    return () => {
      clearInterval(interval)
    }
  }, [])

  return null // This component doesn't render anything
}

// Hook for manual SEO monitoring
export function useSEOMonitoring() {
  const checkPageSEO = () => {
    const issues: string[] = []

    // Check title length
    const title = document.querySelector('title')
    if (title) {
      const titleLength = title.textContent?.length || 0
      if (titleLength < 30) {
        issues.push('Title too short (less than 30 characters)')
      } else if (titleLength > 60) {
        issues.push('Title too long (more than 60 characters)')
      }
    }

    // Check meta description length
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      const descLength = metaDescription.getAttribute('content')?.length || 0
      if (descLength < 120) {
        issues.push('Meta description too short (less than 120 characters)')
      } else if (descLength > 160) {
        issues.push('Meta description too long (more than 160 characters)')
      }
    }

    // Check for proper heading structure
    const h1Count = document.querySelectorAll('h1').length
    if (h1Count === 0) {
      issues.push('No H1 tag found')
    } else if (h1Count > 1) {
      issues.push('Multiple H1 tags found')
    }

    return issues
  }

  const generateSEOReport = () => {
    const report = {
      url: window.location.href,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      h1Count: document.querySelectorAll('h1').length,
      h2Count: document.querySelectorAll('h2').length,
      imageCount: document.querySelectorAll('img').length,
      imageAltCount: document.querySelectorAll('img[alt]').length,
      internalLinkCount: document.querySelectorAll('a[href^="/"]').length,
      externalLinkCount: document.querySelectorAll('a[href^="http"]').length,
      issues: checkPageSEO()
    }

    return report
  }

  return {
    checkPageSEO,
    generateSEOReport
  }
}

// Export types for external use
export type { SearchConsoleAlert }
