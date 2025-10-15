/**
 * Intelligent prefetching strategies
 * Implements viewport, hover, and idle-based prefetching
 */

import { ArticlesAPI, Article } from './api';

export interface PrefetchOptions {
  strategy: 'viewport' | 'hover' | 'idle' | 'manual';
  priority?: 'high' | 'low';
  timeout?: number;
}

export interface PrefetchTarget {
  url: string;
  type: 'page' | 'article' | 'category';
  priority: 'high' | 'low';
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

/**
 * Prefetching strategies
 */
export const PrefetchStrategies = {
  // Viewport-based prefetching - prefetch links visible in viewport
  viewport: {
    threshold: 0.1, // Prefetch when 10% of link is visible
    rootMargin: '50px', // Start prefetching 50px before link enters viewport
  },
  
  // Hover-based prefetching - prefetch on hover with delay
  hover: {
    delay: 100, // Wait 100ms after hover before prefetching
    timeout: 5000, // Cancel prefetch if not completed within 5s
  },
  
  // Idle-based prefetching - prefetch during browser idle time
  idle: {
    timeout: 2000, // Wait for 2s of idle time before prefetching
    maxConcurrent: 3, // Maximum 3 concurrent prefetch requests
  },
  
  // Manual prefetching - explicit prefetch calls
  manual: {
    immediate: true, // Start prefetching immediately
  },
};

/**
 * Prefetch manager for intelligent link prefetching
 */
export class PrefetchManager {
  private prefetchedUrls = new Set<string>();
  private prefetchQueue: PrefetchTarget[] = [];
  private isProcessing = false;
  private intersectionObserver?: IntersectionObserver;
  private idleCallback?: number;

  constructor() {
    this.initializeViewportPrefetching();
    this.initializeIdlePrefetching();
  }

