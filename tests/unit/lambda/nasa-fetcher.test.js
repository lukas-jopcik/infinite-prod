/**
 * Unit tests for NASA Fetcher Lambda function
 */

const { AWSMockHelper, TestDataGenerator, HTTPTestHelper, AssertionHelper } = require('../../helpers/test-utils');

// Mock the Lambda function before importing
jest.mock('aws-sdk', () => ({
  Lambda: jest.fn(() => ({
    invoke: jest.fn()
  }))
}));

const nasaFetcher = require('../../../aws/lambda/nasa-fetcher/index');

describe('NASA Fetcher Lambda', () => {
  let mockContext;
  let mockEvent;

  beforeEach(() => {
    AWSMockHelper.mockAll();
    mockContext = TestDataGenerator.generateLambdaContext();
    mockEvent = { mode: 'daily' };
    
    // Set environment variables
    process.env.NASA_API_KEY = 'test-nasa-key';
    process.env.PROCESSOR_FUNCTION = 'test-processor-function';
    process.env.NASA_APOD_URL = 'https://api.nasa.gov/planetary/apod';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('Daily mode', () => {
    test('should fetch APOD data from NASA API and invoke processor', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const mockLambdaInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });

      // Mock AWS Lambda invoke
      const AWS = require('aws-sdk');
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockLambdaInvoke
      }));

      // Mock HTTP request to NASA API
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          FunctionName: 'test-processor-function',
          InvocationType: 'Event',
          Payload: expect.stringContaining(mockNASAResponse.date)
        }),
        expect.any(Function)
      );

      restoreHTTPS();
    });

    test('should handle NASA API errors gracefully', async () => {
      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest({}, 500);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });

    test('should validate required environment variables', async () => {
      delete process.env.NASA_API_KEY;

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Missing NASA_API_KEY');
    });
  });

  describe('By date mode', () => {
    test('should fetch APOD data for specific date', async () => {
      const specificDate = '2025-01-15';
      const mockEvent = { mode: 'byDate', date: specificDate };
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse({
        date: specificDate
      });

      const mockLambdaInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });

      const AWS = require('aws-sdk');
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockLambdaInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockLambdaInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining(specificDate)
        }),
        expect.any(Function)
      );

      restoreHTTPS();
    });
  });

  describe('RSS mode', () => {
    test('should fetch and process RSS feed', async () => {
      const mockEvent = { mode: 'rss', limit: 5 };
      const mockRSSResponse = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Test APOD</title>
              <description>Test description</description>
              <pubDate>Wed, 15 Jan 2025 12:00:00 GMT</pubDate>
              <link>https://apod.nasa.gov/apod/test.html</link>
            </item>
          </channel>
        </rss>`;

      const mockLambdaInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });

      const AWS = require('aws-sdk');
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockLambdaInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockRSSResponse);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockLambdaInvoke).toHaveBeenCalled();

      restoreHTTPS();
    });
  });

  describe('Error handling', () => {
    test('should handle missing processor function', async () => {
      delete process.env.PROCESSOR_FUNCTION;

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Missing PROCESSOR_FUNCTION');
    });

    test('should handle Lambda invoke errors', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const mockLambdaInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('Lambda invoke failed'), null);
      });

      const AWS = require('aws-sdk');
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockLambdaInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('error');

      restoreHTTPS();
    });
  });

  describe('Data validation', () => {
    test('should validate NASA APOD response structure', async () => {
      const mockNASAResponse = TestDataGenerator.generateNASAAPODResponse();
      const mockLambdaInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, { StatusCode: 200 });
      });

      const AWS = require('aws-sdk');
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockLambdaInvoke
      }));

      const restoreHTTPS = HTTPTestHelper.mockHTTPSRequest(mockNASAResponse);

      const result = await nasaFetcher.handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      
      // Verify the payload contains valid APOD data
      const invokeCall = mockLambdaInvoke.mock.calls[0];
      const payload = JSON.parse(invokeCall[0].Payload);
      
      AssertionHelper.expectValidAPODData(payload.nasaData);

      restoreHTTPS();
    });
  });
});
