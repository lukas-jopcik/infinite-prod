/**
 * Test utilities and helpers for the Infinite project
 */

const AWS = require('aws-sdk-mock');

/**
 * Mock AWS services for testing
 */
class AWSMockHelper {
  static mockDynamoDB() {
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

    AWS.mock('DynamoDB', 'getItem', (params, callback) => {
      callback(null, {});
    });

    AWS.mock('DynamoDB', 'putItem', (params, callback) => {
      callback(null, {});
    });

    AWS.mock('DynamoDB', 'query', (params, callback) => {
      callback(null, { Items: [] });
    });
  }

  static mockS3() {
    AWS.mock('S3', 'putObject', (params, callback) => {
      callback(null, { ETag: '"test-etag"' });
    });

    AWS.mock('S3', 'getObject', (params, callback) => {
      callback(null, { Body: Buffer.from('test image data') });
    });

    AWS.mock('S3', 'headObject', (params, callback) => {
      callback(null, { ContentType: 'image/jpeg' });
    });

    AWS.mock('S3', 'listObjectsV2', (params, callback) => {
      callback(null, { Contents: [] });
    });
  }

  static mockLambda() {
    AWS.mock('Lambda', 'invoke', (params, callback) => {
      callback(null, { 
        StatusCode: 200,
        Payload: JSON.stringify({ statusCode: 200, body: '{}' })
      });
    });
  }

  static mockSecretsManager() {
    AWS.mock('SecretsManager', 'getSecretValue', (params, callback) => {
      callback(null, { 
        SecretString: JSON.stringify({ 
          OPENAI_API_KEY: 'test-openai-key',
          NASA_API_KEY: 'test-nasa-key'
        }) 
      });
    });
  }

  static mockAll() {
    this.mockDynamoDB();
    this.mockS3();
    this.mockLambda();
    this.mockSecretsManager();
  }

  static restore() {
    AWS.restore();
  }
}

/**
 * Test data generators
 */
class TestDataGenerator {
  static generateNASAAPODResponse(overrides = {}) {
    return {
      date: '2025-01-15',
      title: 'Test APOD Title',
      explanation: 'Test APOD explanation content that describes the astronomical phenomenon.',
      url: 'https://apod.nasa.gov/apod/image/test.jpg',
      hdurl: 'https://apod.nasa.gov/apod/image/test_hd.jpg',
      media_type: 'image',
      copyright: 'Test Photographer',
      ...overrides
    };
  }

  static generateOpenAIResponse(overrides = {}) {
    return {
      choices: [{
        message: {
          content: 'Test Slovak article content with proper diacritics and scientific accuracy. This is a comprehensive article about the astronomical phenomenon.'
        }
      }],
      ...overrides
    };
  }

  static generateDynamoDBItem(overrides = {}) {
    return {
      date: '2025-01-15',
      pk: 'LATEST',
      originalTitle: 'Test APOD Title',
      originalExplanation: 'Test APOD explanation content',
      imageUrl: 'https://apod.nasa.gov/apod/image/test.jpg',
      hdImageUrl: 'https://apod.nasa.gov/apod/image/test_hd.jpg',
      mediaType: 'image',
      copyright: 'Test Photographer',
      slovakTitle: 'Test Slovak Title',
      slovakArticle: 'Test Slovak article content with proper diacritics.',
      seoKeywords: ['test', 'slovak', 'keywords', 'astronómia'],
      contentQuality: 100,
      qualityIssues: [],
      articleLengthChars: 500,
      articleLengthWords: 100,
      cachedImage: {
        bucket: 'test-bucket',
        key: 'images/2025-01-15.jpg',
        url: 'https://test-cloudfront.net/images/2025-01-15.jpg',
        contentType: 'image/jpeg',
        originalUrl: 'https://apod.nasa.gov/apod/image/test.jpg'
      },
      aiHeadlines: {
        primary: 'Test Primary Headline',
        secondary: 'Test Secondary Headline',
        short: 'Test Short Headline'
      },
      generatedAt: '2025-01-15T06:00:00.000Z',
      lastUpdated: '2025-01-15T06:00:00.000Z',
      ...overrides
    };
  }

  static generateAPIGatewayEvent(overrides = {}) {
    return {
      httpMethod: 'GET',
      path: '/api/latest',
      queryStringParameters: { limit: '5' },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'test-agent'
      },
      body: null,
      isBase64Encoded: false,
      ...overrides
    };
  }

  static generateLambdaContext(overrides = {}) {
    return {
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
      succeed: () => {},
      ...overrides
    };
  }

  static generateArticle(overrides = {}) {
    return {
      articleId: 'test-article-id',
      type: 'discovery',
      title: 'Test Article Title',
      slug: 'test-article-slug',
      perex: 'Test article excerpt',
      category: 'objav-dna',
      publishedAt: '2025-01-15T06:00:00.000Z',
      originalDate: '2025-01-15',
      author: 'AI Assistant',
      readingTime: '5 min',
      imageUrl: 'https://test-cloudfront.net/images/test.jpg',
      metaTitle: 'Test Meta Title',
      metaDescription: 'Test meta description',
      tags: ['astronómia', 'vesmír'],
      source: 'nasa-apod',
      sourceUrl: 'https://apod.nasa.gov/apod/',
      content: [
        { title: 'Úvod', content: 'Test content section 1' },
        { title: 'Hlavná časť', content: 'Test content section 2' }
      ],
      faq: [
        { question: 'Test question?', answer: 'Test answer.' }
      ],
      ...overrides
    };
  }
}

/**
 * HTTP request helpers
 */
class HTTPTestHelper {
  static mockFetch(response, status = 200) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response))
    });
  }

  static mockFetchError(error) {
    global.fetch = jest.fn().mockRejectedValue(error);
  }

  static mockHTTPSRequest(response, status = 200) {
    const https = require('https');
    const originalRequest = https.request;
    
    https.request = jest.fn((options, callback) => {
      const mockResponse = {
        statusCode: status,
        headers: { 'content-type': 'application/json' },
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify(response));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      
      if (callback) {
        callback(mockResponse);
      }
      
      return {
        on: jest.fn(),
        end: jest.fn()
      };
    });
    
    return () => {
      https.request = originalRequest;
    };
  }
}

/**
 * Assertion helpers
 */
class AssertionHelper {
  static expectValidSlovakText(text) {
    expect(text).toMatch(/[áäčďéíĺľňóôŕšťúýž]/);
    expect(text).not.toMatch(/AI disclaimer|As an AI|I cannot/);
    expect(text.length).toBeGreaterThan(100);
  }

  static expectValidAPODData(data) {
    expect(data).toHaveProperty('date');
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('explanation');
    expect(data).toHaveProperty('url');
    expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }

  static expectValidDynamoDBItem(item) {
    expect(item).toHaveProperty('date');
    expect(item).toHaveProperty('pk', 'LATEST');
    expect(item).toHaveProperty('slovakTitle');
    expect(item).toHaveProperty('slovakArticle');
    expect(item).toHaveProperty('contentQuality');
    expect(item.contentQuality).toBeGreaterThanOrEqual(0);
    expect(item.contentQuality).toBeLessThanOrEqual(100);
  }

  static expectValidAPIResponse(response) {
    expect(response).toHaveProperty('statusCode');
    expect(response).toHaveProperty('headers');
    expect(response).toHaveProperty('body');
    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(600);
  }
}

module.exports = {
  AWSMockHelper,
  TestDataGenerator,
  HTTPTestHelper,
  AssertionHelper
};
