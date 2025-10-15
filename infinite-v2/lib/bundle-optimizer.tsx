/**
 * Bundle size optimization utilities
 * Provides code splitting, tree shaking, and dynamic imports
 */

import React, { Suspense, ComponentType, lazy } from 'react';
import { SpaceLoading } from '@/components/space-loading';

/**
 * Dynamically import components with loading states
 */
export const DynamicComponents = {
  // Lazy load heavy components
  CategoryArticles: lazy(() => import('@/components/category-articles-simple').then(module => ({ default: module.CategoryArticlesSimple }))),
  AdManager: lazy(() => import('@/components/ad-manager').then(module => ({ default: module.AdManager }))),
  PerformanceMonitor: lazy(() => import('@/components/performance-monitor').then(module => ({ default: module.PerformanceMonitor }))),
  SpaceArticleTemplate: lazy(() => import('@/components/space-article-template')),
  AnalyticsDashboard: lazy(() => import('@/components/analytics-dashboard').then(module => ({ default: module.AnalyticsDashboard }))),
};

/**
 * Higher-order component for dynamic imports with error boundaries
 */
export function withDynamicImport<T extends object>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);
  
  return function DynamicComponent(props: T) {
    return (
      <Suspense fallback={fallback || <SpaceLoading />}>
        <LazyComponent {...(props as any)} />
      </Suspense>
    );
  };
}

/**
 * Code splitting utilities
 */
export const CodeSplitting = {
  /**
   * Split by feature - only components with default exports
   */
  features: {
    SpaceArticleTemplate: lazy(() => import('@/components/space-article-template')),
    PerformanceMonitor: lazy(() => import('@/components/performance-monitor').then(module => ({ default: module.PerformanceMonitor }))),
  },
};

/**
 * Tree shaking utilities
 */
export const TreeShaking = {
  /**
   * Import only specific functions from large libraries
   */
  imports: {
    // Import only needed icons from lucide-react
    lucideIcons: {
      Calendar: () => import('lucide-react').then(m => ({ default: m.Calendar })),
      Search: () => import('lucide-react').then(m => ({ default: m.Search })),
      Menu: () => import('lucide-react').then(m => ({ default: m.Menu })),
      ArrowRight: () => import('lucide-react').then(m => ({ default: m.ArrowRight })),
      ExternalLink: () => import('lucide-react').then(m => ({ default: m.ExternalLink })),
    },

    // Import only needed utilities from date-fns
    dateFns: {
      format: () => import('date-fns/format'),
      parseISO: () => import('date-fns/parseISO'),
      formatDistanceToNow: () => import('date-fns/formatDistanceToNow'),
    },

    // Import only needed functions from clsx
    clsx: () => import('clsx'),
  },

  /**
   * Conditional imports based on environment
   */
  conditional: {
    // Only import dev tools in development
    devTools: () => {
      if (process.env.NODE_ENV === 'development') {
        return Promise.resolve({ default: () => null });
      }
      return Promise.resolve({ default: () => null });
    },

    // Only import analytics in production
    analytics: () => {
      if (process.env.NODE_ENV === 'production') {
        return import('@/components/google-analytics');
      }
      return Promise.resolve({ default: () => null });
    },
  },
};

/**
 * Bundle analysis utilities
 */
export const BundleAnalysis = {
  /**
   * Get component bundle size
   */
  getComponentSize: (componentName: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const entries = performance.getEntriesByType('resource');
      const componentEntry = entries.find(entry => 
        entry.name.includes(componentName.toLowerCase())
      );
      return componentEntry ? Math.round((componentEntry as any).transferSize / 1024) : null;
    }
    return null;
  },

  /**
   * Monitor bundle loading performance
   */
  monitorBundleLoading: () => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource' && entry.name.includes('_next/static/chunks/')) {
            console.log(`[Bundle] Loaded: ${entry.name} (${Math.round((entry as any).transferSize / 1024)}KB)`);
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
      return () => observer.disconnect();
    }
    return () => {};
  },
};

/**
 * Preload critical resources
 */
export const PreloadManager = {
  /**
   * Preload critical components
   */
  preloadCritical: () => {
    if (typeof window !== 'undefined') {
      // Preload navigation and footer (always visible)
      import('@/components/navigation');
      import('@/components/footer');
      
      // Preload common components
      import('@/components/space-loading');
      import('@/components/breadcrumbs');
    }
  },

  /**
   * Preload route-specific components
   */
  preloadRoute: (route: string) => {
    if (typeof window !== 'undefined') {
      switch (route) {
        case '/':
          import('@/app/page');
          break;
        case '/kategoria':
          import('@/app/kategoria/[slug]/page');
          import('@/components/category-articles-simple');
          break;
        case '/objav-dna':
          import('@/app/objav-dna/[slug]/page');
          // import('@/components/article-detail'); // Component doesn't exist
          break;
        case '/hladat':
          import('@/app/hladat/page');
          // import('@/components/search-form'); // Component doesn't exist
          break;
      }
    }
  },
};