/**
 * Global test setup for Jest
 * This file runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'eu-central-1';
process.env.ENVIRONMENT = 'test';

// NASA API configuration
process.env.NASA_API_KEY = 'test-nasa-api-key-12345';
process.env.NASA_APOD_URL = 'https://api.nasa.gov/planetary/apod';
process.env.RSS_FEED_URL = 'https://apod.nasa.gov/apod.rss';

// Lambda function names
process.env.PROCESSOR_FUNCTION = 'test-processor-function';
process.env.API_LATEST_FUNCTION = 'test-api-latest-function';

// DynamoDB configuration
process.env.DYNAMODB_TABLE_NAME = 'InfiniteRawContent-test';
process.env.DYNAMODB_RAW_CONTENT_TABLE = 'InfiniteRawContent-test';
process.env.DYNAMODB_ARTICLES_TABLE = 'InfiniteArticles-test';
process.env.TABLE_NAME = 'InfiniteRawContent-test';

// S3 and CloudFront configuration
process.env.S3_BUCKET_NAME = 'infinite-images-test';
process.env.CLOUDFRONT_DOMAIN = 'test.cloudfront.net';
process.env.CLOUDFRONT_DISTRIBUTION_ID = 'E1234TEST';

// OpenAI configuration
process.env.OPENAI_API_KEY = 'test-openai-key-12345';
process.env.OPENAI_API_KEY_SECRET_ARN = 'arn:aws:secretsmanager:eu-central-1:123456789012:secret:test-openai';

// Secrets Manager configuration
process.env.NASA_SECRET_ARN = 'arn:aws:secretsmanager:eu-central-1:123456789012:secret:test-nasa';

// API Gateway configuration
process.env.API_GATEWAY_URL = 'https://test-api.execute-api.eu-central-1.amazonaws.com/test';

// Mock AWS SDK by default for unit tests
const AWS = require('aws-sdk-mock');

// Global AWS mocks
AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
  callback(null, {});
});

AWS.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
  callback(null, {});
});

AWS.mock('DynamoDB.DocumentClient', 'query', (params, callback) => {
  callback(null, { Items: [] });
});

AWS.mock('DynamoDB.DocumentClient', 'scan', (params, callback) => {
  callback(null, { Items: [] });
});

AWS.mock('S3', 'putObject', (params, callback) => {
  callback(null, { ETag: '"test-etag"' });
});

AWS.mock('S3', 'getObject', (params, callback) => {
  callback(null, { Body: Buffer.from('test image data') });
});

AWS.mock('S3', 'headObject', (params, callback) => {
  callback(null, { ContentType: 'image/jpeg' });
});

AWS.mock('Lambda', 'invoke', (params, callback) => {
  callback(null, { StatusCode: 200 });
});

AWS.mock('SecretsManager', 'getSecretValue', (params, callback) => {
  callback(null, { 
    SecretString: JSON.stringify({ 
      OPENAI_API_KEY: 'test-openai-key' 
    }) 
  });
});

// Global test utilities
global.testUtils = {
  // Mock NASA APOD response
  mockNASAAPODResponse: {
    date: '2025-01-15',
    title: 'Test APOD Title',
    explanation: 'Test APOD explanation content',
    url: 'https://apod.nasa.gov/apod/image/test.jpg',
    hdurl: 'https://apod.nasa.gov/apod/image/test_hd.jpg',
    media_type: 'image',
    copyright: 'Test Photographer'
  },

  // Mock OpenAI response
  mockOpenAIResponse: {
    choices: [{
      message: {
        content: 'Test Slovak article content with proper diacritics and scientific accuracy.'
      }
    }]
  },

  // Mock DynamoDB item
  mockDynamoDBItem: {
    date: '2025-01-15',
    pk: 'LATEST',
    originalTitle: 'Test APOD Title',
    originalExplanation: 'Test APOD explanation content',
    slovakTitle: 'Test Slovak Title',
    slovakArticle: 'Test Slovak article content',
    seoKeywords: ['test', 'slovak', 'keywords'],
    contentQuality: 100,
    cachedImage: {
      bucket: 'test-bucket',
      key: 'images/2025-01-15.jpg',
      url: 'https://test-cloudfront.net/images/2025-01-15.jpg'
    }
  },

  // Mock API Gateway event
  mockAPIGatewayEvent: {
    httpMethod: 'GET',
    path: '/api/latest',
    queryStringParameters: { limit: '5' },
    headers: {},
    body: null
  },

  // Mock Lambda context
  mockLambdaContext: {
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:eu-central-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2025/01/15/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  }
};

// Console override for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  AWS.restore();
});

// Global timeout for all tests
jest.setTimeout(30000);
