/**
 * End-to-end tests for daily fetch workflow
 * Tests the complete daily workflow from NASA fetch to frontend display
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

describe('Daily Fetch Workflow E2E', () => {
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
    test('should execute full daily workflow from NASA fetch to API response', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: '2025-01-15',
        title: 'Test Daily APOD',
        explanation: 'This is a test APOD for daily workflow testing.',
        url: 'https://apod.nasa.gov/apod/image/test.jpg',
        hdurl: 'https://apod.nasa.gov/apod/image/test_hd.jpg',
        media_type: 'image',
        copyright: 'Test Photographer'
      });

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse({
        choices: [{
          message: {
            content: 'Toto je kvalitný slovenský článok o astronómii s veľkým množstvom detailov a správnych diakritických znakov. Článok obsahuje komplexné informácie o vesmírnych objektoch a ich vlastnostiach. Je napísaný odborným, ale prístupným spôsobom pre širokú verejnosť.'
          }
        }]
      });

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
        // Return the processed content when queried
        const processedItem = TestDataGenerator.generateDynamoDBItem({
          date: '2025-01-15',
          originalTitle: 'Test Daily APOD',
          originalExplanation: 'This is a test APOD for daily workflow testing.',
          slovakTitle: 'Test Slovak Title',
          slovakArticle: 'Toto je kvalitný slovenský článok o astronómii...',
          contentQuality: 95,
          cachedImage: {
            bucket: 'infinite-nasa-apod-dev-images-349660737637',
            key: 'images/2025-01-15.jpg',
            url: 'https://d2ydyf9w4v170.cloudfront.net/images/2025-01-15.jpg'
          }
        });
        callback(null, { Items: [processedItem] });
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

      // Step 1: NASA Fetcher - Fetch daily APOD
      console.log('Step 1: Fetching NASA APOD data...');
      const fetcherResult = await nasaFetcher.handler(mockEvent, mockContext);
      expect(fetcherResult.statusCode).toBe(200);
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          FunctionName: 'infinite-nasa-apod-dev-content-processor',
          InvocationType: 'Event'
        }),
        expect.any(Function)
      );

      // Step 2: Content Processor - Process NASA data with OpenAI
      console.log('Step 2: Processing content with OpenAI...');
      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);
      const processorResult = await contentProcessor.handler(processorEvent, mockContext);
      expect(processorResult.statusCode).toBe(200);
      
      // Verify content was processed and stored
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          Item: expect.objectContaining({
            date: '2025-01-15',
            pk: 'LATEST',
            originalTitle: 'Test Daily APOD',
            originalExplanation: 'This is a test APOD for daily workflow testing.',
            slovakTitle: expect.any(String),
            slovakArticle: expect.any(String),
            contentQuality: expect.any(Number)
          })
        }),
        expect.any(Function)
      );

      // Step 3: API Latest - Retrieve processed content
      console.log('Step 3: Retrieving processed content via API...');
      const apiEvent = TestDataGenerator.generateAPIGatewayEvent({
        queryStringParameters: { limit: '1' }
      });

      const apiResult = await apiLatest.handler(apiEvent, mockContext);
      expect(apiResult.statusCode).toBe(200);
      
      const apiBody = JSON.parse(apiResult.body);
      expect(apiBody.items).toHaveLength(1);
      expect(apiBody.items[0].date).toBe('2025-01-15');
      expect(apiBody.items[0].originalTitle).toBe('Test Daily APOD');
      expect(apiBody.items[0].slovakTitle).toBe('Test Slovak Title');
      expect(apiBody.items[0].contentQuality).toBe(95);

      // Step 4: Verify image caching
      console.log('Step 4: Verifying image caching...');
      expect(mockS3Head).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg'
        }),
        expect.any(Function)
      );
      expect(mockS3Put).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'infinite-nasa-apod-dev-images-349660737637',
          Key: 'images/2025-01-15.jpg',
          Body: expect.any(Buffer)
        }),
        expect.any(Function)
      );

      // Step 5: Verify CloudFront URL generation
      console.log('Step 5: Verifying CloudFront URL generation...');
      const putCall = mockPut.mock.calls[0];
      const storedItem = putCall[0].Item;
      expect(storedItem.cachedImage.url).toContain('d2ydyf9w4v170.cloudfront.net');
      expect(storedItem.cachedImage.url).toContain('images/2025-01-15.jpg');

      console.log('✅ Daily workflow completed successfully!');
      console.log(`📊 Content Quality: ${storedItem.contentQuality}%`);
      console.log(`🖼️ Image URL: ${storedItem.cachedImage.url}`);
      console.log(`📝 Slovak Title: ${storedItem.slovakTitle}`);

      restoreHTTPS();
      restoreOpenAI();
    });

    test('should handle workflow errors gracefully', async () => {
      // Mock NASA API error
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      console.log('✅ Error handling verified - NASA API error handled gracefully');

      restoreHTTPS();
    });

    test('should validate data consistency across all steps', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: '2025-01-15',
        title: 'Consistency Test APOD',
        explanation: 'Testing data consistency across workflow steps.'
      });

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
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        const processedItem = TestDataGenerator.generateDynamoDBItem({
          date: '2025-01-15',
          originalTitle: 'Consistency Test APOD'
        });
        callback(null, { Items: [processedItem] });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut,
        query: mockQuery
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

      const apiEvent = TestDataGenerator.generateAPIGatewayEvent({
        queryStringParameters: { limit: '1' }
      });

      const apiResult = await apiLatest.handler(apiEvent, mockContext);

      // Verify data consistency
      expect(apiResult.statusCode).toBe(200);
      
      const apiBody = JSON.parse(apiResult.body);
      expect(apiBody.items[0].date).toBe('2025-01-15');
      expect(apiBody.items[0].originalTitle).toBe('Consistency Test APOD');

      // Verify the payload passed between functions maintains consistency
      const invokeCall = mockInvoke.mock.calls[0];
      const payload = JSON.parse(invokeCall[0].Payload);
      expect(payload.date).toBe(mockNASAResponse.date);
      expect(payload.nasaData.title).toBe(mockNASAResponse.title);

      console.log('✅ Data consistency verified across all workflow steps');

      restoreHTTPS();
      restoreOpenAI();
    });
  });

  describe('Performance and Reliability', () => {
    test('should complete workflow within acceptable time limits', async () => {
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
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        const processedItem = TestDataGenerator.generateDynamoDBItem();
        callback(null, { Items: [processedItem] });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut,
        query: mockQuery
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

      const startTime = Date.now();

      // Execute workflow
      await nasaFetcher.handler(mockEvent, mockContext);

      const processorEvent = {
        date: mockNASAResponse.date,
        nasaData: mockNASAResponse
      };

      const restoreOpenAI = HTTPTestHelper.mockHTTPSRequest(mockOpenAIResponse);
      await contentProcessor.handler(processorEvent, mockContext);

      const apiEvent = TestDataGenerator.generateAPIGatewayEvent({
        queryStringParameters: { limit: '1' }
      });

      const apiResult = await apiLatest.handler(apiEvent, mockContext);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(apiResult.statusCode).toBe(200);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`⏱️ Workflow completed in ${totalTime}ms`);

      restoreHTTPS();
      restoreOpenAI();
    });

    test('should handle concurrent requests gracefully', async () => {
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
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        const processedItem = TestDataGenerator.generateDynamoDBItem();
        callback(null, { Items: [processedItem] });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut,
        query: mockQuery
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

      // Execute multiple concurrent API requests
      const apiEvent = TestDataGenerator.generateAPIGatewayEvent({
        queryStringParameters: { limit: '1' }
      });

      const promises = Array(5).fill().map(() => apiLatest.handler(apiEvent, mockContext));
      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(result => {
        expect(result.statusCode).toBe(200);
      });

      console.log('✅ Concurrent requests handled gracefully');

      restoreHTTPS();
    });
  });

  describe('Data Quality and Validation', () => {
    test('should maintain data quality throughout workflow', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: '2025-01-15',
        title: 'Quality Test APOD',
        explanation: 'Testing data quality maintenance throughout the workflow.'
      });

      const mockOpenAIResponse = TestDataGenerator.generateOpenAIResponse({
        choices: [{
          message: {
            content: 'Toto je veľmi kvalitný slovenský článok s komplexnými informáciami o astronómii a vesmírnych objektoch. Obsahuje odborné termíny a je napísaný prístupným spôsobom pre širokú verejnosť.'
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
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        const processedItem = TestDataGenerator.generateDynamoDBItem({
          date: '2025-01-15',
          contentQuality: 95,
          qualityIssues: []
        });
        callback(null, { Items: [processedItem] });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut,
        query: mockQuery
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

      const apiEvent = TestDataGenerator.generateAPIGatewayEvent({
        queryStringParameters: { limit: '1' }
      });

      const apiResult = await apiLatest.handler(apiEvent, mockContext);

      // Verify data quality
      expect(apiResult.statusCode).toBe(200);
      
      const apiBody = JSON.parse(apiResult.body);
      expect(apiBody.items[0].contentQuality).toBeGreaterThan(80);
      expect(apiBody.items[0].qualityIssues).toHaveLength(0);

      console.log('✅ Data quality maintained throughout workflow');

      restoreHTTPS();
      restoreOpenAI();
    });
  });
});
