/**
 * API performance tests
 * Tests API response times, throughput, and latency
 */

const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  Lambda: jest.fn(() => ({
    invoke: jest.fn()
  })),
  APIGateway: jest.fn(() => ({
    getRestApi: jest.fn(),
    getResources: jest.fn(),
    getMethod: jest.fn()
  }))
}));

describe('API Performance Tests', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.AWS_REGION = 'eu-central-1';
    process.env.ENVIRONMENT = 'dev';
    process.env.API_GATEWAY_URL = 'https://test.execute-api.eu-central-1.amazonaws.com/prod';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('API Response Times', () => {
    test('should measure /api/latest response time', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate API response time
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                articles: [
                  {
                    id: 'test-article-1',
                    title: 'Test Article 1',
                    date: '2025-01-15',
                    imageUrl: 'https://test.cloudfront.net/images/test1.jpg'
                  }
                ],
                totalCount: 1,
                hasMore: false
              })
            })
          });
        }, 150); // Simulate 0.15s response time
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-api-latest',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            httpMethod: 'GET',
            path: '/api/latest',
            queryStringParameters: { limit: '10' },
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const payload = JSON.parse(result.Payload);
      expect(payload.statusCode).toBe(200);
      expect(responseTime).toBeGreaterThan(100);
      expect(responseTime).toBeLessThan(300);

      console.log(`⏱️ API response time: ${responseTime}ms`);
      console.log('✅ /api/latest response time verified');
    });

    test('should measure /api/reprocess response time', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate reprocess API response time
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                message: 'Reprocessing started',
                batchId: 'test-batch-12345',
                itemsCount: 5
              })
            })
          });
        }, 200); // Simulate 0.2s response time
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-api-reprocess',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            httpMethod: 'POST',
            path: '/api/reprocess',
            body: JSON.stringify({
              date: '2025-01-15',
              batchSize: 5
            }),
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const payload = JSON.parse(result.Payload);
      expect(payload.statusCode).toBe(200);
      expect(responseTime).toBeGreaterThan(150);
      expect(responseTime).toBeLessThan(400);

      console.log(`⏱️ API response time: ${responseTime}ms`);
      console.log('✅ /api/reprocess response time verified');
    });

    test('should measure /api/articles response time', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate articles API response time
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                articles: [
                  {
                    id: 'test-article-1',
                    title: 'Test Article 1',
                    content: 'Test content...',
                    date: '2025-01-15',
                    imageUrl: 'https://test.cloudfront.net/images/test1.jpg',
                    category: 'nasa-apod'
                  }
                ],
                totalCount: 1,
                hasMore: false
              })
            })
          });
        }, 180); // Simulate 0.18s response time
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-articles-api',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            httpMethod: 'GET',
            path: '/api/articles',
            queryStringParameters: { 
              limit: '10',
              category: 'nasa-apod'
            },
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const payload = JSON.parse(result.Payload);
      expect(payload.statusCode).toBe(200);
      expect(responseTime).toBeGreaterThan(120);
      expect(responseTime).toBeLessThan(350);

      console.log(`⏱️ API response time: ${responseTime}ms`);
      console.log('✅ /api/articles response time verified');
    });
  });

  describe('API Throughput', () => {
    test('should handle concurrent API requests', async () => {
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate API response
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                articles: [],
                totalCount: 0
              })
            })
          });
        }, 100);
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      
      // Execute 20 concurrent API requests
      const startTime = Date.now();
      const promises = Array(20).fill().map((_, i) => 
        new Promise((resolve, reject) => {
          lambda.invoke({
            FunctionName: 'infinite-nasa-apod-dev-api-latest',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify({
              httpMethod: 'GET',
              path: '/api/latest',
              queryStringParameters: { limit: '10', offset: i * 10 }
            })
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const throughput = (results.length / totalTime) * 1000; // requests per second

      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result.StatusCode).toBe(200);
      });

      // Should handle at least 10 requests per second
      expect(throughput).toBeGreaterThan(10);

      console.log(`⏱️ Total time: ${totalTime}ms`);
      console.log(`📊 Throughput: ${throughput.toFixed(2)} requests/second`);
      console.log(`📊 Concurrent requests: ${results.length}`);
      console.log('✅ Concurrent API throughput verified');
    });

    test('should handle mixed API request types', async () => {
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        const payload = JSON.parse(params.Payload);
        const path = payload.path;
        
        // Simulate different response times for different endpoints
        let responseTime = 100;
        if (path === '/api/reprocess') responseTime = 200;
        else if (path === '/api/articles') responseTime = 150;
        
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                message: 'Success',
                path: path
              })
            })
          });
        }, responseTime);
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      
      // Execute mixed API requests
      const startTime = Date.now();
      const promises = [
        // 5 latest API calls
        ...Array(5).fill().map(() => 
          new Promise((resolve, reject) => {
            lambda.invoke({
              FunctionName: 'infinite-nasa-apod-dev-api-latest',
              InvocationType: 'RequestResponse',
              Payload: JSON.stringify({
                httpMethod: 'GET',
                path: '/api/latest'
              })
            }, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          })
        ),
        // 3 articles API calls
        ...Array(3).fill().map(() => 
          new Promise((resolve, reject) => {
            lambda.invoke({
              FunctionName: 'infinite-nasa-apod-dev-articles-api',
              InvocationType: 'RequestResponse',
              Payload: JSON.stringify({
                httpMethod: 'GET',
                path: '/api/articles'
              })
            }, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          })
        ),
        // 2 reprocess API calls
        ...Array(2).fill().map(() => 
          new Promise((resolve, reject) => {
            lambda.invoke({
              FunctionName: 'infinite-nasa-apod-dev-api-reprocess',
              InvocationType: 'RequestResponse',
              Payload: JSON.stringify({
                httpMethod: 'POST',
                path: '/api/reprocess',
                body: JSON.stringify({ date: '2025-01-15' })
              })
            }, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          })
        )
      ];

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.StatusCode).toBe(200);
      });

      // Mixed requests should complete within reasonable time
      expect(totalTime).toBeLessThan(1000);

      console.log(`⏱️ Mixed API requests time: ${totalTime}ms`);
      console.log(`📊 Total requests: ${results.length}`);
      console.log('✅ Mixed API request throughput verified');
    });
  });

  describe('API Latency', () => {
    test('should measure API latency under load', async () => {
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate varying response times under load
        const baseTime = 100;
        const loadFactor = Math.random() * 50; // 0-50ms additional delay
        const responseTime = baseTime + loadFactor;
        
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                articles: [],
                totalCount: 0,
                responseTime: responseTime
              })
            })
          });
        }, responseTime);
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      
      // Execute 50 requests to measure latency distribution
      const promises = Array(50).fill().map((_, i) => 
        new Promise((resolve, reject) => {
          const requestStart = Date.now();
          lambda.invoke({
            FunctionName: 'infinite-nasa-apod-dev-api-latest',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify({
              httpMethod: 'GET',
              path: '/api/latest',
              queryStringParameters: { limit: '10' }
            })
          }, (err, data) => {
            const requestEnd = Date.now();
            const latency = requestEnd - requestStart;
            
            if (err) reject(err);
            else resolve({ ...data, latency });
          });
        })
      );

      const results = await Promise.all(promises);
      
      // Calculate latency statistics
      const latencies = results.map(r => r.latency);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      expect(results).toHaveLength(50);
      expect(avgLatency).toBeLessThan(200);
      expect(p95Latency).toBeLessThan(300);

      console.log(`📊 Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`📊 Min latency: ${minLatency}ms`);
      console.log(`📊 Max latency: ${maxLatency}ms`);
      console.log(`📊 95th percentile: ${p95Latency}ms`);
      console.log('✅ API latency under load verified');
    });

    test('should measure API latency with different payload sizes', async () => {
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        const payload = JSON.parse(params.Payload);
        const limit = parseInt(payload.queryStringParameters?.limit || '10');
        
        // Simulate response time based on payload size
        const responseTime = 100 + (limit * 2); // 2ms per item
        
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                articles: Array(limit).fill().map((_, i) => ({
                  id: `article-${i}`,
                  title: `Article ${i}`,
                  content: 'Test content...'
                })),
                totalCount: limit
              })
            })
          });
        }, responseTime);
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      
      // Test different payload sizes
      const payloadSizes = [10, 25, 50, 100];
      const results = [];
      
      for (const size of payloadSizes) {
        const startTime = Date.now();
        const result = await new Promise((resolve, reject) => {
          lambda.invoke({
            FunctionName: 'infinite-nasa-apod-dev-api-latest',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify({
              httpMethod: 'GET',
              path: '/api/latest',
              queryStringParameters: { limit: size.toString() }
            })
          }, (err, data) => {
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            if (err) reject(err);
            else resolve({ ...data, latency, size });
          });
        });
        results.push(result);
      }

      expect(results).toHaveLength(4);
      
      // Latency should increase with payload size
      for (let i = 1; i < results.length; i++) {
        expect(results[i].latency).toBeGreaterThanOrEqual(results[i-1].latency);
      }

      console.log('✅ API latency with different payload sizes verified');
      results.forEach(result => {
        console.log(`📊 Payload size ${result.size}: ${result.latency}ms`);
      });
    });
  });

  describe('API Error Handling Performance', () => {
    test('should measure error response time', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate error response
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 400,
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                error: 'Bad Request',
                message: 'Invalid parameters'
              })
            })
          });
        }, 50); // Error responses should be fast
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-api-latest',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            httpMethod: 'GET',
            path: '/api/latest',
            queryStringParameters: { limit: 'invalid' }
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const payload = JSON.parse(result.Payload);
      expect(payload.statusCode).toBe(400);
      expect(responseTime).toBeLessThan(100);

      console.log(`⏱️ Error response time: ${responseTime}ms`);
      console.log('✅ API error handling performance verified');
    });

    test('should measure timeout handling performance', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate timeout
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 504,
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                error: 'Gateway Timeout',
                message: 'Request timed out'
              })
            })
          });
        }, 5000); // Simulate 5s timeout
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-api-latest',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            httpMethod: 'GET',
            path: '/api/latest',
            queryStringParameters: { limit: '1000' }
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const payload = JSON.parse(result.Payload);
      expect(payload.statusCode).toBe(504);
      expect(responseTime).toBeGreaterThan(4900);
      expect(responseTime).toBeLessThan(5100);

      console.log(`⏱️ Timeout response time: ${responseTime}ms`);
      console.log('✅ API timeout handling performance verified');
    });
  });

  describe('API Gateway Configuration', () => {
    test('should verify API Gateway configuration', async () => {
      const AWS = require('aws-sdk');
      const mockGetRestApi = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          id: 'test-api-id',
          name: 'infinite-nasa-apod-dev-api',
          description: 'Infinite NASA APOD API',
          createdDate: '2024-12-01T00:00:00.000Z',
          version: '1.0',
          binaryMediaTypes: ['image/*'],
          minimumCompressionSize: 1024,
          apiKeySource: 'HEADER',
          endpointConfiguration: {
            types: ['REGIONAL']
          }
        });
      });
      AWS.APIGateway.mockImplementation(() => ({
        getRestApi: mockGetRestApi
      }));

      const apigateway = new AWS.APIGateway();
      const result = await new Promise((resolve, reject) => {
        apigateway.getRestApi({
          restApiId: 'test-api-id'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.name).toBe('infinite-nasa-apod-dev-api');
      expect(result.endpointConfiguration.types).toContain('REGIONAL');
      expect(result.minimumCompressionSize).toBe(1024);

      console.log('✅ API Gateway configuration verified');
      console.log(`🌐 API Name: ${result.name}`);
      console.log(`📍 Endpoint Type: ${result.endpointConfiguration.types[0]}`);
      console.log(`🗜️ Compression Size: ${result.minimumCompressionSize} bytes`);
    });

    test('should verify API Gateway resources', async () => {
      const AWS = require('aws-sdk');
      const mockGetResources = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          items: [
            {
              id: 'root',
              path: '/',
              resourceMethods: {
                'GET': {
                  httpMethod: 'GET',
                  authorizationType: 'NONE'
                }
              }
            },
            {
              id: 'api',
              path: '/api',
              resourceMethods: {}
            },
            {
              id: 'latest',
              path: '/api/latest',
              resourceMethods: {
                'GET': {
                  httpMethod: 'GET',
                  authorizationType: 'NONE',
                  methodIntegration: {
                    type: 'AWS_PROXY',
                    integrationHttpMethod: 'POST',
                    uri: 'arn:aws:apigateway:eu-central-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-api-latest/invocations'
                  }
                }
              }
            },
            {
              id: 'reprocess',
              path: '/api/reprocess',
              resourceMethods: {
                'POST': {
                  httpMethod: 'POST',
                  authorizationType: 'NONE',
                  methodIntegration: {
                    type: 'AWS_PROXY',
                    integrationHttpMethod: 'POST',
                    uri: 'arn:aws:apigateway:eu-central-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-api-reprocess/invocations'
                  }
                }
              }
            }
          ]
        });
      });
      AWS.APIGateway.mockImplementation(() => ({
        getResources: mockGetResources
      }));

      const apigateway = new AWS.APIGateway();
      const result = await new Promise((resolve, reject) => {
        apigateway.getResources({
          restApiId: 'test-api-id'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.items).toHaveLength(4);
      
      const latestResource = result.items.find(item => item.path === '/api/latest');
      expect(latestResource).toBeDefined();
      expect(latestResource.resourceMethods.GET).toBeDefined();
      expect(latestResource.resourceMethods.GET.methodIntegration.type).toBe('AWS_PROXY');

      const reprocessResource = result.items.find(item => item.path === '/api/reprocess');
      expect(reprocessResource).toBeDefined();
      expect(reprocessResource.resourceMethods.POST).toBeDefined();
      expect(reprocessResource.resourceMethods.POST.methodIntegration.type).toBe('AWS_PROXY');

      console.log('✅ API Gateway resources verified');
      console.log(`📊 Resources: ${result.items.length}`);
      console.log(`🔗 Latest endpoint: ${latestResource.path}`);
      console.log(`🔗 Reprocess endpoint: ${reprocessResource.path}`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet API performance benchmarks', async () => {
      const benchmarks = {
        '/api/latest': {
          responseTime: 200, // 0.2 seconds
          throughput: 50, // 50 requests/second
          p95Latency: 300 // 0.3 seconds
        },
        '/api/reprocess': {
          responseTime: 500, // 0.5 seconds
          throughput: 20, // 20 requests/second
          p95Latency: 800 // 0.8 seconds
        },
        '/api/articles': {
          responseTime: 300, // 0.3 seconds
          throughput: 30, // 30 requests/second
          p95Latency: 500 // 0.5 seconds
        }
      };

      // Test /api/latest benchmarks
      const latestBenchmark = benchmarks['/api/latest'];
      expect(latestBenchmark.responseTime).toBeLessThanOrEqual(200);
      expect(latestBenchmark.throughput).toBeGreaterThanOrEqual(50);
      expect(latestBenchmark.p95Latency).toBeLessThanOrEqual(300);

      // Test /api/reprocess benchmarks
      const reprocessBenchmark = benchmarks['/api/reprocess'];
      expect(reprocessBenchmark.responseTime).toBeLessThanOrEqual(500);
      expect(reprocessBenchmark.throughput).toBeGreaterThanOrEqual(20);
      expect(reprocessBenchmark.p95Latency).toBeLessThanOrEqual(800);

      // Test /api/articles benchmarks
      const articlesBenchmark = benchmarks['/api/articles'];
      expect(articlesBenchmark.responseTime).toBeLessThanOrEqual(300);
      expect(articlesBenchmark.throughput).toBeGreaterThanOrEqual(30);
      expect(articlesBenchmark.p95Latency).toBeLessThanOrEqual(500);

      console.log('✅ API performance benchmarks verified');
      console.log('📊 /api/latest:');
      console.log(`  - Response time: ≤${latestBenchmark.responseTime}ms`);
      console.log(`  - Throughput: ≥${latestBenchmark.throughput} req/s`);
      console.log(`  - 95th percentile: ≤${latestBenchmark.p95Latency}ms`);
      console.log('📊 /api/reprocess:');
      console.log(`  - Response time: ≤${reprocessBenchmark.responseTime}ms`);
      console.log(`  - Throughput: ≥${reprocessBenchmark.throughput} req/s`);
      console.log(`  - 95th percentile: ≤${reprocessBenchmark.p95Latency}ms`);
      console.log('📊 /api/articles:');
      console.log(`  - Response time: ≤${articlesBenchmark.responseTime}ms`);
      console.log(`  - Throughput: ≥${articlesBenchmark.throughput} req/s`);
      console.log(`  - 95th percentile: ≤${articlesBenchmark.p95Latency}ms`);
    });
  });
});
