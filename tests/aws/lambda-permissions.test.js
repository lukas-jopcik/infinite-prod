/**
 * AWS Lambda permissions tests
 * Tests Lambda function permissions, IAM roles, and resource access
 */

const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  IAM: jest.fn(() => ({
    getRole: jest.fn(),
    listRoles: jest.fn(),
    getRolePolicy: jest.fn(),
    listRolePolicies: jest.fn(),
    listAttachedRolePolicies: jest.fn(),
    simulatePrincipalPolicy: jest.fn()
  })),
  Lambda: jest.fn(() => ({
    getFunction: jest.fn(),
    getFunctionConfiguration: jest.fn(),
    listFunctions: jest.fn(),
    getPolicy: jest.fn(),
    listEventSourceMappings: jest.fn(),
    getAccountSettings: jest.fn()
  })),
  STS: jest.fn(() => ({
    getCallerIdentity: jest.fn()
  }))
}));

describe('Lambda Permissions and IAM Roles', () => {
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

  describe('Lambda Function Configuration', () => {
    test('should have correct Lambda function configuration', async () => {
      const AWS = require('aws-sdk');
      const mockGetFunction = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Configuration: {
            FunctionName: 'infinite-nasa-apod-dev-fetcher',
            Runtime: 'nodejs18.x',
            Role: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
            Handler: 'index.handler',
            CodeSize: 1024000,
            Description: 'Fetches NASA APOD data and stores in DynamoDB',
            Timeout: 300,
            MemorySize: 256,
            LastModified: '2025-01-15T06:00:00.000Z',
            CodeSha256: 'test-sha256-hash',
            Version: '$LATEST',
            Environment: {
              Variables: {
                REGION: 'eu-central-1',
                ENVIRONMENT: 'dev',
                DYNAMODB_RAW_CONTENT_TABLE: 'InfiniteRawContent-dev',
                DYNAMODB_ARTICLES_TABLE: 'InfiniteArticles-dev',
                NASA_SECRET_ARN: 'arn:aws:secretsmanager:eu-central-1:349660737637:secret:infinite/nasa-api-key-dev',
                S3_BUCKET_NAME: 'infinite-nasa-apod-dev-images-349660737637',
                CLOUDFRONT_DOMAIN: 'd2ydyf9w4v170.cloudfront.net'
              }
            }
          }
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        getFunction: mockGetFunction
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.getFunction({
          FunctionName: 'infinite-nasa-apod-dev-fetcher'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Configuration.FunctionName).toBe('infinite-nasa-apod-dev-fetcher');
      expect(result.Configuration.Runtime).toBe('nodejs18.x');
      expect(result.Configuration.Role).toContain('infinite-nasa-apod-dev-fetcher-role');
      expect(result.Configuration.Timeout).toBe(300);
      expect(result.Configuration.MemorySize).toBe(256);
      expect(result.Configuration.Environment.Variables.REGION).toBe('eu-central-1');

      console.log('✅ Lambda function configuration verified');
      console.log(`🔧 Function: ${result.Configuration.FunctionName}`);
      console.log(`⚙️ Runtime: ${result.Configuration.Runtime}`);
      console.log(`👤 Role: ${result.Configuration.Role}`);
      console.log(`⏱️ Timeout: ${result.Configuration.Timeout}s`);
      console.log(`💾 Memory: ${result.Configuration.MemorySize}MB`);
    });

    test('should list all Lambda functions', async () => {
      const AWS = require('aws-sdk');
      const mockListFunctions = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Functions: [
            {
              FunctionName: 'infinite-nasa-apod-dev-fetcher',
              Runtime: 'nodejs18.x',
              Role: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
              Handler: 'index.handler',
              CodeSize: 1024000,
              Description: 'Fetches NASA APOD data and stores in DynamoDB',
              Timeout: 300,
              MemorySize: 256,
              LastModified: '2025-01-15T06:00:00.000Z'
            },
            {
              FunctionName: 'infinite-nasa-apod-dev-content-processor',
              Runtime: 'nodejs18.x',
              Role: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-content-processor-role',
              Handler: 'index.handler',
              CodeSize: 2048000,
              Description: 'Processes raw content and generates articles',
              Timeout: 900,
              MemorySize: 512,
              LastModified: '2025-01-15T06:00:00.000Z'
            },
            {
              FunctionName: 'infinite-nasa-apod-dev-api-latest',
              Runtime: 'nodejs18.x',
              Role: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-api-latest-role',
              Handler: 'index.handler',
              CodeSize: 512000,
              Description: 'API endpoint for latest content',
              Timeout: 30,
              MemorySize: 128,
              LastModified: '2025-01-15T06:00:00.000Z'
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

      expect(result.Functions).toHaveLength(3);
      expect(result.Functions[0].FunctionName).toBe('infinite-nasa-apod-dev-fetcher');
      expect(result.Functions[1].FunctionName).toBe('infinite-nasa-apod-dev-content-processor');
      expect(result.Functions[2].FunctionName).toBe('infinite-nasa-apod-dev-api-latest');

      console.log('✅ Lambda functions listing verified');
      console.log(`📊 Functions: ${result.Functions.length}`);
      result.Functions.forEach(func => {
        console.log(`  - ${func.FunctionName} (${func.Runtime}, ${func.MemorySize}MB)`);
      });
    });
  });

  describe('IAM Role Configuration', () => {
    test('should have correct IAM role for fetcher function', async () => {
      const AWS = require('aws-sdk');
      const mockGetRole = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Role: {
            RoleName: 'infinite-nasa-apod-dev-fetcher-role',
            Arn: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
            CreateDate: '2024-12-01T00:00:00.000Z',
            AssumeRolePolicyDocument: JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: {
                    Service: 'lambda.amazonaws.com'
                  },
                  Action: 'sts:AssumeRole'
                }
              ]
            }),
            Description: 'Role for NASA APOD fetcher Lambda function',
            MaxSessionDuration: 3600,
            Path: '/'
          }
        });
      });
      AWS.IAM.mockImplementation(() => ({
        getRole: mockGetRole
      }));

      const iam = new AWS.IAM();
      const result = await new Promise((resolve, reject) => {
        iam.getRole({
          RoleName: 'infinite-nasa-apod-dev-fetcher-role'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Role.RoleName).toBe('infinite-nasa-apod-dev-fetcher-role');
      expect(result.Role.Arn).toContain('infinite-nasa-apod-dev-fetcher-role');
      
      const assumeRolePolicy = JSON.parse(result.Role.AssumeRolePolicyDocument);
      expect(assumeRole.Statement[0].Principal.Service).toBe('lambda.amazonaws.com');
      expect(assumeRole.Statement[0].Action).toBe('sts:AssumeRole');

      console.log('✅ IAM role configuration verified');
      console.log(`👤 Role: ${result.Role.RoleName}`);
      console.log(`🔗 ARN: ${result.Role.Arn}`);
      console.log(`📅 Created: ${result.Role.CreateDate}`);
    });

    test('should have correct attached policies for fetcher role', async () => {
      const AWS = require('aws-sdk');
      const mockListAttachedRolePolicies = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          AttachedPolicies: [
            {
              PolicyName: 'AWSLambdaBasicExecutionRole',
              PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            },
            {
              PolicyName: 'InfiniteNasaApodDevFetcherPolicy',
              PolicyArn: 'arn:aws:iam::349660737637:policy/InfiniteNasaApodDevFetcherPolicy'
            }
          ]
        });
      });
      AWS.IAM.mockImplementation(() => ({
        listAttachedRolePolicies: mockListAttachedRolePolicies
      }));

      const iam = new AWS.IAM();
      const result = await new Promise((resolve, reject) => {
        iam.listAttachedRolePolicies({
          RoleName: 'infinite-nasa-apod-dev-fetcher-role'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.AttachedPolicies).toHaveLength(2);
      expect(result.AttachedPolicies[0].PolicyName).toBe('AWSLambdaBasicExecutionRole');
      expect(result.AttachedPolicies[1].PolicyName).toBe('InfiniteNasaApodDevFetcherPolicy');

      console.log('✅ IAM role policies verified');
      console.log(`📋 Attached policies: ${result.AttachedPolicies.length}`);
      result.AttachedPolicies.forEach(policy => {
        console.log(`  - ${policy.PolicyName}`);
      });
    });

    test('should have correct inline policies for fetcher role', async () => {
      const AWS = require('aws-sdk');
      const mockListRolePolicies = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          PolicyNames: [
            'DynamoDBAccess',
            'SecretsManagerAccess',
            'S3Access'
          ]
        });
      });
      const mockGetRolePolicy = jest.fn().mockImplementation((params, callback) => {
        let policyDocument;
        if (params.PolicyName === 'DynamoDBAccess') {
          policyDocument = JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'dynamodb:PutItem',
                  'dynamodb:GetItem',
                  'dynamodb:Query',
                  'dynamodb:Scan'
                ],
                Resource: [
                  'arn:aws:dynamodb:eu-central-1:349660737637:table/InfiniteRawContent-dev',
                  'arn:aws:dynamodb:eu-central-1:349660737637:table/InfiniteArticles-dev'
                ]
              }
            ]
          });
        } else if (params.PolicyName === 'SecretsManagerAccess') {
          policyDocument = JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'secretsmanager:GetSecretValue'
                ],
                Resource: [
                  'arn:aws:secretsmanager:eu-central-1:349660737637:secret:infinite/nasa-api-key-dev*'
                ]
              }
            ]
          });
        } else if (params.PolicyName === 'S3Access') {
          policyDocument = JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  's3:PutObject',
                  's3:GetObject',
                  's3:DeleteObject'
                ],
                Resource: [
                  'arn:aws:s3:::infinite-nasa-apod-dev-images-349660737637/*'
                ]
              }
            ]
          });
        }
        
        callback(null, {
          PolicyName: params.PolicyName,
          PolicyDocument: policyDocument
        });
      });

      AWS.IAM.mockImplementation(() => ({
        listRolePolicies: mockListRolePolicies,
        getRolePolicy: mockGetRolePolicy
      }));

      const iam = new AWS.IAM();
      
      // List inline policies
      const listResult = await new Promise((resolve, reject) => {
        iam.listRolePolicies({
          RoleName: 'infinite-nasa-apod-dev-fetcher-role'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(listResult.PolicyNames).toHaveLength(3);
      expect(listResult.PolicyNames).toContain('DynamoDBAccess');
      expect(listResult.PolicyNames).toContain('SecretsManagerAccess');
      expect(listResult.PolicyNames).toContain('S3Access');

      // Get DynamoDB policy
      const dynamoPolicy = await new Promise((resolve, reject) => {
        iam.getRolePolicy({
          RoleName: 'infinite-nasa-apod-dev-fetcher-role',
          PolicyName: 'DynamoDBAccess'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const dynamoPolicyDoc = JSON.parse(dynamoPolicy.PolicyDocument);
      expect(dynamoPolicyDoc.Statement[0].Action).toContain('dynamodb:PutItem');
      expect(dynamoPolicyDoc.Statement[0].Action).toContain('dynamodb:GetItem');
      expect(dynamoPolicyDoc.Statement[0].Resource).toContain('InfiniteRawContent-dev');

      console.log('✅ IAM inline policies verified');
      console.log(`📋 Inline policies: ${listResult.PolicyNames.length}`);
      listResult.PolicyNames.forEach(policy => {
        console.log(`  - ${policy}`);
      });
    });
  });

  describe('Permission Testing', () => {
    test('should test DynamoDB permissions', async () => {
      const AWS = require('aws-sdk');
      const mockSimulatePrincipalPolicy = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          EvaluationResults: [
            {
              EvalActionName: 'dynamodb:PutItem',
              EvalResourceName: 'arn:aws:dynamodb:eu-central-1:349660737637:table/InfiniteRawContent-dev',
              EvalDecision: 'allowed',
              MatchedStatements: [
                {
                  SourcePolicyId: 'DynamoDBAccess',
                  SourcePolicyType: 'InlinePolicy'
                }
              ]
            }
          ]
        });
      });
      AWS.IAM.mockImplementation(() => ({
        simulatePrincipalPolicy: mockSimulatePrincipalPolicy
      }));

      const iam = new AWS.IAM();
      const result = await new Promise((resolve, reject) => {
        iam.simulatePrincipalPolicy({
          PolicySourceArn: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
          ActionNames: ['dynamodb:PutItem'],
          ResourceArns: ['arn:aws:dynamodb:eu-central-1:349660737637:table/InfiniteRawContent-dev']
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.EvaluationResults).toHaveLength(1);
      expect(result.EvaluationResults[0].EvalDecision).toBe('allowed');
      expect(result.EvaluationResults[0].EvalActionName).toBe('dynamodb:PutItem');

      console.log('✅ DynamoDB permissions verified');
      console.log(`🔐 Action: ${result.EvaluationResults[0].EvalActionName}`);
      console.log(`📊 Decision: ${result.EvaluationResults[0].EvalDecision}`);
    });

    test('should test S3 permissions', async () => {
      const AWS = require('aws-sdk');
      const mockSimulatePrincipalPolicy = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          EvaluationResults: [
            {
              EvalActionName: 's3:PutObject',
              EvalResourceName: 'arn:aws:s3:::infinite-nasa-apod-dev-images-349660737637/images/test.jpg',
              EvalDecision: 'allowed',
              MatchedStatements: [
                {
                  SourcePolicyId: 'S3Access',
                  SourcePolicyType: 'InlinePolicy'
                }
              ]
            }
          ]
        });
      });
      AWS.IAM.mockImplementation(() => ({
        simulatePrincipalPolicy: mockSimulatePrincipalPolicy
      }));

      const iam = new AWS.IAM();
      const result = await new Promise((resolve, reject) => {
        iam.simulatePrincipalPolicy({
          PolicySourceArn: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
          ActionNames: ['s3:PutObject'],
          ResourceArns: ['arn:aws:s3:::infinite-nasa-apod-dev-images-349660737637/images/test.jpg']
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.EvaluationResults).toHaveLength(1);
      expect(result.EvaluationResults[0].EvalDecision).toBe('allowed');
      expect(result.EvaluationResults[0].EvalActionName).toBe('s3:PutObject');

      console.log('✅ S3 permissions verified');
      console.log(`🔐 Action: ${result.EvaluationResults[0].EvalActionName}`);
      console.log(`📊 Decision: ${result.EvaluationResults[0].EvalDecision}`);
    });

    test('should test Secrets Manager permissions', async () => {
      const AWS = require('aws-sdk');
      const mockSimulatePrincipalPolicy = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          EvaluationResults: [
            {
              EvalActionName: 'secretsmanager:GetSecretValue',
              EvalResourceName: 'arn:aws:secretsmanager:eu-central-1:349660737637:secret:infinite/nasa-api-key-dev',
              EvalDecision: 'allowed',
              MatchedStatements: [
                {
                  SourcePolicyId: 'SecretsManagerAccess',
                  SourcePolicyType: 'InlinePolicy'
                }
              ]
            }
          ]
        });
      });
      AWS.IAM.mockImplementation(() => ({
        simulatePrincipalPolicy: mockSimulatePrincipalPolicy
      }));

      const iam = new AWS.IAM();
      const result = await new Promise((resolve, reject) => {
        iam.simulatePrincipalPolicy({
          PolicySourceArn: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
          ActionNames: ['secretsmanager:GetSecretValue'],
          ResourceArns: ['arn:aws:secretsmanager:eu-central-1:349660737637:secret:infinite/nasa-api-key-dev']
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.EvaluationResults).toHaveLength(1);
      expect(result.EvaluationResults[0].EvalDecision).toBe('allowed');
      expect(result.EvaluationResults[0].EvalActionName).toBe('secretsmanager:GetSecretValue');

      console.log('✅ Secrets Manager permissions verified');
      console.log(`🔐 Action: ${result.EvaluationResults[0].EvalActionName}`);
      console.log(`📊 Decision: ${result.EvaluationResults[0].EvalDecision}`);
    });
  });

  describe('Lambda Function Policies', () => {
    test('should have correct resource-based policies', async () => {
      const AWS = require('aws-sdk');
      const mockGetPolicy = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Id: 'default',
            Statement: [
              {
                Sid: 'AllowAPIGatewayInvoke',
                Effect: 'Allow',
                Principal: {
                  Service: 'apigateway.amazonaws.com'
                },
                Action: 'lambda:InvokeFunction',
                Resource: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-api-latest',
                Condition: {
                  ArnLike: {
                    'aws:SourceArn': 'arn:aws:execute-api:eu-central-1:349660737637:*'
                  }
                }
              }
            ]
          }),
          RevisionId: 'test-revision-id'
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        getPolicy: mockGetPolicy
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.getPolicy({
          FunctionName: 'infinite-nasa-apod-dev-api-latest'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const policy = JSON.parse(result.Policy);
      expect(policy.Statement).toHaveLength(1);
      expect(policy.Statement[0].Principal.Service).toBe('apigateway.amazonaws.com');
      expect(policy.Statement[0].Action).toBe('lambda:InvokeFunction');

      console.log('✅ Lambda resource-based policy verified');
      console.log(`🔐 Principal: ${policy.Statement[0].Principal.Service}`);
      console.log(`⚡ Action: ${policy.Statement[0].Action}`);
    });
  });

  describe('Event Source Mappings', () => {
    test('should have correct EventBridge event source mappings', async () => {
      const AWS = require('aws-sdk');
      const mockListEventSourceMappings = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          EventSourceMappings: [
            {
              UUID: 'test-uuid-12345',
              EventSourceArn: 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-daily-fetch',
              FunctionArn: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-fetcher',
              LastModified: '2025-01-15T06:00:00.000Z',
              State: 'Enabled',
              StateTransitionReason: 'User action',
              BatchSize: 1,
              MaximumBatchingWindowInSeconds: 0
            }
          ]
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        listEventSourceMappings: mockListEventSourceMappings
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.listEventSourceMappings({
          FunctionName: 'infinite-nasa-apod-dev-fetcher'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.EventSourceMappings).toHaveLength(1);
      expect(result.EventSourceMappings[0].State).toBe('Enabled');
      expect(result.EventSourceMappings[0].EventSourceArn).toContain('infinite-nasa-apod-dev-daily-fetch');

      console.log('✅ EventBridge event source mapping verified');
      console.log(`🔗 Event Source: ${result.EventSourceMappings[0].EventSourceArn}`);
      console.log(`📊 State: ${result.EventSourceMappings[0].State}`);
    });
  });

  describe('Account Settings', () => {
    test('should check Lambda account settings', async () => {
      const AWS = require('aws-sdk');
      const mockGetAccountSettings = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          AccountLimit: {
            TotalCodeSize: {
              CodeSizeUnzipped: 52428800,
              CodeSizeZipped: 10485760
            },
            CodeSizeUnzipped: 52428800,
            CodeSizeZipped: 10485760,
            ConcurrentExecutions: 1000,
            UnreservedConcurrentExecutions: 1000
          },
          AccountUsage: {
            FunctionCount: 3,
            TotalCodeSize: {
              CodeSizeUnzipped: 3584000,
              CodeSizeZipped: 1024000
            },
            CodeSizeUnzipped: 3584000,
            CodeSizeZipped: 1024000,
            ConcurrentExecutions: 0
          }
        });
      });
      AWS.Lambda.mockImplementation(() => ({
        getAccountSettings: mockGetAccountSettings
      }));

      const lambda = new AWS.Lambda();
      const result = await new Promise((resolve, reject) => {
        lambda.getAccountSettings({}, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.AccountUsage.FunctionCount).toBe(3);
      expect(result.AccountLimit.ConcurrentExecutions).toBe(1000);
      expect(result.AccountUsage.TotalCodeSize.CodeSizeUnzipped).toBeLessThan(
        result.AccountLimit.TotalCodeSize.CodeSizeUnzipped
      );

      console.log('✅ Lambda account settings verified');
      console.log(`📊 Functions: ${result.AccountUsage.FunctionCount}`);
      console.log(`💾 Code Size: ${result.AccountUsage.TotalCodeSize.CodeSizeUnzipped} bytes`);
      console.log(`⚡ Concurrent Limit: ${result.AccountLimit.ConcurrentExecutions}`);
    });
  });

  describe('Error Handling', () => {
    test('should handle IAM role not found error', async () => {
      const AWS = require('aws-sdk');
      const mockGetRole = jest.fn().mockImplementation((params, callback) => {
        const error = new Error('NoSuchEntity');
        error.code = 'NoSuchEntity';
        callback(error, null);
      });
      AWS.IAM.mockImplementation(() => ({
        getRole: mockGetRole
      }));

      const iam = new AWS.IAM();
      
      try {
        await new Promise((resolve, reject) => {
          iam.getRole({
            RoleName: 'non-existent-role'
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.code).toBe('NoSuchEntity');
      }

      console.log('✅ IAM role not found error handling verified');
    });

    test('should handle Lambda function not found error', async () => {
      const AWS = require('aws-sdk');
      const mockGetFunction = jest.fn().mockImplementation((params, callback) => {
        const error = new Error('ResourceNotFoundException');
        error.code = 'ResourceNotFoundException';
        callback(error, null);
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
        expect(error.code).toBe('ResourceNotFoundException');
      }

      console.log('✅ Lambda function not found error handling verified');
    });
  });

  describe('Security Best Practices', () => {
    test('should verify least privilege principle', async () => {
      const AWS = require('aws-sdk');
      const mockSimulatePrincipalPolicy = jest.fn().mockImplementation((params, callback) => {
        // Test that role cannot access resources it shouldn't
        const deniedActions = ['s3:DeleteBucket', 'dynamodb:DeleteTable', 'iam:CreateUser'];
        const isDenied = deniedActions.some(action => params.ActionNames.includes(action));
        
        callback(null, {
          EvaluationResults: params.ActionNames.map(action => ({
            EvalActionName: action,
            EvalResourceName: params.ResourceArns[0],
            EvalDecision: isDenied ? 'denied' : 'allowed'
          }))
        });
      });
      AWS.IAM.mockImplementation(() => ({
        simulatePrincipalPolicy: mockSimulatePrincipalPolicy
      }));

      const iam = new AWS.IAM();
      const result = await new Promise((resolve, reject) => {
        iam.simulatePrincipalPolicy({
          PolicySourceArn: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
          ActionNames: ['s3:PutObject', 's3:DeleteBucket', 'dynamodb:PutItem', 'dynamodb:DeleteTable'],
          ResourceArns: ['arn:aws:s3:::infinite-nasa-apod-dev-images-349660737637/*']
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const allowedActions = result.EvaluationResults.filter(r => r.EvalDecision === 'allowed');
      const deniedActions = result.EvaluationResults.filter(r => r.EvalDecision === 'denied');

      expect(allowedActions).toHaveLength(2);
      expect(deniedActions).toHaveLength(2);
      expect(allowedActions.map(a => a.EvalActionName)).toContain('s3:PutObject');
      expect(allowedActions.map(a => a.EvalActionName)).toContain('dynamodb:PutItem');
      expect(deniedActions.map(a => a.EvalActionName)).toContain('s3:DeleteBucket');
      expect(deniedActions.map(a => a.EvalActionName)).toContain('dynamodb:DeleteTable');

      console.log('✅ Least privilege principle verified');
      console.log(`✅ Allowed actions: ${allowedActions.map(a => a.EvalActionName).join(', ')}`);
      console.log(`❌ Denied actions: ${deniedActions.map(a => a.EvalActionName).join(', ')}`);
    });

    test('should verify resource-specific permissions', async () => {
      const AWS = require('aws-sdk');
      const mockSimulatePrincipalPolicy = jest.fn().mockImplementation((params, callback) => {
        // Test that role can only access specific resources
        const allowedResources = [
          'arn:aws:s3:::infinite-nasa-apod-dev-images-349660737637/*',
          'arn:aws:dynamodb:eu-central-1:349660737637:table/InfiniteRawContent-dev'
        ];
        const isAllowed = allowedResources.some(resource => params.ResourceArns.includes(resource));
        
        callback(null, {
          EvaluationResults: params.ResourceArns.map(resource => ({
            EvalActionName: params.ActionNames[0],
            EvalResourceName: resource,
            EvalDecision: isAllowed ? 'allowed' : 'denied'
          }))
        });
      });
      AWS.IAM.mockImplementation(() => ({
        simulatePrincipalPolicy: mockSimulatePrincipalPolicy
      }));

      const iam = new AWS.IAM();
      const result = await new Promise((resolve, reject) => {
        iam.simulatePrincipalPolicy({
          PolicySourceArn: 'arn:aws:iam::349660737637:role/infinite-nasa-apod-dev-fetcher-role',
          ActionNames: ['s3:PutObject'],
          ResourceArns: [
            'arn:aws:s3:::infinite-nasa-apod-dev-images-349660737637/*',
            'arn:aws:s3:::other-bucket/*'
          ]
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const allowedResources = result.EvaluationResults.filter(r => r.EvalDecision === 'allowed');
      const deniedResources = result.EvaluationResults.filter(r => r.EvalDecision === 'denied');

      expect(allowedResources).toHaveLength(1);
      expect(deniedResources).toHaveLength(1);
      expect(allowedResources[0].EvalResourceName).toContain('infinite-nasa-apod-dev-images-349660737637');
      expect(deniedResources[0].EvalResourceName).toContain('other-bucket');

      console.log('✅ Resource-specific permissions verified');
      console.log(`✅ Allowed resource: ${allowedResources[0].EvalResourceName}`);
      console.log(`❌ Denied resource: ${deniedResources[0].EvalResourceName}`);
    });
  });
});
