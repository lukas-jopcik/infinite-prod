/**
 * Integration tests for ESA Hubble workflow
 * Tests the complete flow: RSS fetch → AI generation → image processing → storage
 */

const { AWSMockHelper, TestDataGenerator, HTTPTestHelper, AssertionHelper } = require('../helpers/test-utils');

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

// Mock RSS parser
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn()
  }));
});

// Mock Sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed image data'))
  }));
});

// Import Lambda functions
const esaHubbleFetcher = require('../../backend/functions/scheduled/esa-hubble-potw-fetcher');
const aiContentGenerator = require('../../backend/functions/scheduled/ai-content-generator');

describe('ESA Hubble Workflow Integration', () => {
  let mockContext;
  let mockEvent;

  beforeEach(() => {
    AWSMockHelper.mockAll();
    mockContext = TestDataGenerator.generateLambdaContext();
    mockEvent = {};
    
    // Set environment variables
    process.env.ENVIRONMENT = 'test';
    process.env.AWS_REGION = 'eu-central-1';
    process.env.REGION = 'eu-central-1';
    process.env.DYNAMODB_RAW_CONTENT_TABLE = 'InfiniteRawContent-test';
    process.env.DYNAMODB_ARTICLES_TABLE = 'InfiniteArticles-test';
    process.env.S3_IMAGES_BUCKET = 'infinite-images-test';
    process.env.OPENAI_SECRET_ARN = 'arn:aws:secretsmanager:eu-central-1:123456789012:secret:openai-key';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('Complete ESA Hubble Workflow', () => {
    test('should execute full ESA Hubble workflow successfully', async () => {
      const mockRSSFeed = {
        items: [
          {
            title: 'Test ESA Hubble Image',
            description: 'Test description of ESA Hubble image',
            pubDate: 'Wed, 15 Jan 2025 12:00:00 GMT',
            link: 'https://esahubble.org/images/test/',
            'content:encoded': '<p>Test content with <img src="https://esahubble.org/images/test.jpg" alt="Test image"></p>'
          }
        ]
      };

      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Test Slovak Title',
              perex: 'Test Slovak excerpt about ESA Hubble image',
              content: [
                { title: 'Úvod', content: 'Test content section 1 about the image' },
                { title: 'Hlavná časť', content: 'Test content section 2 with more details' },
                { title: 'Záver', content: 'Test conclusion section' }
              ],
              faq: [
                { question: 'Čo je to za objekt?', answer: 'Toto je testovací objekt z ESA Hubble.' }
              ],
              keywords: ['esa', 'hubble', 'vesmír', 'galaxia']
            })
          }
        }]
      };

      // Mock RSS parser
      const Parser = require('rss-parser');
      const mockParser = {
        parseURL: jest.fn().mockResolvedValue(mockRSSFeed)
      };
      Parser.mockImplementation(() => mockParser);

      // Mock AWS services
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const { S3Client } = require('@aws-sdk/client-s3');
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

      // Mock DynamoDB operations
      const mockPut = jest.fn().mockResolvedValue({});
      const mockQuery = jest.fn().mockResolvedValue({ Items: [] }); // No duplicates
      const mockScan = jest.fn().mockResolvedValue({ Items: [] }); // No raw content initially
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        query: mockQuery,
        scan: mockScan,
        update: mockUpdate
      });

      // Mock S3 operations
      const mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      // Mock Secrets Manager
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      // Step 1: ESA Hubble Fetcher
      const fetcherResult = await esaHubbleFetcher.handler(mockEvent, mockContext);
      expect(fetcherResult.statusCode).toBe(200);
      
      const fetcherBody = JSON.parse(fetcherResult.body);
      expect(fetcherBody.results.totalItems).toBe(1);
      expect(fetcherBody.results.newItems).toBe(1);

      // Verify raw content was stored
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteApodArchive-test',
          Item: expect.objectContaining({
            contentId: expect.any(String),
            source: 'esa-hubble-potw',
            title: 'Test ESA Hubble Image',
            category: 'tyzdenny-vyber',
            status: 'pending',
            imageUrl: 'https://esahubble.org/images/test.jpg'
          })
        })
      );

      // Step 2: AI Content Generator (simulate processing the raw content)
      const mockRawContent = [{
        contentId: 'test-content-id',
        source: 'esa-hubble-potw',
        title: 'Test ESA Hubble Image',
        description: 'Test description of ESA Hubble image',
        imageUrl: 'https://esahubble.org/images/test.jpg',
        date: '2025-01-15',
        category: 'tyzdenny-vyber',
        status: 'raw'
      }];

      // Mock scan to return the raw content
      mockScan.mockResolvedValue({ Items: mockRawContent });

      // Mock HTTP request to OpenAI
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const generatorResult = await aiContentGenerator.handler(mockEvent, mockContext);
      expect(generatorResult.statusCode).toBe(200);
      
      const generatorBody = JSON.parse(generatorResult.body);
      expect(generatorBody.processedCount).toBe(1);
      expect(generatorBody.errorCount).toBe(0);

      // Verify article was created
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteArticles-test',
          Item: expect.objectContaining({
            articleId: expect.any(String),
            type: 'weekly-pick',
            title: 'Test Slovak Title',
            category: 'tyzdenny-vyber',
            status: 'published',
            content: expect.arrayContaining([
              { title: 'Úvod', content: 'Test content section 1 about the image' },
              { title: 'Hlavná časť', content: 'Test content section 2 with more details' },
              { title: 'Záver', content: 'Test conclusion section' }
            ]),
            faq: expect.arrayContaining([
              { question: 'Čo je to za objekt?', answer: 'Toto je testovací objekt z ESA Hubble.' }
            ]),
            tags: ['esa', 'hubble', 'vesmír', 'galaxia']
          })
        })
      );

      // Verify raw content status was updated
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteRawContent-test',
          Key: { contentId: 'test-content-id', source: 'esa-hubble-potw' },
          UpdateExpression: 'SET status = :status',
          ExpressionAttributeValues: { ':status': 'processed' }
        })
      );

      restoreHTTPS();
    });

    test('should handle duplicate content detection', async () => {
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
  });

  describe('Image Processing Workflow', () => {
    test('should process and optimize images for different sizes', async () => {
      const mockRawContent = [{
        contentId: 'test-content-id',
        source: 'esa-hubble-potw',
        title: 'Test ESA Hubble Image',
        description: 'Test description',
        imageUrl: 'https://esahubble.org/images/test.jpg',
        date: '2025-01-15',
        category: 'tyzdenny-vyber',
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

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const { S3Client } = require('@aws-sdk/client-s3');
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      const mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockS3Send).toHaveBeenCalledWith(expect.any(Object));
      
      // Verify different image sizes were processed
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.images).toHaveProperty('hero');
      expect(item.images).toHaveProperty('card');
      expect(item.images).toHaveProperty('og');
      expect(item.images).toHaveProperty('thumb');

      restoreHTTPS();
    });

    test('should handle image processing errors gracefully', async () => {
      const mockRawContent = [{
        contentId: 'test-content-id',
        source: 'esa-hubble-potw',
        title: 'Test ESA Hubble Image',
        description: 'Test description',
        imageUrl: 'https://esahubble.org/images/test.jpg',
        date: '2025-01-15',
        category: 'tyzdenny-vyber',
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

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const { S3Client } = require('@aws-sdk/client-s3');
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      // Mock S3 error
      const mockS3Send = jest.fn().mockRejectedValue(new Error('S3 error'));
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.processedCount).toBe(0);
      expect(body.errorCount).toBe(1);

      restoreHTTPS();
    });
  });

  describe('Content Validation and Quality', () => {
    test('should validate generated content quality', async () => {
      const mockRawContent = [{
        contentId: 'test-content-id',
        source: 'esa-hubble-potw',
        title: 'Test ESA Hubble Image',
        description: 'Test description',
        imageUrl: 'https://esahubble.org/images/test.jpg',
        date: '2025-01-15',
        category: 'tyzdenny-vyber',
        status: 'raw'
      }];

      // Mock high-quality OpenAI response
      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Kvalitný slovenský názov článku',
              perex: 'Toto je veľmi kvalitný slovenský perex s diakritikou a odbornými termínmi z oblasti astronómie a vesmírneho výskumu.',
              content: [
                { title: 'Úvod', content: 'Toto je úvodná časť článku s veľkým množstvom detailov o ESA Hubble teleskope a jeho pozorovaní.' },
                { title: 'Hlavná časť', content: 'Hlavná časť obsahuje komplexné informácie o pozorovanom objekte, jeho vlastnostiach a významu pre astronómiu.' },
                { title: 'Technické detaily', content: 'Technické detaily o spôsobe pozorovania, použitých prístrojoch a metódach spracovania dát.' },
                { title: 'Záver', content: 'Záverečná časť sumarizuje dôležitosť tohto pozorovania pre vedecký výskum a budúce štúdie.' }
              ],
              faq: [
                { question: 'Čo je to za objekt?', answer: 'Toto je galaxia pozorovaná pomocou ESA Hubble teleskopu.' },
                { question: 'Prečo je to dôležité?', answer: 'Toto pozorovanie prispieva k lepšiemu pochopeniu formovania galaxií.' }
              ],
              keywords: ['esa', 'hubble', 'galaxia', 'astronómia', 'vesmír', 'pozorovanie', 'veda']
            })
          }
        }]
      };

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const { S3Client } = require('@aws-sdk/client-s3');
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      const mockS3Send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });
      S3Client.mockImplementation(() => ({
        send: mockS3Send
      }));

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.processedCount).toBe(1);
      expect(body.errorCount).toBe(0);

      // Verify high-quality content was stored
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.title).toBe('Kvalitný slovenský názov článku');
      expect(item.perex).toContain('diakritikou');
      expect(item.content).toHaveLength(4);
      expect(item.faq).toHaveLength(2);
      expect(item.tags).toContain('astronómia');
      expect(item.tags).toContain('vesmír');

      restoreHTTPS();
    });

    test('should reject low-quality content', async () => {
      const mockRawContent = [{
        contentId: 'test-content-id',
        source: 'esa-hubble-potw',
        title: 'Test ESA Hubble Image',
        description: 'Test description',
        imageUrl: 'https://esahubble.org/images/test.jpg',
        date: '2025-01-15',
        category: 'tyzdenny-vyber',
        status: 'raw'
      }];

      // Mock low-quality OpenAI response
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

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      const mockPut = jest.fn().mockResolvedValue({});
      const mockUpdate = jest.fn().mockResolvedValue({});
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan,
        put: mockPut,
        update: mockUpdate
      });

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.processedCount).toBe(0);
      expect(body.errorCount).toBe(1);

      // Verify no article was created
      expect(mockPut).not.toHaveBeenCalled();

      restoreHTTPS();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle OpenAI API errors', async () => {
      const mockRawContent = [{
        contentId: 'test-content-id',
        source: 'esa-hubble-potw',
        title: 'Test ESA Hubble Image',
        description: 'Test description',
        imageUrl: 'https://esahubble.org/images/test.jpg',
        date: '2025-01-15',
        category: 'tyzdenny-vyber',
        status: 'raw'
      }];

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

      const mockScan = jest.fn().mockResolvedValue({ Items: mockRawContent });
      DynamoDBDocumentClient.from.mockReturnValue({
        scan: mockScan
      });

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ OPENAI_API_KEY: 'test-openai-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      // Mock OpenAI API error
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.processedCount).toBe(0);
      expect(body.errorCount).toBe(1);

      restoreHTTPS();
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

    test('should handle missing environment variables', async () => {
      delete process.env.DYNAMODB_RAW_CONTENT_TABLE;

      const result = await aiContentGenerator.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });
  });
});
