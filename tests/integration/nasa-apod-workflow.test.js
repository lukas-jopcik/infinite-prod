/**
 * Integration tests for NASA APOD workflow
 * Tests the complete flow: fetch → process → store → display
 */

const { AWSMockHelper, TestDataGenerator, HTTPTestHelper, AssertionHelper } = require('../helpers/test-utils');

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
  Lambda: jest.fn(() => ({
    invoke: jest.fn()
  })),
  SecretsManager: jest.fn(() => ({
    getSecretValue: jest.fn()
  }))
}));

// Import Lambda functions
const nasaFetcher = require('../../aws/lambda/nasa-fetcher/index');
const contentProcessor = require('../../aws/lambda/content-processor/index');
const apiLatest = require('../../aws/lambda/api-latest/index');

describe('NASA APOD Workflow Integration', () => {
  let mockContext;
  let mockEvent;

  beforeEach(() => {
    AWSMockHelper.mockAll();
    mockContext = TestDataGenerator.generateLambdaContext();
    mockEvent = { mode: 'daily' };
    
    // Set environment variables
    process.env.NASA_API_KEY = 'test-nasa-key';
    process.env.PROCESSOR_FUNCTION = 'infinite-nasa-apod-dev-content-processor';
    process.env.DYNAMODB_TABLE_NAME = 'infinite-nasa-apod-dev-content';
    process.env.S3_BUCKET_NAME = 'infinite-nasa-apod-dev-images-349660737637';
    process.env.CLOUDFRONT_DOMAIN = 'd2ydyf9w4v170.cloudfront.net';
    process.env.OPENAI_SECRET_NAME = 'test-openai-secret';
    process.env.TABLE_NAME = 'infinite-nasa-apod-dev-content';
    process.env.INDEX_NAME = 'gsi_latest';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('Complete Daily Workflow', () => {
    test('should execute full NASA APOD workflow successfully', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();

      // Mock NASA API response
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      // Mock AWS services
      const AWS = require('aws-sdk');
      
      // Mock Lambda invoke for content processor
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      // Mock DynamoDB operations
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Items: [] });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut,
        get: mockGet,
        query: mockQuery
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

      // Mock Secrets Manager
      const mockGetSecret = jest.fn().mockImplementation((params, callback) => {
        callback(null, { 
          SecretString: JSON.stringify({ 
            OPENAI_API_KEY: 'test-openai-key' 
          }) 
        });
      });
      AWS.SecretsManager.mockImplementation(() => ({
        getSecretValue: mockGetSecret
      }));

      // Step 1: NASA Fetcher
      const fetcherResult = await nasaFetcher.handler(mockEvent, mockContext);
      expect(fetcherResult.statusCode).toBe(200);
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          FunctionName: 'infinite-nasa-apod-dev-content-processor',
          InvocationType: 'Event'
        }),
        expect.any(Function)
      );

      // Step 2: Content Processor (simulate the invoked function)
      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      // Mock OpenAI response for content processor
      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);

      const processorResult = await contentProcessor.handler(processorEvent, mockContext);
      expect(processorResult.statusCode).toBe(200);
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          Item: expect.objectContaining({
            date: mockNASAResponse.date,
            pk: 'LATEST',
            slovakTitle: expect.any(String),
            slovakArticle: expect.any(String),
            contentQuality: expect.any(Number)
          })
        }),
        expect.any(Function)
      );

      // Step 3: API Latest (retrieve processed content)
      const apiEvent = TestDataGenerator.generateAPIGatewayEvent({
        queryStringParameters: { limit: '1' }
      });

      // Mock DynamoDB query for API
      const mockDynamoDBQuery = jest.fn().mockImplementation((params, callback) => {
        const mockItem = TestDataGenerator.generateDynamoDBItem({
          date: mockNASAResponse.date
        });
        callback(null, { Items: [mockItem] });
      });
      AWS.DynamoDB.mockImplementation(() => ({
        query: mockDynamoDBQuery
      }));

      const apiResult = await apiLatest.handler(apiEvent, mockContext);
      expect(apiResult.statusCode).toBe(200);
      
      const apiBody = JSON.parse(apiResult.body);
      expect(apiBody.items).toHaveLength(1);
      expect(apiBody.items[0].date).toBe(mockNASAResponse.date);

      restoreHTTPS();
      restoreOpenAI();
    });

    test('should handle workflow errors gracefully', async () => {
      // Mock NASA API error
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });

    test('should validate data consistency across workflow', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const AWS = require('aws-sdk');
      
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

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

      const mockGetSecret = jest.fn().mockImplementation((params, callback) => {
        callback(null, { 
          SecretString: JSON.stringify({ 
            OPENAI_API_KEY: 'test-openai-key' 
          }) 
        });
      });
      AWS.SecretsManager.mockImplementation(() => ({
        getSecretValue: mockGetSecret
      }));

      // Execute fetcher
      await nasaFetcher.handler(mockEvent, mockContext);

      // Verify the payload passed to content processor
      const invokeCall = mockInvoke.mock.calls[0];
      const payload = JSON.parse(invokeCall[0].Payload);
      
      expect(payload.date).toBe(mockNASAResponse.date);
      expect(payload.nasaData.title).toBe(mockNASAResponse.title);
      expect(payload.nasaData.explanation).toBe(mockNASAResponse.explanation);

      // Execute content processor
      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);
      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      await contentProcessor.handler(processorEvent, mockContext);

      // Verify the data stored in DynamoDB
      const putCall = mockPut.mock.calls[0];
      const storedItem = putCall[0].Item;
      
      expect(storedItem.date).toBe(mockNASAResponse.date);
      expect(storedItem.pk).toBe('LATEST');
      expect(storedItem.originalTitle).toBe(mockNASAResponse.title);
      expect(storedItem.originalExplanation).toBe(mockNASAResponse.explanation);
      expect(storedItem.slovakTitle).toBeDefined();
      expect(storedItem.slovakArticle).toBeDefined();
      expect(storedItem.contentQuality).toBeGreaterThan(0);

      restoreHTTPS();
      restoreOpenAI();
    });
  });

  describe('Image Caching Workflow', () => {
    test('should cache image and update CloudFront URL', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const AWS = require('aws-sdk');
      
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      // Mock S3 operations for image caching
      const mockS3Put = jest.fn().mockImplementation((params, callback) => {
        callback(null, { ETag: '"test-etag"' });
      });
      const mockS3Head = jest.fn().mockImplementation((params, callback) => {
        callback({ code: 'NotFound' }, null); // Image not cached yet
      });
      AWS.S3.mockImplementation(() => ({
        putObject: mockS3Put,
        headObject: mockS3Head
      }));

      const mockGetSecret = jest.fn().mockImplementation((params, callback) => {
        callback(null, { 
          SecretString: JSON.stringify({ 
            OPENAI_API_KEY: 'test-openai-key' 
          }) 
        });
      });
      AWS.SecretsManager.mockImplementation(() => ({
        getSecretValue: mockGetSecret
      }));

      // Execute workflow
      await nasaFetcher.handler(mockEvent, mockContext);

      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);
      await contentProcessor.handler(processorEvent, mockContext);

      // Verify image was cached
      expect(mockS3Head).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: `images/${mockNASAResponse.date}.jpg`
        }),
        expect.any(Function)
      );

      expect(mockS3Put).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: `images/${mockNASAResponse.date}.jpg`,
          Body: expect.any(Buffer)
        }),
        expect.any(Function)
      );

      // Verify CloudFront URL was stored
      const putCall = mockPut.mock.calls[0];
      const storedItem = putCall[0].Item;
      
      expect(storedItem.cachedImage).toHaveProperty('url');
      expect(storedItem.cachedImage.url).toContain('d2ydyf9w4v170.cloudfront.net');
      expect(storedItem.cachedImage.url).toContain(`images/${mockNASAResponse.date}.jpg`);

      restoreHTTPS();
      restoreOpenAI();
    });

    test('should skip caching if image already exists', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse();

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const AWS = require('aws-sdk');
      
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

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

      const mockGetSecret = jest.fn().mockImplementation((params, callback) => {
        callback(null, { 
          SecretString: JSON.stringify({ 
            OPENAI_API_KEY: 'test-openai-key' 
          }) 
        });
      });
      AWS.SecretsManager.mockImplementation(() => ({
        getSecretValue: mockGetSecret
      }));

      // Execute workflow
      await nasaFetcher.handler(mockEvent, mockContext);

      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);
      await contentProcessor.handler(processorEvent, mockContext);

      // Verify image was not uploaded again
      expect(mockS3Head).toHaveBeenCalled();
      expect(mockS3Put).not.toHaveBeenCalled();

      restoreHTTPS();
      restoreOpenAI();
    });
  });

  describe('Content Quality Validation', () => {
    test('should validate and score generated content', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      
      // Mock high-quality OpenAI response
      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse({
        choices: [{
          message: {
            content: 'Toto je veľmi kvalitný slovenský článok o astronómii s veľkým množstvom detailov a správnych diakritických znakov. Článok obsahuje komplexné informácie o vesmírnych objektoch a ich vlastnostiach. Je napísaný odborným, ale prístupným spôsobom pre širokú verejnosť.'
          }
        }]
      });

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const AWS = require('aws-sdk');
      
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

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

      const mockGetSecret = jest.fn().mockImplementation((params, callback) => {
        callback(null, { 
          SecretString: JSON.stringify({ 
            OPENAI_API_KEY: 'test-openai-key' 
          }) 
        });
      });
      AWS.SecretsManager.mockImplementation(() => ({
        getSecretValue: mockGetSecret
      }));

      // Execute workflow
      await nasaFetcher.handler(mockEvent, mockContext);

      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);
      await contentProcessor.handler(processorEvent, mockContext);

      // Verify content quality validation
      const putCall = mockPut.mock.calls[0];
      const storedItem = putCall[0].Item;
      
      expect(storedItem.contentQuality).toBeGreaterThan(80); // High quality content
      expect(storedItem.qualityIssues).toHaveLength(0);
      expect(storedItem.articleLengthChars).toBeGreaterThan(200);
      expect(storedItem.articleLengthWords).toBeGreaterThan(30);

      restoreHTTPS();
      restoreOpenAI();
    });

    test('should detect and flag quality issues', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      
      // Mock low-quality OpenAI response
      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse({
        choices: [{
          message: {
            content: 'Kratky clanok bez diakritiky. As an AI, I cannot provide specific details about this topic.'
          }
        }]
      });

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const AWS = require('aws-sdk');
      
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

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

      const mockGetSecret = jest.fn().mockImplementation((params, callback) => {
        callback(null, { 
          SecretString: JSON.stringify({ 
            OPENAI_API_KEY: 'test-openai-key' 
          }) 
        });
      });
      AWS.SecretsManager.mockImplementation(() => ({
        getSecretValue: mockGetSecret
      }));

      // Execute workflow
      await nasaFetcher.handler(mockEvent, mockContext);

      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);
      await contentProcessor.handler(processorEvent, mockContext);

      // Verify quality issues were detected
      const putCall = mockPut.mock.calls[0];
      const storedItem = putCall[0].Item;
      
      expect(storedItem.contentQuality).toBeLessThan(80); // Low quality content
      expect(storedItem.qualityIssues).toContain('Article too short');
      expect(storedItem.qualityIssues).toContain('Missing Slovak diacritics');
      expect(storedItem.qualityIssues).toContain('Contains AI disclaimer');

      restoreHTTPS();
      restoreOpenAI();
    });
  });
});