  /**
   * Initialize viewport-based prefetching
   */
  private initializeViewportPrefetching(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement;
            this.prefetchLink(link, 'viewport');
          }
        });
      },
      {
        threshold: PrefetchStrategies.viewport.threshold,
        rootMargin: PrefetchStrategies.viewport.rootMargin,
      }
    );

    // Observe all internal links
    this.observeLinks();
  }

  /**
   * Initialize idle-based prefetching
   */
  private initializeIdlePrefetching(): void {
    if (typeof window === 'undefined' || !('requestIdleCallback' in window)) {
      return;
    }

    const processIdlePrefetch = () => {
      if (this.prefetchQueue.length > 0 && !this.isProcessing) {
        this.processPrefetchQueue();
      }
      this.scheduleIdlePrefetch();
    };

    this.scheduleIdlePrefetch = () => {
      this.idleCallback = requestIdleCallback(processIdlePrefetch, {
        timeout: PrefetchStrategies.idle.timeout,
      });
    };

    this.scheduleIdlePrefetch();
  }

  private scheduleIdlePrefetch = (): void => {
    // Implementation will be set in initializeIdlePrefetching
  };

  /**
   * Observe all internal links for prefetching
   */
  private observeLinks(): void {
    const links = document.querySelectorAll('a[href^="/"]:not([data-no-prefetch])');
    links.forEach((link) => {
      this.intersectionObserver?.observe(link);
      
      // Add hover prefetching
      link.addEventListener('mouseenter', this.handleHover.bind(this));
    });
  }

  /**
   * Handle hover events for prefetching
   */
  private handleHover(event: Event): void {
    const link = event.target as HTMLAnchorElement;
    const href = link.getAttribute('href');
    
    if (!href || this.prefetchedUrls.has(href)) {
      return;
    }

    setTimeout(() => {
      this.prefetchLink(link, 'hover');
    }, PrefetchStrategies.hover.delay);
  }

  /**
   * Prefetch a specific link
   */
  private async prefetchLink(link: HTMLAnchorElement, strategy: PrefetchOptions['strategy']): Promise<void> {
    const href = link.getAttribute('href');
    if (!href || this.prefetchedUrls.has(href)) {
      return;
    }

    this.prefetchedUrls.add(href);

    const target: PrefetchTarget = {
      url: href,
      type: this.determineLinkType(href),
      priority: this.determinePriority(link, strategy),
      metadata: {
        title: link.getAttribute('title') || undefined,
      },
    };

    if (strategy === 'manual' || target.priority === 'high') {
      await this.executePrefetch(target);
    } else {
      this.prefetchQueue.push(target);
    }
  }

  /**
   * Determine the type of link for prefetching
   */
  private determineLinkType(href: string): PrefetchTarget['type'] {
    if (href.includes('/objav-dna/') || href.includes('/vesmirne-novinky/') || href.includes('/tyzdenny-vyber/')) {
      return 'article';
    } else if (href.includes('/kategoria/')) {
      return 'category';
    }
    return 'page';
  }

  /**
   * Determine prefetch priority based on link and strategy
   */
  private determinePriority(link: HTMLAnchorElement, strategy: string): 'high' | 'low' {
    // High priority for navigation links and current page context
    if (link.closest('nav') || link.getAttribute('data-priority') === 'high') {
      return 'high';
    }
    
    // High priority for viewport and manual strategies
    if (strategy === 'viewport' || strategy === 'manual') {
      return 'high';
    }
    
    return 'low';
  }

  /**
   * Process the prefetch queue during idle time
   */
  private async processPrefetchQueue(): Promise<void> {
    if (this.isProcessing || this.prefetchQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const maxConcurrent = PrefetchStrategies.idle.maxConcurrent;
    const batch = this.prefetchQueue.splice(0, maxConcurrent);

    await Promise.allSettled(
      batch.map((target) => this.executePrefetch(target))
    );

    this.isProcessing = false;
  }

  /**
   * Execute the actual prefetch
   */
  private async executePrefetch(target: PrefetchTarget): Promise<void> {
    try {
      // Prefetch the page
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = target.url;
      link.setAttribute('data-prefetch-type', target.type);
      link.setAttribute('data-prefetch-priority', target.priority);
      
      document.head.appendChild(link);

      // For article pages, also prefetch related data
      if (target.type === 'article') {
        await this.prefetchArticleData(target.url);
      }

      console.log(`[Prefetch] Prefetched ${target.type}: ${target.url}`);
    } catch (error) {
      console.error(`[Prefetch] Failed to prefetch ${target.url}:`, error);
    }
  }

  /**
   * Prefetch article-specific data
   */
  private async prefetchArticleData(url: string): Promise<void> {
    try {
      const slug = url.split('/').pop();
      if (slug) {
        // Prefetch article data in background
        ArticlesAPI.getArticleBySlug(slug).catch(() => {
          // Ignore errors for background prefetching
        });
      }
    } catch (error) {
      // Ignore errors for background prefetching
    }
  }

  /**
   * Manually prefetch a URL
   */
  public async prefetch(url: string, options: PrefetchOptions = { strategy: 'manual' }): Promise<void> {
    const link = document.createElement('a');
    link.href = url;
    await this.prefetchLink(link, options.strategy);
  }

  /**
   * Prefetch multiple URLs
   */
  public async prefetchMultiple(urls: string[], options: PrefetchOptions = { strategy: 'manual' }): Promise<void> {
    await Promise.allSettled(
      urls.map((url) => this.prefetch(url, options))
    );
  }

  /**
   * Get prefetch statistics
   */
  public getStats(): { prefetched: number; queued: number } {
    return {
      prefetched: this.prefetchedUrls.size,
      queued: this.prefetchQueue.length,
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.intersectionObserver?.disconnect();
    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback);
    }
    this.prefetchedUrls.clear();
    this.prefetchQueue = [];
  }
}

// Export singleton instance
export const prefetchManager = new PrefetchManager();