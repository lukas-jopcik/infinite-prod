/**
 * Unit tests for ESA Hubble POTW Fetcher Lambda function
 */

const { AWSMockHelper, TestDataGenerator, HTTPTestHelper, AssertionHelper } = require('../../helpers/test-utils');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      put: jest.fn(),
      get: jest.fn(),
      query: jest.fn()
    }))
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn()
}));

// Mock RSS parser
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn()
  }));
});

const esaHubbleFetcher = require('../../../backend/functions/scheduled/esa-hubble-potw-fetcher');

describe('ESA Hubble POTW Fetcher Lambda', () => {
  let mockContext;
  let mockEvent;

  beforeEach(() => {
    AWSMockHelper.mockAll();
    mockContext = TestDataGenerator.generateLambdaContext();
    mockEvent = {};
    
    // Set environment variables
    process.env.ENVIRONMENT = 'test';
    process.env.AWS_REGION = 'eu-central-1';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('RSS feed parsing', () => {
    test('should parse RSS feed and process items', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content with <img src="https://esahubble.org/images/test.jpg" alt="Test image"></p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] }); // No duplicates
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockParser.parseURL).toHaveBeenCalledWith('https://feeds.feedburner.com/esahubble/images/potw/');
      
      const body = JSON.parse(result.body);
      expect(body.message).toContain('completed successfully');
      expect(body.results.totalItems).toBe(1);
      expect(body.results.newItems).toBe(1);
      expect(body.results.skippedItems).toBe(0);

      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteApodArchive-test',
          Item: expect.objectContaining({
            contentId: expect.any(String),
            source: 'esa-hubble-potw',
            title: 'Test ESA Hubble Image',
            status: 'pending'
          })
        })
      );
    });

    test('should handle RSS parsing errors', async () => {
      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockRejectedValue(new Error('RSS parsing failed'))
      };
      Parser.mockImplementation(() => mockParser);

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Failed to fetch ESA Hubble POTW content');
    });

    test('should handle empty RSS feed', async () => {
      const mockRSSFeed = { items: [] };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.results.totalItems).toBe(0);
      expect(body.results.newItems).toBe(0);
      expect(body.results.skippedItems).toBe(0);
    });
  });

  describe('Item processing', () => {
    test('should extract image URL from content:encoded', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content with <img src="https://esahubble.org/images/test.jpg" alt="Test image"></p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.imageUrl).toBe('https://esahubble.org/images/test.jpg');
      expect(item.title).toBe('Test ESA Hubble Image');
      expect(item.source).toBe('esa-hubble-potw');
      expect(item.category).toBe('tyzdenny-vyber');
    });

    test('should handle items without images', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Article',
            description: 'Test description',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/articles/test/',
            'content:encoded': '<p>Test content without images</p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.imageUrl).toBeUndefined();
      expect(item.title).toBe('Test ESA Hubble Article');
    });

    test('should convert pubDate to ISO date format', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content</p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.date).toBe('2025-01-15');
      expect(item.originalDate).toBe('2025-01-15');
    });
  });

  describe('Duplicate detection', () => {
    test('should skip processing duplicate items', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content</p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ 
        Items: [{ contentId: 'existing-item' }] // Simulate existing item
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.results.newItems).toBe(0);
      expect(body.results.skippedItems).toBe(1);
      expect(mockPut).not.toHaveBeenCalled(); // Should not create duplicate
    });

    test('should process new items when no duplicates found', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content</p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] }); // No duplicates
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.results.newItems).toBe(1);
      expect(body.results.skippedItems).toBe(0);
      expect(mockPut).toHaveBeenCalled(); // Should create new item
    });
  });

  describe('Error handling', () => {
    test('should handle DynamoDB errors gracefully', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content</p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200); // Should continue processing other items
      
      const body = JSON.parse(result.body);
      expect(body.results.errors).toHaveLength(1);
      expect(body.results.errors[0].title).toBe('Test ESA Hubble Image');
      expect(body.results.errors[0].error).toContain('DynamoDB error');
    });

    test('should handle missing environment variables', async () => {
      delete process.env.ENVIRONMENT;

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });

    test('should handle invalid pubDate format', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description',
            pubDate: 'Invalid date format',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content</p>'
          }
        ]
      };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery
      });

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      // Should handle invalid date gracefully
      expect(item.date).toBeUndefined();
      expect(item.originalDate).toBeUndefined();
    });
  });

  describe('Response format', () => {
    test('should return properly formatted success response', async () => {
      const mockRSSFeed = { items: [] };

      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      const result = await esaHubbleFetcher.handler(mockEvent, mockContext);

      AssertionHelper.expectValidAPIResponse(result);
      expect(result.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('results');
      expect(body.results).toHaveProperty('totalItems');
      expect(body.results).toHaveProperty('newItems');
      expect(body.results).toHaveProperty('skippedItems');
      expect(body.results).toHaveProperty('errors');
      expect(Array.isArray(body.results.errors)).toBe(true);
    });
  });
});
