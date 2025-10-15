/**
 * Unit tests for API Reprocess Lambda function
 */

const { AWSMockHelper, TestDataGenerator, HTTPTestHelper, AssertionHelper } = require('../../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      get: jest.fn(),
      put: jest.fn()
    }))
  },
  Lambda: jest.fn(() => ({
    invoke: jest.fn()
  }))
}));

const apiReprocess = require('../../../aws/lambda/api-reprocess/index');

describe('API Reprocess Lambda', () => {
  let mockContext;
  let mockEvent;

  beforeEach(() => {
    AWSMockHelper.mockAll();
    mockContext = TestDataGenerator.generateLambdaContext();
    
    // Set environment variables
    process.env.TABLE_NAME = 'test-table';
    process.env.PROCESSOR_FUNCTION = 'test-processor-function';
    process.env.NASA_API_KEY = 'test-nasa-key';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('POST /api/reprocess', () => {
    test('should reprocess existing content for specific date', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const mockExistingItem = TestDataGenerator.generateDynamoDBItem({
        date: specificDate
      });

      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: specificDate
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Item: mockExistingItem });
      });
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet,
        put: mockPut
      }));

      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('processing');
      expect(result.body).toContain(specificDate);

      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-table',
          Key: { date: specificDate }
        }),
        expect.any(Function)
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          FunctionName: 'test-processor-function',
          InvocationType: 'Event',
          Payload: expect.stringContaining(specificDate)
        }),
        expect.any(Function)
      );

      restoreHTTPS();
    });

    test('should return 404 when date not found', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, {}); // No Item property
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(result.body).toContain('not found');
    });

    test('should validate date format', async () => {
      const invalidDate = 'invalid-date';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: invalidDate })
      });

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Invalid date format');
    });

    test('should handle missing date in request body', async () => {
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({})
      });

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Date is required');
    });

    test('should handle invalid JSON in request body', async () => {
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: 'invalid json'
      });

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('Invalid JSON');
    });
  });

  describe('NASA API integration', () => {
    test('should fetch fresh NASA data for reprocessing', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const mockExistingItem = TestDataGenerator.generateDynamoDBItem({
        date: specificDate
      });

      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: specificDate,
        title: 'Updated NASA Title',
        explanation: 'Updated NASA explanation'
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Item: mockExistingItem });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(202);
      
      // Verify the payload contains fresh NASA data
      const invokeCall = mockInvoke.mock.calls[0];
      const payload = JSON.parse(invokeCall[0].Payload);
      
      expect(payload.nasaData.title).toBe('Updated NASA Title');
      expect(payload.nasaData.explanation).toBe('Updated NASA explanation');

      restoreHTTPS();
    });

    test('should handle NASA API errors', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const mockExistingItem = TestDataGenerator.generateDynamoDBItem({
        date: specificDate
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Item: mockExistingItem });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });
  });

  describe('Lambda invocation', () => {
    test('should invoke content processor with correct payload', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const mockExistingItem = TestDataGenerator.generateDynamoDBItem({
        date: specificDate
      });

      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: specificDate
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Item: mockExistingItem });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(202);
      
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          FunctionName: 'test-processor-function',
          InvocationType: 'Event',
          Payload: expect.stringMatching(new RegExp(specificDate))
        }),
        expect.any(Function)
      );

      restoreHTTPS();
    });

    test('should handle Lambda invoke errors', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const mockExistingItem = TestDataGenerator.generateDynamoDBItem({
        date: specificDate
      });

      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: specificDate
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Item: mockExistingItem });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('Lambda invoke failed'), null);
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });
  });

  describe('Error handling', () => {
    test('should handle DynamoDB errors', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('DynamoDB error'), null);
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');
    });

    test('should handle missing environment variables', async () => {
      delete process.env.TABLE_NAME;

      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: '2025-01-15' })
      });

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });

    test('should handle missing NASA API key', async () => {
      delete process.env.NASA_API_KEY;

      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: '2025-01-15' })
      });

      const result = await apiReprocess.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Response format', () => {
    test('should return properly formatted success response', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = TestDataGenerator.generateAPIGatewayEvent({
        httpMethod: 'POST',
        path: '/api/reprocess',
        body: JSON.stringify({ date: specificDate })
      });

      const mockExistingItem = TestDataGenerator.generateDynamoDBItem({
        date: specificDate
      });

      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: specificDate
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Item: mockExistingItem });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await apiReprocess.handler(mockEvent, mockContext);

      AssertionHelper.expectValidAPIResponse(result);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('date');
      expect(body.status).toBe('processing');
      expect(body.date).toBe(specificDate);

      restoreHTTPS();
    });
  });
});
