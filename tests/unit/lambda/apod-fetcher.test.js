/**
 * Unit tests for APOD Fetcher Lambda function (backend version)
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
      scan: jest.fn()
    }))
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  ScanCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: jest.fn()
  })),
  GetSecretValueCommand: jest.fn()
}));

const apodFetcher = require('../../../backend/functions/scheduled/apod-fetcher');

describe('APOD Fetcher Lambda (Backend)', () => {
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
    process.env.NASA_SECRET_ARN = 'arn:aws:secretsmanager:eu-central-1:123456789012:secret:infinite/nasa-api-key';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('NASA API integration', () => {
    test('should fetch APOD data from NASA API', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      // Mock Secrets Manager
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      // Mock DynamoDB
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        scan: mockScan
      });

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'InfiniteRawContent-test',
          Item: expect.objectContaining({
            contentId: expect.any(String),
            source: 'nasa-apod',
            date: mockNASAResponse.date,
            title: mockNASAResponse.title,
            status: 'raw'
          })
        })
      );

      restoreHTTPS();
    });

    test('should handle NASA API errors', async () => {
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });

    test('should handle missing NASA API key', async () => {
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockRejectedValue(new Error('Secret not found'));
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');
    });
  });

  describe('Data processing', () => {
    test('should process APOD data correctly', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        scan: mockScan
      });

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      expect(item.source).toBe('nasa-apod');
      expect(item.category).toBe('objav-dna');
      expect(item.status).toBe('raw');
      expect(item.title).toBe(mockNASAResponse.title);
      expect(item.description).toBe(mockNASAResponse.explanation);
      expect(item.imageUrl).toBe(mockNASAResponse.url);
      expect(item.originalDate).toBe(mockNASAResponse.date);

      restoreHTTPS();
    });

    test('should validate processed data structure', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        scan: mockScan
      });

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      const putCall = mockPut.mock.calls[0];
      const item = putCall[0].Item;
      
      // Validate required fields
      expect(item).toHaveProperty('contentId');
      expect(item).toHaveProperty('source');
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('updatedAt');
      
      // Validate data types
      expect(typeof item.contentId).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.date).toBe('string');
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      restoreHTTPS();
    });
  });

  describe('Duplicate detection', () => {
    test('should skip processing if duplicate exists', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockScan = jest.fn().mockResolvedValue({ 
        Items: [{ contentId: 'existing-item' }] // Simulate existing item
      });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        scan: mockScan
      });

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('already exists');
      expect(mockPut).not.toHaveBeenCalled(); // Should not create duplicate

      restoreHTTPS();
    });

    test('should process new items when no duplicates found', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockScan = jest.fn().mockResolvedValue({ Items: [] }); // No existing items
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        scan: mockScan
      });

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockPut).toHaveBeenCalled(); // Should create new item

      restoreHTTPS();
    });
  });

  describe('Error handling', () => {
    test('should handle DynamoDB errors', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockRejectedValue(new Error('DynamoDB error'));
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        scan: mockScan
      });

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });

    test('should handle missing environment variables', async () => {
      delete process.env.DYNAMODB_RAW_CONTENT_TABLE;

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });

    test('should handle invalid NASA response data', async () => {
      const invalidResponse = { invalid: 'data' };
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(invalidResponse);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const result = await apodFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });
  });

  describe('Response format', () => {
    test('should return properly formatted success response', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ NASA_API_KEY: 'test-nasa-key' })
      });
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));

      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      const mockPut = jest.fn().mockResolvedValue({});
      const mockScan = jest.fn().mockResolvedValue({ Items: [] });
      DynamoDBDocumentClient.from.mockReturnValue({
        put: mockPut,
        scan: mockScan
      });

      const result = await apodFetcher.handler(mockEvent, mockContext);

      AssertionHelper.expectValidAPIResponse(result);
      expect(result.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('date');
      expect(body).toHaveProperty('processedCount');

      restoreHTTPS();
    });
  });
});
