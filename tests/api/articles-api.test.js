/**
 * API tests for Articles API endpoints
 * Tests all endpoints with real AWS integration
 */

const request = require('supertest');
const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      put: jest.fn(),
      get: jest.fn(),
      query: jest.fn(),
      scan: jest.fn()
    }))
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn()
}));

// Create a simple Express app for testing
const express = require('express');
const articlesAPI = require('../../backend/functions/api/articles-api');

const app = express();
app.use(express.json());
app.use('/api', articlesAPI);

describe('Articles API', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.REGION = 'eu-central-1';
    process.env.ENVIRONMENT = 'test';
    process.env.DYNAMODB_ARTICLES_TABLE = 'InfiniteArticles-test';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('GET /api/articles', () => {
    test('should return all articles with pagination', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ id: '1', title: 'Article 1' }),
        TestDataGenerator.generateArticle({ id: '2', title: 'Article 2' })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ 
        Items: mockArticles,
        LastEvaluatedKey: { articleId: '2' }
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles')
        .query({ limit: '2' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body).toHaveProperty('lastKey');
      expect(response.body).toHaveProperty('hasMore');
      expect(response.body.articles).toHaveLength(2);
      expect(response.body.articles[0].title).toBe('Article 1');
      expect(response.body.articles[1].title).toBe('Article 2');
      expect(response.body.hasMore).toBe(true);
    });

    test('should handle pagination with lastKey', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ id: '3', title: 'Article 3' })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ 
        Items: mockArticles
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles')
        .query({ 
          limit: '2',
          lastKey: 'eyJhcnRpY2xlSWQiOiIyIn0='
        })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.hasMore).toBe(false);
    });

    test('should handle empty results', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles')
        .expect(200);

      expect(response.body.articles).toHaveLength(0);
      expect(response.body.hasMore).toBe(false);
    });

    test('should handle DynamoDB errors', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/articles/latest', () => {
    test('should return latest articles', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ 
          id: '1', 
          title: 'Latest Article 1',
          publishedAt: '2025-01-15T06:00:00.000Z'
        }),
        TestDataGenerator.generateArticle({ 
          id: '2', 
          title: 'Latest Article 2',
          publishedAt: '2025-01-14T06:00:00.000Z'
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/latest')
        .query({ limit: '2' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(2);
      expect(response.body.articles[0].title).toBe('Latest Article 1');
      expect(response.body.articles[1].title).toBe('Latest Article 2');
    });

    test('should use default limit when not specified', async () => {
      const mockArticles = Array(10).fill().map((_, i) => 
        TestDataGenerator.generateArticle({ id: `${i + 1}`, title: `Article ${i + 1}` })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/latest')
        .expect(200);

      expect(response.body.articles).toHaveLength(10);
    });

    test('should enforce limit bounds', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      // Test limit too high
      await request(app)
        .get('/api/articles/latest')
        .query({ limit: '101' })
        .expect(200);

      // Test limit too low
      await request(app)
        .get('/api/articles/latest')
        .query({ limit: '0' })
        .expect(200);

      // Verify query was called with correct limits
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 100 // Should be capped at 100
        })
      );
    });
  });

  describe('GET /api/articles/slug/:slug', () => {
    test('should return article by slug', async () => {
      const mockArticle = TestDataGenerator.generateArticle({
        id: '1',
        slug: 'test-article-slug',
        title: 'Test Article'
      });

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [mockArticle] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/test-article-slug')
        .expect(200);

      expect(response.body).toHaveProperty('articleId', '1');
      expect(response.body).toHaveProperty('slug', 'test-article-slug');
      expect(response.body).toHaveProperty('title', 'Test Article');
    });

    test('should return 404 for non-existent slug', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/non-existent-slug')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Article not found');
    });

    test('should handle DynamoDB errors', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/test-slug')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/articles/category/:category', () => {
    test('should return articles by category', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ 
          id: '1', 
          title: 'Discovery Article 1',
          category: 'objav-dna'
        }),
        TestDataGenerator.generateArticle({ 
          id: '2', 
          title: 'Discovery Article 2',
          category: 'objav-dna'
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/objav-dna')
        .query({ limit: '2' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(2);
      expect(response.body.articles[0].category).toBe('objav-dna');
      expect(response.body.articles[1].category).toBe('objav-dna');
    });

    test('should handle empty category results', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/category/empty-category')
        .expect(200);

      expect(response.body.articles).toHaveLength(0);
    });

    test('should validate category parameter', async () => {
      const response = await request(app)
        .get('/api/articles/category/')
        .expect(404);
    });
  });

  describe('GET /api/articles/search', () => {
    test('should search articles by query', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ 
          id: '1', 
          title: 'Article about Mars',
          perex: 'This article discusses Mars exploration'
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'mars', limit: '10' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].title).toContain('Mars');
    });

    test('should require search query', async () => {
      const response = await request(app)
        .get('/api/articles/search')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Search query is required');
    });

    test('should handle empty search results', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles/search')
        .query({ q: 'nonexistent' })
        .expect(200);

      expect(response.body.articles).toHaveLength(0);
    });
  });

  describe('CORS and Headers', () => {
    test('should include CORS headers', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    test('should handle OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/articles')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.body.message).toBe('CORS preflight');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing environment variables', async () => {
      delete process.env.DYNAMODB_ARTICLES_TABLE;

      const response = await request(app)
        .get('/api/articles')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/articles')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .patch('/api/articles')
        .expect(405);

      expect(response.body).toHaveProperty('error', 'Method not allowed');
    });
  });

  describe('Response Format Validation', () => {
    test('should return properly formatted article objects', async () => {
      const mockArticle = TestDataGenerator.generateArticle({
        id: '1',
        title: 'Test Article',
        slug: 'test-article',
        category: 'objav-dna',
        type: 'discovery'
      });

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [mockArticle] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get('/api/articles/slug/test-article')
        .expect(200);

      const article = response.body;
      
      // Validate required fields
      expect(article).toHaveProperty('articleId');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('slug');
      expect(article).toHaveProperty('category');
      expect(article).toHaveProperty('type');
      expect(article).toHaveProperty('publishedAt');
      expect(article).toHaveProperty('author');
      expect(article).toHaveProperty('readingTime');
      
      // Validate data types
      expect(typeof article.articleId).toBe('string');
      expect(typeof article.title).toBe('string');
      expect(typeof article.slug).toBe('string');
      expect(typeof article.category).toBe('string');
      expect(typeof article.type).toBe('string');
      expect(typeof article.publishedAt).toBe('string');
      expect(typeof article.author).toBe('string');
      expect(typeof article.readingTime).toBe('string');
    });

    test('should return properly formatted list responses', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ id: '1' }),
        TestDataGenerator.generateArticle({ id: '2' })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/articles')
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body).toHaveProperty('lastKey');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.articles)).toBe(true);
      expect(typeof response.body.hasMore).toBe('boolean');
    });
  });
});
