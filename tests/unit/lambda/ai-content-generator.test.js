/**
 * Unit tests for AI Content Generator Lambda function
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
      query: jest.fn(),
      scan: jest.fn(),
      update: jest.fn()
    }))
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
  UpdateCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn()
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: jest.fn()
  })),
  GetSecretValueCommand: jest.fn()
}));

// Mock Sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed image data'))
  }));
});

const aiContentGenerator = require('../../../backend/functions/scheduled/ai-content-generator');

describe('AI Content Generator Lambda', () => {
  let mockContext;
  let mockEvent;

  beforeEach(() => {
    AWSMockHelper.mockAll();
    mockContext = TestDataGenerator.generateLambdaContext();
    mockEvent = {};
    
    // Set environment variables
    process.env.REGION = 'eu-central-1';
    process.env.ENVIRONMENT = 'test';
    process.env.DYNAMODB_RAW_CONTENT_TABLE = 'InfiniteRawContent-test';
    process.env.DYNAMODB_ARTICLES_TABLE = 'InfiniteArticles-test';
    process.env.S3_IMAGES_BUCKET = 'infinite-images-test';
    process.env.OPENAI_SECRET_ARN = 'arn:aws:secretsmanager:eu-central-1:123456789012:secret:openai-key';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('Raw content processing', () => {
    test('should process raw content items and generate articles', async () => {
      const mockRawContent = [
        {
          contentId: 'test-content-1',
          source: 'nasa-apod',
          title: 'Test APOD Title',
          description: 'Test APOD description',
          imageUrl: 'https://apod.nasa.gov/test.jpg',
          date: '2025-01-15',
          category: 'objav-dna',
          status: 'raw'
        }
      ];

      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Test Slovak Title',
              perex: 'Test Slovak excerpt',
              content: [
                { title: 'Úvod', content: 'Test content section 1' },
                { title: 'Hlavná časť', content: 'Test content section 2' }
              ],
              faq: [
                { question: 'Test question?', answer: 'Test answer.' }
              ],
              keywords: ['test', 'slovak', 'keywords']
            })
          }
        }]
      };

      // Mock Secrets Manager
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      // Mock DynamoDB
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      // Mock S3
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      // Mock HTTP request to OpenAI
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteRawContent-test',
          FilterExpression: 'status = :status',
          ExpressionAttributeValues: { ':status': 'raw' }
        })
      );
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteArticles-test',
          Item: expect.objectContaining({
            articleId: expect.any(String),
            type: 'discovery',
            title: 'Test Slovak Title',
            category: 'objav-dna',
            status: 'published'
          })
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteRawContent-test',
          Key: { contentId: 'test-content-1', source: 'nasa-apod' },
          UpdateExpression: 'SET status = :status',
          ExpressionAttributeValues: { ':status': 'processed' }
        })
      );

      restoreHTTPS();
    });

    test('should handle no raw content items', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.message).toContain('No raw content items found');
      expect(body.processedCount).toBe(0);
    });

    test('should process specific content ID when provided', async () => {
      const mockEvent = {
        contentId: 'specific-content-id',
        source: 'nasa-apod'
      };

      const mockRawContent = {
        contentId: 'specific-content-id',
        source: 'nasa-apod',
        title: 'Specific Test Title',
        description: 'Specific test description',
        imageUrl: 'https://apod.nasa.gov/specific.jpg',
        date: '2025-01-15',
        category: 'objav-dna',
        status: 'raw'
      };

      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Specific Slovak Title',
              perex: 'Specific Slovak excerpt',
              content: [{ title: 'Úvod', content: 'Specific content' }],
              faq: [],
              keywords: ['specific']
            })
          }
        }]
      };

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockGet = jest.fn().mockResolvedValue({ Item: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        get: mockGet,
        put: mockPut,
        update: mockUpdate
      });

      const { S3Client } = require('@aws-sdk/client-s3');
      const mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteRawContent-test',
          Key: { contentId: 'specific-content-id', source: 'nasa-apod' }
        })
      );

      restoreHTTPS();
    });
  });

  describe('OpenAI integration', () => {
    test('should generate Slovak article using OpenAI', async () => {
      const mockRawContent = [{
        contentId: 'test-content-1',
        source: 'nasa-apod',
        title: 'Test APOD Title',
        description: 'Test APOD description',
        imageUrl: 'https://apod.nasa.gov/test.jpg',
        date: '2025-01-15',
        category: 'objav-dna',
        status: 'raw'
      }];

      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Test Slovak Title',
              perex: 'Test Slovak excerpt',
              content: [{ title: 'Úvod', content: 'Test content' }],
              faq: [],
              keywords: ['test']
            })
          }
        }]
      };

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      const { S3Client } = require('@aws-sdk/client-s3');
      const mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            title: 'Test Slovak Title',
            perex: 'Test Slovak excerpt',
            content: [{ title: 'Úvod', content: 'Test content' }],
            faq: [],
            tags: ['test']
          })
        })
      );

      restoreHTTPS();
    });

    test('should handle OpenAI API errors', async () => {
      const mockRawContent = [{
        contentId: 'test-content-1',
        source: 'nasa-apod',
        title: 'Test APOD Title',
        description: 'Test APOD description',
        imageUrl: 'https://apod.nasa.gov/test.jpg',
        date: '2025-01-15',
        category: 'objav-dna',
        status: 'raw'
      }];

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200); // Should continue processing other items
      
      const body = JSON.parse(result.body);
      expect(body.processedCount).toBe(0);
      expect(body.errorCount).toBe(1);

      restoreHTTPS();
    });

    test('should validate generated content', async () => {
      const mockRawContent = [{
        contentId: 'test-content-1',
        source: 'nasa-apod',
        title: 'Test APOD Title',
        description: 'Test APOD description',
        imageUrl: 'https://apod.nasa.gov/test.jpg',
        date: '2025-01-15',
        category: 'objav-dna',
        status: 'raw'
      }];

      // Mock invalid OpenAI response (too short content)
      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Short',
              perex: 'Short excerpt',
              content: [{ title: 'Úvod', content: 'Short content' }],
              faq: [],
              keywords: ['short']
            })
          }
        }]
      };

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.processedCount).toBe(0);
      expect(body.errorCount).toBe(1);

      restoreHTTPS();
    });
  });

  describe('Image processing', () => {
    test('should process and optimize images', async () => {
      const mockRawContent = [{
        contentId: 'test-content-1',
        source: 'nasa-apod',
        title: 'Test APOD Title',
        description: 'Test APOD description',
        imageUrl: 'https://apod.nasa.gov/test.jpg',
        date: '2025-01-15',
        category: 'objav-dna',
        status: 'raw'
      }];

      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Test Slovak Title',
              perex: 'Test Slovak excerpt',
              content: [{ title: 'Úvod', content: 'Test content' }],
              faq: [],
              keywords: ['test']
            })
          }
        }]
      };

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockS3Send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.images).toHaveProperty('hero');
      expect(item.images).toHaveProperty('card');
      expect(item.images).toHaveProperty('og');
      expect(item.images).toHaveProperty('thumb');

      restoreHTTPS();
    });
  });

  describe('Error handling', () => {
    test('should handle missing environment variables', async () => {
      delete process.env.DYNAMODB_RAW_CONTENT_TABLE;

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });

    test('should handle DynamoDB errors', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });

    test('should handle S3 errors gracefully', async () => {
      const mockRawContent = [{
        contentId: 'test-content-1',
        source: 'nasa-apod',
        title: 'Test APOD Title',
        description: 'Test APOD description',
        imageUrl: 'https://apod.nasa.gov/test.jpg',
        date: '2025-01-15',
        category: 'objav-dna',
        status: 'raw'
      }];

      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Test Slovak Title',
              perex: 'Test Slovak excerpt',
              content: [{ title: 'Úvod', content: 'Test content' }],
              faq: [],
              keywords: ['test']
            })
          }
        }]
      };

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      const { S3Client } = require('@aws-sdk/client-s3');
      const mockS3Send = jest.fn().mockRejectedValue(new Error('S3 error'));
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200); // Should continue processing
      
      const body = JSON.parse(result.body);
      expect(body.processedCount).toBe(0);
      expect(body.errorCount).toBe(1);

      restoreHTTPS();
    });
  });

  describe('Response format', () => {
    test('should return properly formatted response', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      AssertionHelper.expectValidAPIResponse(result);
      expect(result.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('processedCount');
      expect(body).toHaveProperty('errorCount');
      expect(body).toHaveProperty('results');
      expect(Array.isArray(body.results)).toBe(true);
    });
  });
});
