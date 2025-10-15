/**
 * Unit tests for API client
 */

import { ArticlesAPI } from '../../../infinite-v2/lib/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('ArticlesAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  describe('getLatestArticles', () => {
    test('should fetch latest articles successfully', async () => {
      const mockArticles = [
        {
          id: '1',
          title: 'Test Article 1',
          slug: 'test-article-1',
          perex: 'Test excerpt 1',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15',
          author: 'AI Assistant',
          readingTime: '5 min',
          imageUrl: 'https://test.com/image1.jpg',
          metaTitle: 'Test Meta Title 1',
          metaDescription: 'Test meta description 1',
          type: 'discovery',
          tags: ['astronómia', 'vesmír']
        },
        {
          id: '2',
          title: 'Test Article 2',
          slug: 'test-article-2',
          perex: 'Test excerpt 2',
          category: 'tyzdenny-vyber',
          publishedAt: '2025-01-14T06:00:00.000Z',
          originalDate: '2025-01-14',
          author: 'AI Assistant',
          readingTime: '3 min',
          imageUrl: 'https://test.com/image2.jpg',
          metaTitle: 'Test Meta Title 2',
          metaDescription: 'Test meta description 2',
          type: 'weekly-pick',
          tags: ['hubble', 'galaxia']
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ articles: mockArticles })
      });

      const result = await ArticlesAPI.getLatestArticles(10);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/articles/latest?limit=10',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
          },
          next: {
            revalidate: 3600,
            tags: ['api-/articles/latest?limit=10']
          }
        })
      );

      expect(result).toEqual(mockArticles);
    });

    test('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await ArticlesAPI.getLatestArticles(5);

      expect(result).toEqual([]);
    });

    test('should handle non-ok responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await ArticlesAPI.getLatestArticles(5);

      expect(result).toEqual([]);
    });

    test('should use default limit when not specified', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ articles: [] })
      });

      await ArticlesAPI.getLatestArticles();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/articles/latest?limit=10',
        expect.any(Object)
      );
    });
  });

  describe('getAllArticles', () => {
    test('should fetch all articles with pagination', async () => {
      const mockResponse = {
        articles: [
          {
            id: '1',
            title: 'Test Article 1',
            slug: 'test-article-1',
            perex: 'Test excerpt 1',
            category: 'objav-dna',
            publishedAt: '2025-01-15T06:00:00.000Z',
            originalDate: '2025-01-15',
            author: 'AI Assistant',
            readingTime: '5 min',
            imageUrl: 'https://test.com/image1.jpg',
            metaTitle: 'Test Meta Title 1',
            metaDescription: 'Test meta description 1',
            type: 'discovery',
            tags: ['astronómia', 'vesmír']
          }
        ],
        lastKey: 'eyJkYXRlIjoiMjAyNS0wMS0xNSJ9',
        hasMore: true
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await ArticlesAPI.getAllArticles(20, 'eyJkYXRlIjoiMjAyNS0wMS0xNSJ9');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/articles?limit=20&lastKey=eyJkYXRlIjoiMjAyNS0wMS0xNSJ9',
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse);
    });

    test('should handle errors in getAllArticles', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await ArticlesAPI.getAllArticles(20);

      expect(result).toEqual({
        articles: [],
        lastKey: undefined,
        hasMore: false
      });
    });
  });

  describe('getArticleBySlug', () => {
    test('should fetch article by slug', async () => {
      const mockArticle = {
        id: '1',
        title: 'Test Article',
        slug: 'test-article',
        perex: 'Test excerpt',
        category: 'objav-dna',
        publishedAt: '2025-01-15T06:00:00.000Z',
        originalDate: '2025-01-15',
        author: 'AI Assistant',
        readingTime: '5 min',
        imageUrl: 'https://test.com/image.jpg',
        metaTitle: 'Test Meta Title',
        metaDescription: 'Test meta description',
        type: 'discovery',
        tags: ['astronómia', 'vesmír'],
        content: [
          { title: 'Úvod', content: 'Test content section 1' },
          { title: 'Hlavná časť', content: 'Test content section 2' }
        ],
        faq: [
          { question: 'Test question?', answer: 'Test answer.' }
        ],
        keywords: ['test', 'slovak', 'keywords']
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArticle)
      });

      const result = await ArticlesAPI.getArticleBySlug('test-article');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/articles/slug/test-article',
        expect.any(Object)
      );

      expect(result).toEqual(mockArticle);
    });

    test('should handle article not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await ArticlesAPI.getArticleBySlug('non-existent-article');

      expect(result).toBeNull();
    });
  });

  describe('getArticlesByCategory', () => {
    test('should fetch articles by category', async () => {
      const mockArticles = [
        {
          id: '1',
          title: 'Test Article 1',
          slug: 'test-article-1',
          perex: 'Test excerpt 1',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15',
          author: 'AI Assistant',
          readingTime: '5 min',
          imageUrl: 'https://test.com/image1.jpg',
          metaTitle: 'Test Meta Title 1',
          metaDescription: 'Test meta description 1',
          type: 'discovery',
          tags: ['astronómia', 'vesmír']
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ articles: mockArticles })
      });

      const result = await ArticlesAPI.getArticlesByCategory('objav-dna', 10);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/articles/category/objav-dna?limit=10',
        expect.any(Object)
      );

      expect(result).toEqual(mockArticles);
    });

    test('should handle category not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Category not found'
      });

      const result = await ArticlesAPI.getArticlesByCategory('non-existent-category');

      expect(result).toEqual([]);
    });
  });

  describe('searchArticles', () => {
    test('should search articles by query', async () => {
      const mockArticles = [
        {
          id: '1',
          title: 'Test Article about Mars',
          slug: 'test-article-mars',
          perex: 'Test excerpt about Mars',
          category: 'objav-dna',
          publishedAt: '2025-01-15T06:00:00.000Z',
          originalDate: '2025-01-15',
          author: 'AI Assistant',
          readingTime: '5 min',
          imageUrl: 'https://test.com/image1.jpg',
          metaTitle: 'Test Meta Title 1',
          metaDescription: 'Test meta description 1',
          type: 'discovery',
          tags: ['mars', 'planéta']
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ articles: mockArticles })
      });

      const result = await ArticlesAPI.searchArticles('mars', 10);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/articles/search?q=mars&limit=10',
        expect.any(Object)
      );

      expect(result).toEqual(mockArticles);
    });

    test('should handle search errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Search error'));

      const result = await ArticlesAPI.searchArticles('test query');

      expect(result).toEqual([]);
    });
  });

  describe('makeRequest', () => {
    test('should handle fetch errors with proper logging', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      try {
        await ArticlesAPI.getLatestArticles(5);
      } catch (error) {
        // Expected to be caught and return empty array
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching latest articles:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('should include proper headers and caching options', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ articles: [] })
      });

      await ArticlesAPI.getLatestArticles(5);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
          },
          next: {
            revalidate: 3600,
            tags: expect.any(Array)
          }
        })
      );
    });
  });
});
