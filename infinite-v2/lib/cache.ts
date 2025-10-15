import { Article } from './api';

// Redis connection configuration - only on server side
let redis: any = null;

if (typeof window === 'undefined') {
  // Only import Redis on server side
  const Redis = require('ioredis');
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

// Cache keys generator
export const CacheKeys = {
  articlesByCategory: (category: string) => `articles:category:${category}`,
  articleById: (id: string) => `article:id:${id}`,
  articleBySlug: (slug: string) => `article:slug:${slug}`,
  latestArticles: (limit: number) => `articles:latest:${limit}`,
  searchArticles: (query: string, limit: number) => `articles:search:${query}:${limit}`,
};

// Cache utility class
export class Cache {
  private static instance: Cache;
  private redis: any;

  constructor() {
    this.redis = redis;
  }

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    if (!redis) {
      console.warn('[Cache] Redis not available on client side');
      return null;
    }
    
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[Cache] Error getting key:', key, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    if (!redis) {
      console.warn('[Cache] Redis not available on client side');
      return;
    }
    
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('[Cache] Error setting key:', key, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!redis) {
      console.warn('[Cache] Redis not available on client side');
      return;
    }
    
    try {
      await redis.del(key);
    } catch (error) {
      console.error('[Cache] Error deleting key:', key, error);
    }
  }

  // Article-specific cache methods
  async getCachedArticlesByCategory(category: string): Promise<Article[] | null> {
    return this.get<Article[]>(CacheKeys.articlesByCategory(category));
  }

  async cacheArticlesByCategory(category: string, articles: Article[]): Promise<void> {
    await this.set(CacheKeys.articlesByCategory(category), articles, 1800); // 30 minutes
  }

  async getCachedArticleById(id: string): Promise<Article | null> {
    return this.get<Article>(CacheKeys.articleById(id));
  }

  async cacheArticleById(id: string, article: Article): Promise<void> {
    await this.set(CacheKeys.articleById(id), article, 3600); // 1 hour
  }

  async getCachedArticleBySlug(slug: string): Promise<Article | null> {
    return this.get<Article>(CacheKeys.articleBySlug(slug));
  }

  async cacheArticleBySlug(slug: string, article: Article): Promise<void> {
    await this.set(CacheKeys.articleBySlug(slug), article, 3600); // 1 hour
  }

  async getCachedLatestArticles(limit: number): Promise<Article[] | null> {
    return this.get<Article[]>(CacheKeys.latestArticles(limit));
  }

  async cacheLatestArticles(limit: number, articles: Article[]): Promise<void> {
    await this.set(CacheKeys.latestArticles(limit), articles, 900); // 15 minutes
  }

  // Cache invalidation methods
  async invalidateCategory(category: string): Promise<void> {
    await this.del(CacheKeys.articlesByCategory(category));
  }

  async invalidateArticle(id: string, slug?: string): Promise<void> {
    await this.del(CacheKeys.articleById(id));
    if (slug) {
      await this.del(CacheKeys.articleBySlug(slug));
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    if (!redis) {
      return false;
    }
    
    try {
      await redis.ping();
      return true;
    } catch (error) {
      console.error('[Cache] Health check failed:', error);
      return false;
    }
  }

  // Close connection
  async close(): Promise<void> {
    if (redis) {
      await redis.quit();
    }
  }
}

// Export singleton instance
export const cache = Cache.getInstance();