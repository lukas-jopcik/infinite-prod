// API service for fetching articles from Lambda backend
import { cache, CacheKeys } from './cache';

export interface Article {
  id: string;
  title: string;
  slug: string;
  perex: string;
  category: string;
  publishedAt: string;
  originalDate: string;
  author: string;
  readingTime: string;
  imageUrl?: string;
  image?: string; // Add image field for frontend compatibility
  imageAlt?: string; // Add imageAlt for accessibility
  metaTitle: string;
  metaDescription: string;
  type: string;
  tags: string[];
  source?: string;
  sourceUrl?: string;
  communityEngagement?: {
    upvotes?: number;
    comments?: number;
    awards?: number;
    engagementScore?: number;
  };
  selectedExcerpt?: string;
  discussionHighlights?: string[];
  // Image license fields
  imageLicense?: string;
  imageCreditText?: string;
  imageCopyrightNotice?: string;
  imageAcquireLicensePage?: string;
  imageSource?: string;
  imagePhotographer?: string;
  imagePhotographerUrl?: string;
}

export interface ArticleDetail extends Article {
  content: { title: string; content: string }[]; // Sections from AI generator
  sections?: { title: string; content: string }[]; // Alias for content
  subheads?: string[]; // Subheadings for news articles
  faq: { question: string; answer: string }[];
  images?: {
    og?: string;
    hero?: string;
    card?: string;
    thumb?: string;
  };
  heroImage?: {
    src: string;
    alt: string;
    credit?: string;
  };
  inlineImage?: {
    src: string;
    alt: string;
    credit?: string;
  };
  inlineImage2?: {
    src: string;
    alt: string;
    credit?: string;
  };
  keywords?: string[];
  source?: string;
  sourceUrl?: string;
  cta?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export class ArticlesAPI {
  private static async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[API] Fetching from:', url, 'API_BASE_URL:', API_BASE_URL);
    
    // Add Next.js caching options for SSG/ISR support
    const fetchOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      next: {
        revalidate: 3600, // Cache for 1 hour
        tags: [`api-${endpoint}`], // For on-demand revalidation
      },
      ...options,
    };
    
    const response = await fetch(url, fetchOptions).catch((error) => {
      console.error('[API] Fetch error:', error, 'URL:', url);
      throw error;
    });

    if (!response.ok) {
      console.error('[API] HTTP error:', response.status, response.statusText, 'URL:', url);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  static async getLatestArticles(limit: number = 10): Promise<Article[]> {
    try {
      const response = await this.makeRequest(`/articles/latest?limit=${limit}`);
      return response.articles || [];
    } catch (error) {
      console.error('Error fetching latest articles:', error);
      return [];
    }
  }

  static async getAllArticles(limit: number = 20, lastKey?: string): Promise<{
    articles: Article[];
    lastKey?: string;
    count: number;
  }> {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (lastKey) {
        params.append('lastKey', lastKey);
      }
      
      const response = await this.makeRequest(`/articles?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error fetching all articles:', error);
      return { articles: [], count: 0 };
    }
  }

  static async getArticleById(id: string): Promise<ArticleDetail | null> {
    try {
      const response = await this.makeRequest(`/articles/${id}`);
      return response.article || null;
    } catch (error) {
      console.error('Error fetching article:', error);
      return null;
    }
  }

  static async getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
    try {
      // URL encode the slug to handle diacritics and special characters
      const encodedSlug = encodeURIComponent(slug);
      const response = await this.makeRequest(`/articles/slug/${encodedSlug}`);
      return response;
    } catch (error) {
      console.error('Error fetching article by slug:', error);
      return null;
    }
  }

  static async getArticlesByCategory(category: string, limit: number = 20, lastKey?: string): Promise<{
    articles: Article[];
    lastKey?: string;
    count: number;
  }> {
    try {
      // Check cache first
      const cached = await cache.getCachedArticlesByCategory(category);
      if (cached && !lastKey) {
        console.log('Cache hit for category:', category);
        return { articles: cached, count: cached.length };
      }

      const params = new URLSearchParams({ limit: limit.toString() });
      if (lastKey) {
        params.append('lastKey', lastKey);
      }
      
      const response = await this.makeRequest(`/articles/category/${category}?${params.toString()}`);
      
      // Cache the result
      if (response.articles && !lastKey) {
        await cache.cacheArticlesByCategory(category, response.articles);
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching articles by category:', error);
      // Fallback to getAllArticles with client-side filtering
      const allArticles = await this.getAllArticles(100);
      const filteredArticles = allArticles.articles.filter(article => article.category === category);
      return { articles: filteredArticles, count: filteredArticles.length };
    }
  }

  static async searchArticles(query: string, limit: number = 20, lastKey?: string): Promise<{
    articles: Article[];
    lastKey?: string;
    count: number;
    total: number;
    query: string;
  }> {
    try {
      const params = new URLSearchParams({ 
        q: query,
        limit: limit.toString() 
      });
      if (lastKey) {
        params.append('lastKey', lastKey);
      }
      
      const response = await this.makeRequest(`/articles/search?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error searching articles:', error);
      return { articles: [], count: 0, total: 0, query };
    }
  }
}

