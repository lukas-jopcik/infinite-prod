/**
 * Unit tests for Content Processor Lambda function
 */

const { AWSMockHelper, TestDataGenerator, HTTPTestHelper, AssertionHelper } = require('../../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      put: jest.fn(),
      get: jest.fn(),
      query: jest.fn()
    }))
  },
  S3: jest.fn(() => ({
    putObject: jest.fn(),
    headObject: jest.fn(),
    getObject: jest.fn()
  })),
  SecretsManager: jest.fn(() => ({
    getSecretValue: jest.fn()
  }))
}));

const contentProcessor = require('../../../aws/lambda/content-processor/index');

describe('Content Processor Lambda', () => {
  let mockContext;
  let mockEvent;

  beforeEach(() => {
    AWSMockHelper.mockAll();
    mockContext = TestDataGenerator.generateLambdaContext();
    
    // Set environment variables
    process.env.DYNAMODB_TABLE_NAME = 'test-table';
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.CLOUDFRONT_DOMAIN = 'test-cloudfront.net';
    process.env.OPENAI_SECRET_NAME = 'test-secret';
    process.env.REGION = 'eu-central-1';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('OpenAI integration', () => {
    test('should generate Slovak article from NASA data', async () => {
      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      // Mock DynamoDB put
      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      // Mock S3 operations
      const mockS3Put = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"test-etag"' });
      });
      const mockS3Head = jest.fn().mockImplementation((params, callback) => {
        callback({ code: 'NotFound' }, null);
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockS3Put,
        headObject: mockS3Head
      }));

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-table',
          Item: expect.objectContaining({
            date: '2025-01-15',
            pk: 'LATEST',
            slovakTitle: expect.any(String),
            slovakArticle: expect.any(String),
            contentQuality: expect.any(Number)
          })
        }),
        expect.any(Function)
      );

      restoreHTTPS();
    });

    test('should handle OpenAI API errors', async () => {
      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });

    test('should validate generated content quality', async () => {
      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse({
        choices: [{
          message: {
            content: 'Krátky článok bez diakritiky a s AI disclaimerom. As an AI, I cannot provide specific details.'
          }
        }]
      });

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      const mockS3Put = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"test-etag"' });
      });
      const mockS3Head = jest.fn().mockImplementation((params, callback) => {
        callback({ code: 'NotFound' }, null);
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockS3Put,
        headObject: mockS3Head
      }));

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      // Verify quality validation was applied
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.contentQuality).toBeLessThan(100);
      expect(item.qualityIssues).toContain('Article too short');
      expect(item.qualityIssues).toContain('Missing Slovak diacritics');
      expect(item.qualityIssues).toContain('Contains AI disclaimer');

      restoreHTTPS();
    });
  });

  describe('Image caching', () => {
    test('should cache image to S3 if not already cached', async () => {
      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      // Mock S3 headObject to return NotFound (image not cached)
      const mockS3Head = jest.fn().mockImplementation((params, callback) => {
        callback({ code: 'NotFound' }, null);
      });
      const mockS3Put = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"test-etag"' });
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockS3Put,
        headObject: mockS3Head
      }));

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockS3Head).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'images/2025-01-15.jpg'
        }),
        expect.any(Function)
      );
      expect(mockS3Put).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'images/2025-01-15.jpg',
          Body: expect.any(Buffer)
        }),
        expect.any(Function)
      );

      restoreHTTPS();
    });

    test('should skip caching if image already exists', async () => {
      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      // Mock S3 headObject to return success (image already cached)
      const mockS3Head = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ContentType: 'image/jpeg' });
      });
      const mockS3Put = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"test-etag"' });
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockS3Put,
        headObject: mockS3Head
      }));

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockS3Head).toHaveBeenCalled();
      expect(mockS3Put).not.toHaveBeenCalled(); // Should not upload if already exists

      restoreHTTPS();
    });
  });

  describe('DynamoDB storage', () => {
    test('should store processed content with correct structure', async () => {
      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      const mockS3Put = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"test-etag"' });
      });
      const mockS3Head = jest.fn().mockImplementation((params, callback) => {
        callback({ code: 'NotFound' }, null);
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockS3Put,
        headObject: mockS3Head
      }));

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      AssertionHelper.expectValidDynamoDBItem(item);
      expect(item.cachedImage).toHaveProperty('url');
      expect(item.cachedImage.url).toContain('test-cloudfront.net');

      restoreHTTPS();
    });

    test('should handle DynamoDB errors', async () => {
      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('DynamoDB error'), null);
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      const mockS3Put = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"test-etag"' });
      });
      const mockS3Head = jest.fn().mockImplementation((params, callback) => {
        callback({ code: 'NotFound' }, null);
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockS3Put,
        headObject: mockS3Head
      }));

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });
  });

  describe('Error handling', () => {
    test('should handle missing environment variables', async () => {
      delete process.env.DYNAMODB_TABLE_NAME;

      const mockEvent = {
        date: '2025-01-15',
        nasaData: TestDataGenerator.generateNASAAPODResponse()
      };

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });

    test('should handle invalid event data', async () => {
      const mockEvent = {};

      const result = await contentProcessor.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Invalid event data');
    });
  });
});
