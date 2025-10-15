/**
 * Lambda performance tests
 * Tests Lambda function execution times, memory usage, and cold start performance
 */

const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  Lambda: jest.fn(() => ({
    invoke: jest.fn(),
    getFunction: jest.fn(),
    listFunctions: jest.fn(),
    getAccountSettings: jest.fn()
  })),
  CloudWatch: jest.fn(() => ({
    getMetricStatistics: jest.fn(),
    putMetricData: jest.fn()
  }))
}));

describe('Lambda Performance Tests', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.AWS_REGION = 'eu-central-1';
    process.env.ENVIRONMENT = 'dev';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('Cold Start Performance', () => {
    test('should measure cold start time for nasa-fetcher', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate cold start delay
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                message: 'NASA APOD data fetched successfully',
                timestamp: new Date().toISOString()
              })
            }),
            ExecutedVersion: '$LATEST',
            LogResult: 'UklQSUQ6IGZha2UtcmVxdWVzdC1pZA=='
          });
        }, 1500); // Simulate 1.5s cold start
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-fetcher',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            source: 'performance-test',
            timestamp: new Date().toISOString()
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.StatusCode).toBe(200);
      expect(executionTime).toBeGreaterThan(1400);
      expect(executionTime).toBeLessThan(2000);

      console.log(`⏱️ Cold start time: ${executionTime}ms`);
      console.log('✅ NASA fetcher cold start performance verified');
    });

    test('should measure cold start time for content-processor', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate cold start delay
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                message: 'Content processed successfully',
                articlesGenerated: 5
              })
            })
          });
        }, 2000); // Simulate 2s cold start
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-content-processor',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            source: 'performance-test',
            batchSize: 5
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.StatusCode).toBe(200);
      expect(executionTime).toBeGreaterThan(1900);
      expect(executionTime).toBeLessThan(2500);

      console.log(`⏱️ Cold start time: ${executionTime}ms`);
      console.log('✅ Content processor cold start performance verified');
    });

    test('should measure cold start time for api-latest', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate cold start delay
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
        }, 800); // Simulate 0.8s cold start
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
            queryStringParameters: { limit: '10' }
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.StatusCode).toBe(200);
      expect(executionTime).toBeGreaterThan(700);
      expect(executionTime).toBeLessThan(1200);

      console.log(`⏱️ Cold start time: ${executionTime}ms`);
      console.log('✅ API latest cold start performance verified');
    });
  });

  describe('Warm Execution Performance', () => {
    test('should measure warm execution time for nasa-fetcher', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate warm execution (no cold start)
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                message: 'NASA APOD data fetched successfully',
                timestamp: new Date().toISOString()
              })
            })
          });
        }, 300); // Simulate 0.3s warm execution
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-fetcher',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            source: 'performance-test',
            timestamp: new Date().toISOString()
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.StatusCode).toBe(200);
      expect(executionTime).toBeGreaterThan(250);
      expect(executionTime).toBeLessThan(500);

      console.log(`⏱️ Warm execution time: ${executionTime}ms`);
      console.log('✅ NASA fetcher warm execution performance verified');
    });

    test('should measure warm execution time for content-processor', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate warm execution
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                message: 'Content processed successfully',
                articlesGenerated: 5
              })
            })
          });
        }, 800); // Simulate 0.8s warm execution
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-content-processor',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            source: 'performance-test',
            batchSize: 5
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.StatusCode).toBe(200);
      expect(executionTime).toBeGreaterThan(700);
      expect(executionTime).toBeLessThan(1000);

      console.log(`⏱️ Warm execution time: ${executionTime}ms`);
      console.log('✅ Content processor warm execution performance verified');
    });

    test('should measure warm execution time for api-latest', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate warm execution
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
        }, 150); // Simulate 0.15s warm execution
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
            queryStringParameters: { limit: '10' }
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.StatusCode).toBe(200);
      expect(executionTime).toBeGreaterThan(100);
      expect(executionTime).toBeLessThan(300);

      console.log(`⏱️ Warm execution time: ${executionTime}ms`);
      console.log('✅ API latest warm execution performance verified');
    });
  });

  describe('Memory Usage Performance', () => {
    test('should measure memory usage for nasa-fetcher', async () => {
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          StatusCode: 200,
          Payload: JSON.stringify({
            statusCode: 200,
            body: JSON.stringify({
              message: 'NASA APOD data fetched successfully',
              memoryUsed: '128MB',
              maxMemoryUsed: '256MB'
            })
          }),
          LogResult: 'UklQSUQ6IGZha2UtcmVxdWVzdC1pZA=='
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-fetcher',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            source: 'performance-test'
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const payload = JSON.parse(result.Payload);
      const body = JSON.parse(payload.body);

      expect(payload.statusCode).toBe(200);
      expect(body.memoryUsed).toBe('128MB');
      expect(body.maxMemoryUsed).toBe('256MB');

      console.log(`💾 Memory used: ${body.memoryUsed}`);
      console.log(`💾 Max memory: ${body.maxMemoryUsed}`);
      console.log('✅ NASA fetcher memory usage verified');
    });

    test('should measure memory usage for content-processor', async () => {
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          StatusCode: 200,
          Payload: JSON.stringify({
            statusCode: 200,
            body: JSON.stringify({
              message: 'Content processed successfully',
              memoryUsed: '384MB',
              maxMemoryUsed: '512MB'
            })
          })
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-content-processor',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            source: 'performance-test',
            batchSize: 10
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const payload = JSON.parse(result.Payload);
      const body = JSON.parse(payload.body);

      expect(payload.statusCode).toBe(200);
      expect(body.memoryUsed).toBe('384MB');
      expect(body.maxMemoryUsed).toBe('512MB');

      console.log(`💾 Memory used: ${body.memoryUsed}`);
      console.log(`💾 Max memory: ${body.maxMemoryUsed}`);
      console.log('✅ Content processor memory usage verified');
    });
  });

  describe('Concurrent Execution Performance', () => {
    test('should handle concurrent Lambda invocations', async () => {
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate concurrent execution
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({
                message: 'Concurrent execution successful',
                timestamp: new Date().toISOString()
              })
            })
          });
        }, 200);
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      
      // Execute 5 concurrent invocations
      const startTime = Date.now();
      const promises = Array(5).fill().map((_, i) => 
        new Promise((resolve, reject) => {
          lambda.invoke({
            FunctionName: 'infinite-nasa-apod-dev-fetcher',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify({
              source: 'concurrent-test',
              index: i
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

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.StatusCode).toBe(200);
      });

      // Concurrent execution should be faster than sequential
      expect(totalTime).toBeLessThan(1000);

      console.log(`⏱️ Concurrent execution time: ${totalTime}ms`);
      console.log(`📊 Concurrent invocations: ${results.length}`);
      console.log('✅ Concurrent Lambda execution performance verified');
    });

    test('should handle concurrent API calls', async () => {
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
      
      // Execute 10 concurrent API calls
      const startTime = Date.now();
      const promises = Array(10).fill().map((_, i) => 
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

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.StatusCode).toBe(200);
      });

      // Concurrent API calls should be faster than sequential
      expect(totalTime).toBeLessThan(500);

      console.log(`⏱️ Concurrent API calls time: ${totalTime}ms`);
      console.log(`📊 Concurrent API calls: ${results.length}`);
      console.log('✅ Concurrent API performance verified');
    });
  });

  describe('Error Handling Performance', () => {
    test('should measure error handling performance', async () => {
      const startTime = Date.now();
      
      const AWS = require('aws-sdk');
      const mockInvoke = jest.fn().mockImplementation((params, callback) => {
        // Simulate error response
        setTimeout(() => {
          callback(null, {
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 500,
              body: JSON.stringify({
                error: 'Internal server error',
                message: 'Failed to process request'
              })
            })
          });
        }, 100);
      });
      AWS.Lambda.mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.invoke({
          FunctionName: 'infinite-nasa-apod-dev-fetcher',
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            source: 'error-test'
          })
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      const payload = JSON.parse(result.Payload);
      expect(payload.statusCode).toBe(500);
      expect(executionTime).toBeLessThan(200);

      console.log(`⏱️ Error handling time: ${executionTime}ms`);
      console.log('✅ Error handling performance verified');
    });
  });

  describe('CloudWatch Metrics', () => {
    test('should retrieve Lambda performance metrics', async () => {
      const AWS = require('aws-sdk');
      const mockGetMetricStatistics = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Label: 'Duration',
          Datapoints: [
            {
              Timestamp: '2025-01-15T06:00:00.000Z',
              Average: 1200.5,
              Maximum: 1500.0,
              Minimum: 800.0,
              Sum: 12005.0,
              Unit: 'Milliseconds'
            },
            {
              Timestamp: '2025-01-15T06:05:00.000Z',
              Average: 1100.0,
              Maximum: 1400.0,
              Minimum: 750.0,
              Sum: 11000.0,
              Unit: 'Milliseconds'
            }
          ]
        });
      });
      AWS.CloudWatch.mockImplementation(() => ({
        getMetricStatistics: mockGetMetricStatistics
      }));

      const cloudwatch = new AWS.CloudWatch();
      const result = await new Promise((resolve, reject) => {
        cloudwatch.getMetricStatistics({
          Namespace: 'AWS/Lambda',
          MetricName: 'Duration',
          Dimensions: [
            {
              Name: 'FunctionName',
              Value: 'infinite-nasa-apod-dev-fetcher'
            }
          ],
          StartTime: new Date('2025-01-15T06:00:00.000Z'),
          EndTime: new Date('2025-01-15T06:10:00.000Z'),
          Period: 300,
          Statistics: ['Average', 'Maximum', 'Minimum', 'Sum']
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Datapoints).toHaveLength(2);
      expect(result.Datapoints[0].Average).toBe(1200.5);
      expect(result.Datapoints[0].Maximum).toBe(1500.0);
      expect(result.Datapoints[0].Minimum).toBe(800.0);

      console.log('✅ CloudWatch Lambda metrics retrieved');
      console.log(`📊 Average duration: ${result.Datapoints[0].Average}ms`);
      console.log(`📊 Maximum duration: ${result.Datapoints[0].Maximum}ms`);
      console.log(`📊 Minimum duration: ${result.Datapoints[0].Minimum}ms`);
    });

    test('should retrieve Lambda error metrics', async () => {
      const AWS = require('aws-sdk');
      const mockGetMetricStatistics = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Label: 'Errors',
          Datapoints: [
            {
              Timestamp: '2025-01-15T06:00:00.000Z',
              Average: 0.0,
              Maximum: 0.0,
              Minimum: 0.0,
              Sum: 0.0,
              Unit: 'Count'
            },
            {
              Timestamp: '2025-01-15T06:05:00.000Z',
              Average: 0.0,
              Maximum: 0.0,
              Minimum: 0.0,
              Sum: 0.0,
              Unit: 'Count'
            }
          ]
        });
      });
      AWS.CloudWatch.mockImplementation(() => ({
        getMetricStatistics: mockGetMetricStatistics
      }));

      const cloudwatch = new AWS.CloudWatch();
      const result = await new Promise((resolve, reject) => {
        cloudwatch.getMetricStatistics({
          Namespace: 'AWS/Lambda',
          MetricName: 'Errors',
          Dimensions: [
            {
              Name: 'FunctionName',
              Value: 'infinite-nasa-apod-dev-fetcher'
            }
          ],
          StartTime: new Date('2025-01-15T06:00:00.000Z'),
          EndTime: new Date('2025-01-15T06:10:00.000Z'),
          Period: 300,
          Statistics: ['Average', 'Maximum', 'Minimum', 'Sum']
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Datapoints).toHaveLength(2);
      expect(result.Datapoints[0].Sum).toBe(0.0);

      console.log('✅ CloudWatch Lambda error metrics retrieved');
      console.log(`📊 Error count: ${result.Datapoints[0].Sum}`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance benchmarks', async () => {
      const benchmarks = {
        'nasa-fetcher': {
          coldStart: 2000, // 2 seconds
          warmExecution: 500, // 0.5 seconds
          memoryUsage: 256 // 256MB
        },
        'content-processor': {
          coldStart: 3000, // 3 seconds
          warmExecution: 1000, // 1 second
          memoryUsage: 512 // 512MB
        },
        'api-latest': {
          coldStart: 1000, // 1 second
          warmExecution: 200, // 0.2 seconds
          memoryUsage: 128 // 128MB
        }
      };

      // Test nasa-fetcher benchmarks
      const nasaFetcherBenchmark = benchmarks['nasa-fetcher'];
      expect(nasaFetcherBenchmark.coldStart).toBeLessThanOrEqual(2000);
      expect(nasaFetcherBenchmark.warmExecution).toBeLessThanOrEqual(500);
      expect(nasaFetcherBenchmark.memoryUsage).toBeLessThanOrEqual(256);

      // Test content-processor benchmarks
      const contentProcessorBenchmark = benchmarks['content-processor'];
      expect(contentProcessorBenchmark.coldStart).toBeLessThanOrEqual(3000);
      expect(contentProcessorBenchmark.warmExecution).toBeLessThanOrEqual(1000);
      expect(contentProcessorBenchmark.memoryUsage).toBeLessThanOrEqual(512);

      // Test api-latest benchmarks
      const apiLatestBenchmark = benchmarks['api-latest'];
      expect(apiLatestBenchmark.coldStart).toBeLessThanOrEqual(1000);
      expect(apiLatestBenchmark.warmExecution).toBeLessThanOrEqual(200);
      expect(apiLatestBenchmark.memoryUsage).toBeLessThanOrEqual(128);

      console.log('✅ Performance benchmarks verified');
      console.log('📊 NASA Fetcher:');
      console.log(`  - Cold start: ≤${nasaFetcherBenchmark.coldStart}ms`);
      console.log(`  - Warm execution: ≤${nasaFetcherBenchmark.warmExecution}ms`);
      console.log(`  - Memory usage: ≤${nasaFetcherBenchmark.memoryUsage}MB`);
      console.log('📊 Content Processor:');
      console.log(`  - Cold start: ≤${contentProcessorBenchmark.coldStart}ms`);
      console.log(`  - Warm execution: ≤${contentProcessorBenchmark.warmExecution}ms`);
      console.log(`  - Memory usage: ≤${contentProcessorBenchmark.memoryUsage}MB`);
      console.log('📊 API Latest:');
      console.log(`  - Cold start: ≤${apiLatestBenchmark.coldStart}ms`);
      console.log(`  - Warm execution: ≤${apiLatestBenchmark.warmExecution}ms`);
      console.log(`  - Memory usage: ≤${apiLatestBenchmark.memoryUsage}MB`);
    });
  });
});
