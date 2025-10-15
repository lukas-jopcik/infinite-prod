/**
 * API tests for Analytics API endpoints
 * Tests analytics and reporting functionality
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
const analyticsAPI = require('../../backend/functions/api/analytics-api');

const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsAPI);

describe('Analytics API', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.REGION = 'eu-central-1';
    process.env.ENVIRONMENT = 'test';
    process.env.DYNAMODB_ARTICLES_TABLE = 'InfiniteArticles-test';
    process.env.DYNAMODB_ANALYTICS_TABLE = 'InfiniteAnalytics-test';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('POST /api/analytics/track', () => {
    test('should track page view', async () => {
      const trackingData = {
        event: 'page_view',
        page: '/objav-dna/test-article',
        articleId: 'test-article-id',
        userId: 'user-123',
        timestamp: '2025-01-15T10:00:00.000Z'
      };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut
      });

      const response = await request(app)
        .post('/api/analytics/track')
        .send(trackingData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Event tracked successfully');
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteAnalytics-test',
          Item: expect.objectContaining({
            eventId: expect.any(String),
            event: 'page_view',
            page: '/objav-dna/test-article',
            articleId: 'test-article-id',
            userId: 'user-123',
            timestamp: '2025-01-15T10:00:00.000Z'
          })
        })
      );
    });

    test('should track article interaction', async () => {
      const trackingData = {
        event: 'article_interaction',
        articleId: 'test-article-id',
        interactionType: 'share',
        userId: 'user-123',
        metadata: { platform: 'facebook' }
      };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut
      });

      const response = await request(app)
        .post('/api/analytics/track')
        .send(trackingData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Event tracked successfully');
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            event: 'article_interaction',
            interactionType: 'share',
            metadata: { platform: 'facebook' }
          })
        })
      );
    });

    test('should validate required fields', async () => {
      const invalidData = {
        event: 'page_view'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/analytics/track')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    test('should validate event types', async () => {
      const invalidData = {
        event: 'invalid_event',
        page: '/test',
        userId: 'user-123'
      };

      const response = await request(app)
        .post('/api/analytics/track')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid event type');
    });

    test('should handle DynamoDB errors', async () => {
      const trackingData = {
        event: 'page_view',
        page: '/test',
        userId: 'user-123'
      };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut
      });

      const response = await request(app)
        .post('/api/analytics/track')
        .send(trackingData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/analytics/overview', () => {
    test('should return analytics overview', async () => {
      const mockAnalyticsData = [
        { event: 'page_view', timestamp: '2025-01-15T10:00:00.000Z', page: '/objav-dna/article1' },
        { event: 'page_view', timestamp: '2025-01-15T11:00:00.000Z', page: '/tyzdenny-vyber/article2' },
        { event: 'article_interaction', timestamp: '2025-01-15T12:00:00.000Z', interactionType: 'share' }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockAnalyticsData });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/overview')
        .query({ 
          startDate: '2025-01-15',
          endDate: '2025-01-15'
        })
        .expect(200);

      expect(response.body).toHaveProperty('totalViews');
      expect(response.body).toHaveProperty('totalInteractions');
      expect(response.body).toHaveProperty('topPages');
      expect(response.body).toHaveProperty('interactionTypes');
      expect(response.body.totalViews).toBe(2);
      expect(response.body.totalInteractions).toBe(1);
    });

    test('should handle date range filtering', async () => {
      const mockAnalyticsData = [
        { event: 'page_view', timestamp: '2025-01-15T10:00:00.000Z' },
        { event: 'page_view', timestamp: '2025-01-16T10:00:00.000Z' }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockAnalyticsData });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/overview')
        .query({ 
          startDate: '2025-01-15',
          endDate: '2025-01-16'
        })
        .expect(200);

      expect(response.body.totalViews).toBe(2);
    });

    test('should use default date range when not specified', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/overview')
        .expect(200);

      expect(response.body).toHaveProperty('totalViews', 0);
      expect(response.body).toHaveProperty('totalInteractions', 0);
    });

    test('should handle empty analytics data', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/overview')
        .expect(200);

      expect(response.body.totalViews).toBe(0);
      expect(response.body.totalInteractions).toBe(0);
      expect(response.body.topPages).toEqual([]);
      expect(response.body.interactionTypes).toEqual({});
    });
  });

  describe('GET /api/analytics/articles/:id', () => {
    test('should return article-specific analytics', async () => {
      const articleId = 'test-article-id';
      const mockAnalyticsData = [
        { 
          event: 'page_view', 
          articleId, 
          timestamp: '2025-01-15T10:00:00.000Z',
          userId: 'user-1'
        },
        { 
          event: 'article_interaction', 
          articleId, 
          interactionType: 'share',
          timestamp: '2025-01-15T11:00:00.000Z',
          userId: 'user-2'
        },
        { 
          event: 'article_interaction', 
          articleId, 
          interactionType: 'like',
          timestamp: '2025-01-15T12:00:00.000Z',
          userId: 'user-3'
        }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockAnalyticsData });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get(`/api/analytics/articles/${articleId}`)
        .expect(200);

      expect(response.body).toHaveProperty('articleId', articleId);
      expect(response.body).toHaveProperty('totalViews', 1);
      expect(response.body).toHaveProperty('totalInteractions', 2);
      expect(response.body).toHaveProperty('interactionBreakdown');
      expect(response.body.interactionBreakdown).toHaveProperty('share', 1);
      expect(response.body.interactionBreakdown).toHaveProperty('like', 1);
      expect(response.body).toHaveProperty('uniqueUsers', 3);
    });

    test('should handle article with no analytics', async () => {
      const articleId = 'no-analytics-article';

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get(`/api/analytics/articles/${articleId}`)
        .expect(200);

      expect(response.body.articleId).toBe(articleId);
      expect(response.body.totalViews).toBe(0);
      expect(response.body.totalInteractions).toBe(0);
      expect(response.body.uniqueUsers).toBe(0);
    });

    test('should handle date range filtering', async () => {
      const articleId = 'test-article-id';
      const mockAnalyticsData = [
        { 
          event: 'page_view', 
          articleId, 
          timestamp: '2025-01-15T10:00:00.000Z'
        }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockQuery = jest.fn().mockResolvedValue({ Items: mockAnalyticsData });
      DynamoDBDocumentClient.from.mockReturnValue({
        query: mockQuery
      });

      const response = await request(app)
        .get(`/api/analytics/articles/${articleId}`)
        .query({
          startDate: '2025-01-15',
          endDate: '2025-01-15'
        })
        .expect(200);

      expect(response.body.totalViews).toBe(1);
    });
  });

  describe('GET /api/analytics/popular', () => {
    test('should return popular articles', async () => {
      const mockAnalyticsData = [
        { event: 'page_view', articleId: 'article-1', timestamp: '2025-01-15T10:00:00.000Z' },
        { event: 'page_view', articleId: 'article-1', timestamp: '2025-01-15T11:00:00.000Z' },
        { event: 'page_view', articleId: 'article-2', timestamp: '2025-01-15T12:00:00.000Z' },
        { event: 'article_interaction', articleId: 'article-1', interactionType: 'share' }
      ];

      const mockArticles = [
        TestDataGenerator.generateArticle({ id: 'article-1', title: 'Popular Article 1' }),
        TestDataGenerator.generateArticle({ id: 'article-2', title: 'Popular Article 2' })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn()
        .mockResolvedValueOnce({ Items: mockAnalyticsData })
        .mockResolvedValueOnce({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/popular')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(2);
      expect(response.body.articles[0]).toHaveProperty('articleId');
      expect(response.body.articles[0]).toHaveProperty('viewCount');
      expect(response.body.articles[0]).toHaveProperty('interactionCount');
      expect(response.body.articles[0]).toHaveProperty('title');
    });

    test('should limit results based on query parameter', async () => {
      const mockAnalyticsData = Array(20).fill().map((_, i) => ({
        event: 'page_view',
        articleId: `article-${i + 1}`,
        timestamp: '2025-01-15T10:00:00.000Z'
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockAnalyticsData });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/popular')
        .query({ limit: '5' })
        .expect(200);

      expect(response.body.articles.length).toBeLessThanOrEqual(5);
    });

    test('should sort by popularity score', async () => {
      const mockAnalyticsData = [
        { event: 'page_view', articleId: 'article-1' },
        { event: 'page_view', articleId: 'article-1' },
        { event: 'article_interaction', articleId: 'article-1', interactionType: 'share' },
        { event: 'page_view', articleId: 'article-2' }
      ];

      const mockArticles = [
        TestDataGenerator.generateArticle({ id: 'article-1', title: 'Most Popular' }),
        TestDataGenerator.generateArticle({ id: 'article-2', title: 'Less Popular' })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn()
        .mockResolvedValueOnce({ Items: mockAnalyticsData })
        .mockResolvedValueOnce({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/popular')
        .expect(200);

      expect(response.body.articles[0].articleId).toBe('article-1');
      expect(response.body.articles[0].viewCount).toBe(2);
      expect(response.body.articles[0].interactionCount).toBe(1);
    });
  });

  describe('GET /api/analytics/trends', () => {
    test('should return analytics trends', async () => {
      const mockAnalyticsData = [
        { event: 'page_view', timestamp: '2025-01-15T10:00:00.000Z' },
        { event: 'page_view', timestamp: '2025-01-15T11:00:00.000Z' },
        { event: 'page_view', timestamp: '2025-01-16T10:00:00.000Z' },
        { event: 'article_interaction', timestamp: '2025-01-16T11:00:00.000Z' }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockAnalyticsData });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/trends')
        .query({
          startDate: '2025-01-15',
          endDate: '2025-01-16',
          granularity: 'daily'
        })
        .expect(200);

      expect(response.body).toHaveProperty('trends');
      expect(response.body.trends).toHaveProperty('views');
      expect(response.body.trends).toHaveProperty('interactions');
      expect(Array.isArray(response.body.trends.views)).toBe(true);
      expect(Array.isArray(response.body.trends.interactions)).toBe(true);
    });

    test('should handle different granularities', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const granularities = ['hourly', 'daily', 'weekly', 'monthly'];
      
      for (const granularity of granularities) {
        const response = await request(app)
          .get('/api/analytics/trends')
          .query({ granularity })
          .expect(200);

        expect(response.body).toHaveProperty('trends');
        expect(response.body.trends).toHaveProperty('views');
        expect(response.body.trends).toHaveProperty('interactions');
      }
    });

    test('should validate granularity parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/trends')
        .query({ granularity: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid granularity');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing environment variables', async () => {
      delete process.env.DYNAMODB_ANALYTICS_TABLE;

      const response = await request(app)
        .get('/api/analytics/overview')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle DynamoDB errors', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/analytics/overview')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid date formats', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .query({ 
          startDate: 'invalid-date',
          endDate: '2025-01-15'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid date format');
    });

    test('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .patch('/api/analytics/overview')
        .expect(405);

      expect(response.body).toHaveProperty('error', 'Method not allowed');
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
        .get('/api/analytics/overview')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    test('should handle OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/analytics/overview')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.body.message).toBe('CORS preflight');
    });
  });
});
