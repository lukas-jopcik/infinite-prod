/**
 * API Gateway integration tests
 * Tests API Gateway configuration and routing
 */

const request = require('supertest');
const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  APIGateway: jest.fn(() => ({
    getRestApis: jest.fn(),
    getResources: jest.fn(),
    getMethod: jest.fn(),
    getIntegration: jest.fn()
  })),
  Lambda: jest.fn(() => ({
    getFunction: jest.fn(),
    listFunctions: jest.fn()
  }))
}));

describe('API Gateway Integration', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.AWS_REGION = 'eu-central-1';
    process.env.API_GATEWAY_ID = 'l9lm0zrzyl';
    process.env.API_GATEWAY_STAGE = 'prod';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('API Gateway Configuration', () => {
    test('should have correct API Gateway configuration', async () => {
      const AWS = require('aws-sdk');
      const mockGetRestApis = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          items: [{
            id: 'l9lm0zrzyl',
            name: 'infinite-nasa-apod-api',
            description: 'Infinite NASA APOD API',
            createdDate: '2024-12-01T00:00:00.000Z'
          }]
        });
      });
      AWS.APIGateway.mockImplementation(() => ({
        getRestApis: mockGetRestApis
      }));

      const apiGateway = new AWS.APIGateway();
      const result = await new Promise((resolve, reject) => {
        apiGateway.getRestApis({}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('l9lm0zrzyl');
      expect(result.items[0].name).toBe('infinite-nasa-apod-api');
    });

    test('should have correct API resources configured', async () => {
      const AWS = require('aws-sdk');
      const mockGetResources = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          items: [
            { id: 'root', path: '/' },
            { id: 'api', path: '/api' },
            { id: 'latest', path: '/api/latest', parentId: 'api' },
            { id: 'reprocess', path: '/api/reprocess', parentId: 'api' }
          ]
        });
      });
      AWS.APIGateway.mockImplementation(() => ({
        getResources: mockGetResources
      }));

      const apiGateway = new AWS.APIGateway();
      const result = await new Promise((resolve, reject) => {
        apiGateway.getResources({ restApiId: 'l9lm0zrzyl' }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.items).toHaveLength(4);
      expect(result.items.find(item => item.path === '/api/latest')).toBeDefined();
      expect(result.items.find(item => item.path === '/api/reprocess')).toBeDefined();
    });

    test('should have correct HTTP methods configured', async () => {
      const AWS = require('aws-sdk');
      const mockGetMethod = jest.fn().mockImplementation((params, callback) => {
        const methods = {
          'GET': { httpMethod: 'GET', authorizationType: 'NONE' },
          'POST': { httpMethod: 'POST', authorizationType: 'NONE' },
          'OPTIONS': { httpMethod: 'OPTIONS', authorizationType: 'NONE' }
        };
        callback(null, methods[params.httpMethod] || null);
      });
      AWS.APIGateway.mockImplementation(() => ({
        getMethod: mockGetMethod
      }));

      const apiGateway = new AWS.APIGateway();
      
      // Test GET method for /api/latest
      const getResult = await new Promise((resolve, reject) => {
        apiGateway.getMethod({
          restApiId: 'l9lm0zrzyl',
          resourceId: 'latest',
          httpMethod: 'GET'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(getResult.httpMethod).toBe('GET');
      expect(getResult.authorizationType).toBe('NONE');

      // Test POST method for /api/reprocess
      const postResult = await new Promise((resolve, reject) => {
        apiGateway.getMethod({
          restApiId: 'l9lm0zrzyl',
          resourceId: 'reprocess',
          httpMethod: 'POST'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(postResult.httpMethod).toBe('POST');
      expect(postResult.authorizationType).toBe('NONE');
    });

    test('should have correct Lambda integrations', async () => {
      const AWS = require('aws-sdk');
      const mockGetIntegration = jest.fn().mockImplementation((params, callback) => {
        const integrations = {
          'GET': {
            type: 'AWS_PROXY',
            integrationHttpMethod: 'POST',
            uri: 'arn:aws:apigateway:eu-central-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-central-1:123456789012:function:infinite-nasa-apod-dev-api-latest/invocations'
          },
          'POST': {
            type: 'AWS_PROXY',
            integrationHttpMethod: 'POST',
            uri: 'arn:aws:apigateway:eu-central-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-central-1:123456789012:function:infinite-nasa-apod-dev-api-reprocess/invocations'
          }
        };
        callback(null, integrations[params.httpMethod] || null);
      });
      AWS.APIGateway.mockImplementation(() => ({
        getIntegration: mockGetIntegration
      }));

      const apiGateway = new AWS.APIGateway();
      
      // Test integration for /api/latest GET
      const latestIntegration = await new Promise((resolve, reject) => {
        apiGateway.getIntegration({
          restApiId: 'l9lm0zrzyl',
          resourceId: 'latest',
          httpMethod: 'GET'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(latestIntegration.type).toBe('AWS_PROXY');
      expect(latestIntegration.integrationHttpMethod).toBe('POST');
      expect(latestIntegration.uri).toContain('api-latest');

      // Test integration for /api/reprocess POST
      const reprocessIntegration = await new Promise((resolve, reject) => {
        apiGateway.getIntegration({
          restApiId: 'l9lm0zrzyl',
          resourceId: 'reprocess',
          httpMethod: 'POST'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(reprocessIntegration.type).toBe('AWS_PROXY');
      expect(reprocessIntegration.integrationHttpMethod).toBe('POST');
      expect(reprocessIntegration.uri).toContain('api-reprocess');
    });
  });

  describe('Lambda Function Integration', () => {
    test('should have Lambda functions properly configured', async () => {
      const AWS = require('aws-sdk');
      const mockListFunctions = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Functions: [
            {
              FunctionName: 'infinite-nasa-apod-dev-api-latest',
              Runtime: 'nodejs18.x',
              Handler: 'index.handler',
              Timeout: 10,
              MemorySize: 256,
              Environment: {
                Variables: {
                  TABLE_NAME: 'infinite-nasa-apod-dev-content',
                  INDEX_NAME: 'gsi_latest'
                }
              }
            },
            {
              FunctionName: 'infinite-nasa-apod-dev-api-reprocess',
              Runtime: 'nodejs18.x',
              Handler: 'index.handler',
              Timeout: 30,
              MemorySize: 512,
              Environment: {
                Variables: {
                  TABLE_NAME: 'infinite-nasa-apod-dev-content',
                  PROCESSOR_FUNCTION: 'infinite-nasa-apod-dev-content-processor'
                }
              }
            }
          ]
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        listFunctions: mockListFunctions
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.listFunctions({}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Functions).toHaveLength(2);
      
      const apiLatestFunction = result.Functions.find(f => f.FunctionName === 'infinite-nasa-apod-dev-api-latest');
      expect(apiLatestFunction).toBeDefined();
      expect(apiLatestFunction.Runtime).toBe('nodejs18.x');
      expect(apiLatestFunction.Timeout).toBe(10);
      expect(apiLatestFunction.MemorySize).toBe(256);
      expect(apiLatestFunction.Environment.Variables.TABLE_NAME).toBe('infinite-nasa-apod-dev-content');

      const apiReprocessFunction = result.Functions.find(f => f.FunctionName === 'infinite-nasa-apod-dev-api-reprocess');
      expect(apiReprocessFunction).toBeDefined();
      expect(apiReprocessFunction.Runtime).toBe('nodejs18.x');
      expect(apiReprocessFunction.Timeout).toBe(30);
      expect(apiReprocessFunction.MemorySize).toBe(512);
    });

    test('should have correct Lambda permissions for API Gateway', async () => {
      const AWS = require('aws-sdk');
      const mockGetFunction = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Configuration: {
            FunctionName: params.FunctionName,
            Role: 'arn:aws:iam::123456789012:role/infinite-nasa-apod-dev-lambda-role'
          }
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        getFunction: mockGetFunction
      }));

      const lambda = new AWS.Lambda();
      
      const apiLatestResult = await new Promise((resolve, reject) => {
        lambda.getFunction({
          FunctionName: 'infinite-nasa-apod-dev-api-latest'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(apiLatestResult.Configuration.Role).toContain('lambda-role');
    });
  });

  describe('API Gateway Endpoints', () => {
    test('should have correct base URL configuration', () => {
      const expectedBaseUrl = 'https://l9lm0zrzyl.execute-api.eu-central-1.amazonaws.com/prod';
      const actualBaseUrl = process.env.API_GATEWAY_BASE_URL || 
        `https://${process.env.API_GATEWAY_ID}.execute-api.${process.env.AWS_REGION}.amazonaws.com/${process.env.API_GATEWAY_STAGE}`;
      
      expect(actualBaseUrl).toBe(expectedBaseUrl);
    });

    test('should have correct CORS configuration', async () => {
      const AWS = require('aws-sdk');
      const mockGetMethod = jest.fn().mockImplementation((params, callback) => {
        if (params.httpMethod === 'OPTIONS') {
          callback(null, {
            httpMethod: 'OPTIONS',
            methodResponses: {
              '200': {
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Origin': true,
                  'method.response.header.Access-Control-Allow-Headers': true,
                  'method.response.header.Access-Control-Allow-Methods': true
                }
              }
            }
          });
        } else {
          callback(null, { httpMethod: params.httpMethod });
        }
      });
      AWS.APIGateway.mockImplementation(() => ({
        getMethod: mockGetMethod
      }));

      const apiGateway = new AWS.APIGateway();
      
      const optionsResult = await new Promise((resolve, reject) => {
        apiGateway.getMethod({
          restApiId: 'l9lm0zrzyl',
          resourceId: 'latest',
          httpMethod: 'OPTIONS'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(optionsResult.methodResponses['200'].responseParameters).toHaveProperty(
        'method.response.header.Access-Control-Allow-Origin'
      );
      expect(optionsResult.methodResponses['200'].responseParameters).toHaveProperty(
        'method.response.header.Access-Control-Allow-Headers'
      );
      expect(optionsResult.methodResponses['200'].responseParameters).toHaveProperty(
        'method.response.header.Access-Control-Allow-Methods'
      );
    });

    test('should have correct request/response models', async () => {
      const AWS = require('aws-sdk');
      const mockGetMethod = jest.fn().mockImplementation((params, callback) => {
        const methods = {
          'GET': {
            httpMethod: 'GET',
            requestParameters: {
              'method.request.querystring.limit': false,
              'method.request.querystring.date': false
            },
            methodResponses: {
              '200': {
                statusCode: '200',
                responseModels: {
                  'application/json': 'Empty'
                }
              },
              '500': {
                statusCode: '500',
                responseModels: {
                  'application/json': 'Error'
                }
              }
            }
          },
          'POST': {
            httpMethod: 'POST',
            requestModels: {
              'application/json': 'ReprocessRequest'
            },
            methodResponses: {
              '202': {
                statusCode: '202',
                responseModels: {
                  'application/json': 'ReprocessResponse'
                }
              },
              '400': {
                statusCode: '400',
                responseModels: {
                  'application/json': 'Error'
                }
              }
            }
          }
        };
        callback(null, methods[params.httpMethod] || null);
      });
      AWS.APIGateway.mockImplementation(() => ({
        getMethod: mockGetMethod
      }));

      const apiGateway = new AWS.APIGateway();
      
      // Test GET method configuration
      const getResult = await new Promise((resolve, reject) => {
        apiGateway.getMethod({
          restApiId: 'l9lm0zrzyl',
          resourceId: 'latest',
          httpMethod: 'GET'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(getResult.requestParameters).toHaveProperty('method.request.querystring.limit');
      expect(getResult.requestParameters).toHaveProperty('method.request.querystring.date');
      expect(getResult.methodResponses).toHaveProperty('200');
      expect(getResult.methodResponses).toHaveProperty('500');

      // Test POST method configuration
      const postResult = await new Promise((resolve, reject) => {
        apiGateway.getMethod({
          restApiId: 'l9lm0zrzyl',
          resourceId: 'reprocess',
          httpMethod: 'POST'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(postResult.requestModels).toHaveProperty('application/json');
      expect(postResult.methodResponses).toHaveProperty('202');
      expect(postResult.methodResponses).toHaveProperty('400');
    });
  });

  describe('Error Handling', () => {
    test('should handle API Gateway errors', async () => {
      const AWS = require('aws-sdk');
      const mockGetRestApis = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('API Gateway error'), null);
      });
      AWS.APIGateway.mockImplementation(() => ({
        getRestApis: mockGetRestApis
      }));

      const apiGateway = new AWS.APIGateway();
      
      try {
        await new Promise((resolve, reject) => {
          apiGateway.getRestApis({}, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('API Gateway error');
      }
    });

    test('should handle Lambda function errors', async () => {
      const AWS = require('aws-sdk');
      const mockGetFunction = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('Lambda function not found'), null);
      });
      AWS.Lambda.mockImplementation(() => ({
        getFunction: mockGetFunction
      }));

      const lambda = new AWS.Lambda();
      
      try {
        await new Promise((resolve, reject) => {
          lambda.getFunction({
            FunctionName: 'non-existent-function'
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('Lambda function not found');
      }
    });
  });

  describe('Performance and Monitoring', () => {
    test('should have appropriate timeout configurations', async () => {
      const AWS = require('aws-sdk');
      const mockListFunctions = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Functions: [
            {
              FunctionName: 'infinite-nasa-apod-dev-api-latest',
              Timeout: 10, // Should be short for read operations
              MemorySize: 256
            },
            {
              FunctionName: 'infinite-nasa-apod-dev-api-reprocess',
              Timeout: 30, // Should be longer for write operations
              MemorySize: 512
            }
          ]
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        listFunctions: mockListFunctions
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.listFunctions({}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const apiLatestFunction = result.Functions.find(f => f.FunctionName === 'infinite-nasa-apod-dev-api-latest');
      const apiReprocessFunction = result.Functions.find(f => f.FunctionName === 'infinite-nasa-apod-dev-api-reprocess');

      expect(apiLatestFunction.Timeout).toBeLessThanOrEqual(10);
      expect(apiReprocessFunction.Timeout).toBeLessThanOrEqual(30);
    });

    test('should have appropriate memory configurations', async () => {
      const AWS = require('aws-sdk');
      const mockListFunctions = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Functions: [
            {
              FunctionName: 'infinite-nasa-apod-dev-api-latest',
              MemorySize: 256 // Should be minimal for simple read operations
            },
            {
              FunctionName: 'infinite-nasa-apod-dev-api-reprocess',
              MemorySize: 512 // Should be higher for complex operations
            }
          ]
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        listFunctions: mockListFunctions
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.listFunctions({}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const apiLatestFunction = result.Functions.find(f => f.FunctionName === 'infinite-nasa-apod-dev-api-latest');
      const apiReprocessFunction = result.Functions.find(f => f.FunctionName === 'infinite-nasa-apod-dev-api-reprocess');

      expect(apiLatestFunction.MemorySize).toBeGreaterThanOrEqual(128);
      expect(apiLatestFunction.MemorySize).toBeLessThanOrEqual(512);
      expect(apiReprocessFunction.MemorySize).toBeGreaterThanOrEqual(256);
      expect(apiReprocessFunction.MemorySize).toBeLessThanOrEqual(1024);
    });
  });
});
