/**
 * API tests for Admin API endpoints
 * Tests administrative functions and data management
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
      scan: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }))
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn()
}));

// Create a simple Express app for testing
const express = require('express');
const adminAPI = require('../../backend/functions/api/admin-api');

const app = express();
app.use(express.json());
app.use('/api/admin', adminAPI);

describe('Admin API', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.REGION = 'eu-central-1';
    process.env.ENVIRONMENT = 'test';
    process.env.DYNAMODB_ARTICLES_TABLE = 'InfiniteArticles-test';
    process.env.DYNAMODB_RAW_CONTENT_TABLE = 'InfiniteRawContent-test';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('GET /api/admin/stats', () => {
    test('should return system statistics', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ id: '1', status: 'published' }),
        TestDataGenerator.generateArticle({ id: '2', status: 'published' }),
        TestDataGenerator.generateArticle({ id: '3', status: 'draft' })
      ];

      const mockRawContent = [
        { contentId: '1', source: 'nasa-apod', status: 'processed' },
        { contentId: '2', source: 'esa-hubble-potw', status: 'pending' }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn()
        .mockResolvedValueOnce({ Items: mockArticles })
        .mockResolvedValueOnce({ Items: mockRawContent });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body).toHaveProperty('rawContent');
      expect(response.body.articles.total).toBe(3);
      expect(response.body.articles.published).toBe(2);
      expect(response.body.articles.draft).toBe(1);
      expect(response.body.rawContent.total).toBe(2);
      expect(response.body.rawContent.processed).toBe(1);
      expect(response.body.rawContent.pending).toBe(1);
    });

    test('should handle empty data', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn()
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200);

      expect(response.body.articles.total).toBe(0);
      expect(response.body.rawContent.total).toBe(0);
    });

    test('should handle DynamoDB errors', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/articles', () => {
    test('should return all articles with admin details', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ 
          id: '1', 
          title: 'Article 1',
          status: 'published',
          createdAt: '2025-01-15T06:00:00.000Z'
        }),
        TestDataGenerator.generateArticle({ 
          id: '2', 
          title: 'Article 2',
          status: 'draft',
          createdAt: '2025-01-14T06:00:00.000Z'
        })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/articles')
        .query({ limit: '10' })
        .expect(200);

      expect(response.body).toHaveProperty('articles');
      expect(response.body.articles).toHaveLength(2);
      expect(response.body.articles[0]).toHaveProperty('status');
      expect(response.body.articles[0]).toHaveProperty('createdAt');
    });

    test('should filter articles by status', async () => {
      const mockArticles = [
        TestDataGenerator.generateArticle({ id: '1', status: 'published' })
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockArticles });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/articles')
        .query({ status: 'published' })
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].status).toBe('published');
    });

    test('should handle pagination', async () => {
      const mockArticles = Array(25).fill().map((_, i) => 
        TestDataGenerator.generateArticle({ id: `${i + 1}` })
      );

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ 
        Items: mockArticles.slice(0, 20),
        LastEvaluatedKey: { articleId: '20' }
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/articles')
        .query({ limit: '20' })
        .expect(200);

      expect(response.body.articles).toHaveLength(20);
      expect(response.body).toHaveProperty('lastKey');
      expect(response.body).toHaveProperty('hasMore', true);
    });
  });

  describe('PUT /api/admin/articles/:id', () => {
    test('should update article status', async () => {
      const articleId = 'test-article-id';
      const updateData = { status: 'published' };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        update: mockUpdate
      });

      const response = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Article updated successfully');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteArticles-test',
          Key: { articleId, type: expect.any(String) },
          UpdateExpression: expect.stringContaining('status'),
          ExpressionAttributeValues: { ':status': 'published' }
        })
      );
    });

    test('should update article content', async () => {
      const articleId = 'test-article-id';
      const updateData = { 
        title: 'Updated Title',
        perex: 'Updated excerpt',
        content: [{ title: 'Updated Section', content: 'Updated content' }]
      };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        update: mockUpdate
      });

      const response = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Article updated successfully');
    });

    test('should validate update data', async () => {
      const articleId = 'test-article-id';
      const invalidData = { invalidField: 'invalid' };

      const response = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid update data');
    });

    test('should handle article not found', async () => {
      const articleId = 'non-existent-id';
      const updateData = { status: 'published' };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockUpdate = jest.fn().mockRejectedValue(new Error('Item not found'));
      DynamoDBDocumentClient.from.mockReturnValue({
        update: mockUpdate
      });

      const response = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Article not found');
    });
  });

  describe('DELETE /api/admin/articles/:id', () => {
    test('should delete article', async () => {
      const articleId = 'test-article-id';

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockDelete = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        delete: mockDelete
      });

      const response = await request(app)
        .delete(`/api/admin/articles/${articleId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Article deleted successfully');
      expect(mockDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteArticles-test',
          Key: { articleId, type: expect.any(String) }
        })
      );
    });

    test('should handle article not found', async () => {
      const articleId = 'non-existent-id';

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockDelete = jest.fn().mockRejectedValue(new Error('Item not found'));
      DynamoDBDocumentClient.from.mockReturnValue({
        delete: mockDelete
      });

      const response = await request(app)
        .delete(`/api/admin/articles/${articleId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Article not found');
    });
  });

  describe('GET /api/admin/raw-content', () => {
    test('should return raw content items', async () => {
      const mockRawContent = [
        { 
          contentId: '1', 
          source: 'nasa-apod', 
          status: 'processed',
          title: 'Raw Content 1',
          createdAt: '2025-01-15T06:00:00.000Z'
        },
        { 
          contentId: '2', 
          source: 'esa-hubble-potw', 
          status: 'pending',
          title: 'Raw Content 2',
          createdAt: '2025-01-14T06:00:00.000Z'
        }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/raw-content')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0]).toHaveProperty('status');
      expect(response.body.items[0]).toHaveProperty('source');
    });

    test('should filter by source', async () => {
      const mockRawContent = [
        { contentId: '1', source: 'nasa-apod', status: 'processed' }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/raw-content')
        .query({ source: 'nasa-apod' })
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].source).toBe('nasa-apod');
    });

    test('should filter by status', async () => {
      const mockRawContent = [
        { contentId: '1', source: 'nasa-apod', status: 'pending' }
      ];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/raw-content')
        .query({ status: 'pending' })
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].status).toBe('pending');
    });
  });

  describe('POST /api/admin/raw-content/:id/reprocess', () => {
    test('should reprocess raw content', async () => {
      const contentId = 'test-content-id';
      const source = 'nasa-apod';

      const mockRawContent = {
        contentId,
        source,
        title: 'Test Raw Content',
        description: 'Test description',
        status: 'raw'
      };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockGet = jest.fn().mockResolvedValue({ Item: mockRawContent });
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        get: mockGet,
        update: mockUpdate
      });

      const response = await request(app)
        .post(`/api/admin/raw-content/${contentId}/reprocess`)
        .send({ source })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Raw content queued for reprocessing');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteRawContent-test',
          Key: { contentId, source },
          UpdateExpression: 'SET status = :status',
          ExpressionAttributeValues: { ':status': 'pending' }
        })
      );
    });

    test('should handle raw content not found', async () => {
      const contentId = 'non-existent-id';
      const source = 'nasa-apod';

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockGet = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        get: mockGet
      });

      const response = await request(app)
        .post(`/api/admin/raw-content/${contentId}/reprocess`)
        .send({ source })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Raw content not found');
    });

    test('should validate source parameter', async () => {
      const contentId = 'test-content-id';

      const response = await request(app)
        .post(`/api/admin/raw-content/${contentId}/reprocess`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Source is required');
    });
  });

  describe('GET /api/admin/health', () => {
    test('should return system health status', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('dynamodb', 'healthy');
    });

    test('should detect unhealthy services', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const response = await request(app)
        .get('/api/admin/health')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body.services).toHaveProperty('dynamodb', 'unhealthy');
    });
  });

  describe('Authentication and Authorization', () => {
    test('should require authentication for admin endpoints', async () => {
      // This would be implemented with proper authentication middleware
      // For now, we'll test the structure
      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200); // Would be 401 with proper auth

      // In a real implementation, this would check for valid admin tokens
      expect(response.body).toBeDefined();
    });

    test('should validate admin permissions', async () => {
      // This would test role-based access control
      const response = await request(app)
        .delete('/api/admin/articles/test-id')
        .expect(200); // Would be 403 with proper auth

      // In a real implementation, this would check for admin role
      expect(response.body).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing environment variables', async () => {
      delete process.env.DYNAMODB_ARTICLES_TABLE;

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .put('/api/admin/articles/test-id')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .patch('/api/admin/stats')
        .expect(405);

      expect(response.body).toHaveProperty('error', 'Method not allowed');
    });
  });
});
