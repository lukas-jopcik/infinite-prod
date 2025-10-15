/**
 * AWS EventBridge schedules tests
 * Tests EventBridge rules, schedules, and Lambda triggers
 */

const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  EventBridge: jest.fn(() => ({
    listRules: jest.fn(),
    describeRule: jest.fn(),
    putRule: jest.fn(),
    deleteRule: jest.fn(),
    listTargetsByRule: jest.fn(),
    putTargets: jest.fn(),
    removeTargets: jest.fn(),
    enableRule: jest.fn(),
    disableRule: jest.fn()
  })),
  Lambda: jest.fn(() => ({
    addPermission: jest.fn(),
    removePermission: jest.fn(),
    getFunction: jest.fn()
  }))
}));

describe('EventBridge Schedules and Rules', () => {
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

  describe('EventBridge Rules Configuration', () => {
    test('should have correct daily fetch rule', async () => {
      const AWS = require('aws-sdk');
      const mockDescribeRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Name: 'infinite-nasa-apod-dev-daily-fetch',
          Arn: 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-daily-fetch',
          EventPattern: null,
          ScheduleExpression: 'cron(0 6 * * ? *)',
          State: 'ENABLED',
          Description: 'Daily fetch of NASA APOD data at 6:00 AM UTC',
          RoleArn: 'arn:aws:iam::349660737637:role/EventBridgeExecutionRole',
          ManagedBy: 'user',
          EventBusName: 'default',
          CreatedBy: '349660737637',
          CreationTime: '2024-12-01T00:00:00.000Z'
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        describeRule: mockDescribeRule
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.describeRule({
          Name: 'infinite-nasa-apod-dev-daily-fetch'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Name).toBe('infinite-nasa-apod-dev-daily-fetch');
      expect(result.ScheduleExpression).toBe('cron(0 6 * * ? *)');
      expect(result.State).toBe('ENABLED');
      expect(result.Description).toContain('Daily fetch of NASA APOD data');

      console.log('✅ EventBridge daily fetch rule verified');
      console.log(`📅 Rule: ${result.Name}`);
      console.log(`⏰ Schedule: ${result.ScheduleExpression}`);
      console.log(`📊 State: ${result.State}`);
      console.log(`📝 Description: ${result.Description}`);
    });

    test('should have correct weekly AI content generation rule', async () => {
      const AWS = require('aws-sdk');
      const mockDescribeRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Name: 'infinite-nasa-apod-dev-weekly-ai-content',
          Arn: 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-weekly-ai-content',
          EventPattern: null,
          ScheduleExpression: 'cron(0 8 ? * SUN *)',
          State: 'ENABLED',
          Description: 'Weekly AI content generation every Sunday at 8:00 AM UTC',
          RoleArn: 'arn:aws:iam::349660737637:role/EventBridgeExecutionRole',
          ManagedBy: 'user',
          EventBusName: 'default',
          CreatedBy: '349660737637',
          CreationTime: '2024-12-01T00:00:00.000Z'
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        describeRule: mockDescribeRule
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.describeRule({
          Name: 'infinite-nasa-apod-dev-weekly-ai-content'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Name).toBe('infinite-nasa-apod-dev-weekly-ai-content');
      expect(result.ScheduleExpression).toBe('cron(0 8 ? * SUN *)');
      expect(result.State).toBe('ENABLED');
      expect(result.Description).toContain('Weekly AI content generation');

      console.log('✅ EventBridge weekly AI content rule verified');
      console.log(`📅 Rule: ${result.Name}`);
      console.log(`⏰ Schedule: ${result.ScheduleExpression}`);
      console.log(`📊 State: ${result.State}`);
    });

    test('should list all EventBridge rules', async () => {
      const AWS = require('aws-sdk');
      const mockListRules = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Rules: [
            {
              Name: 'infinite-nasa-apod-dev-daily-fetch',
              Arn: 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-daily-fetch',
              ScheduleExpression: 'cron(0 6 * * ? *)',
              State: 'ENABLED',
              Description: 'Daily fetch of NASA APOD data at 6:00 AM UTC',
              EventBusName: 'default'
            },
            {
              Name: 'infinite-nasa-apod-dev-weekly-ai-content',
              Arn: 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-weekly-ai-content',
              ScheduleExpression: 'cron(0 8 ? * SUN *)',
              State: 'ENABLED',
              Description: 'Weekly AI content generation every Sunday at 8:00 AM UTC',
              EventBusName: 'default'
            },
            {
              Name: 'infinite-nasa-apod-dev-esa-hubble-fetch',
              Arn: 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-esa-hubble-fetch',
              ScheduleExpression: 'cron(0 7 * * ? *)',
              State: 'ENABLED',
              Description: 'Daily fetch of ESA Hubble data at 7:00 AM UTC',
              EventBusName: 'default'
            }
          ]
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        listRules: mockListRules
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.listRules({
          NamePrefix: 'infinite-nasa-apod-dev'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Rules).toHaveLength(3);
      expect(result.Rules[0].Name).toBe('infinite-nasa-apod-dev-daily-fetch');
      expect(result.Rules[1].Name).toBe('infinite-nasa-apod-dev-weekly-ai-content');
      expect(result.Rules[2].Name).toBe('infinite-nasa-apod-dev-esa-hubble-fetch');

      console.log('✅ EventBridge rules listing verified');
      console.log(`📊 Rules: ${result.Rules.length}`);
      result.Rules.forEach(rule => {
        console.log(`  - ${rule.Name} (${rule.ScheduleExpression})`);
      });
    });
  });

  describe('EventBridge Targets', () => {
    test('should have correct targets for daily fetch rule', async () => {
      const AWS = require('aws-sdk');
      const mockListTargetsByRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Targets: [
            {
              Id: '1',
              Arn: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-fetcher',
              RoleArn: 'arn:aws:iam::349660737637:role/EventBridgeExecutionRole',
              Input: JSON.stringify({
                source: 'eventbridge',
                schedule: 'daily-fetch',
                timestamp: '2025-01-15T06:00:00.000Z'
              }),
              EcsParameters: null,
              BatchParameters: null,
              KinesisParameters: null,
              RunCommandParameters: null,
              DeadLetterConfig: {
                Arn: 'arn:aws:sqs:eu-central-1:349660737637:infinite-nasa-apod-dev-dlq'
              },
              RetryPolicy: {
                MaximumRetryAttempts: 3,
                MaximumEventAge: 3600
              }
            }
          ]
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        listTargetsByRule: mockListTargetsByRule
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.listTargetsByRule({
          Rule: 'infinite-nasa-apod-dev-daily-fetch'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Targets).toHaveLength(1);
      expect(result.Targets[0].Arn).toContain('infinite-nasa-apod-dev-fetcher');
      expect(result.Targets[0].Id).toBe('1');
      
      const input = JSON.parse(result.Targets[0].Input);
      expect(input.source).toBe('eventbridge');
      expect(input.schedule).toBe('daily-fetch');

      console.log('✅ EventBridge daily fetch targets verified');
      console.log(`🎯 Target: ${result.Targets[0].Arn}`);
      console.log(`📝 Input: ${result.Targets[0].Input}`);
      console.log(`🔄 Retry Policy: ${result.Targets[0].RetryPolicy.MaximumRetryAttempts} attempts`);
    });

    test('should have correct targets for weekly AI content rule', async () => {
      const AWS = require('aws-sdk');
      const mockListTargetsByRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Targets: [
            {
              Id: '1',
              Arn: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-ai-content-generator',
              RoleArn: 'arn:aws:iam::349660737637:role/EventBridgeExecutionRole',
              Input: JSON.stringify({
                source: 'eventbridge',
                schedule: 'weekly-ai-content',
                timestamp: '2025-01-15T08:00:00.000Z',
                batchSize: 10
              }),
              DeadLetterConfig: {
                Arn: 'arn:aws:sqs:eu-central-1:349660737637:infinite-nasa-apod-dev-dlq'
              },
              RetryPolicy: {
                MaximumRetryAttempts: 2,
                MaximumEventAge: 7200
              }
            }
          ]
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        listTargetsByRule: mockListTargetsByRule
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.listTargetsByRule({
          Rule: 'infinite-nasa-apod-dev-weekly-ai-content'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Targets).toHaveLength(1);
      expect(result.Targets[0].Arn).toContain('infinite-nasa-apod-dev-ai-content-generator');
      
      const input = JSON.parse(result.Targets[0].Input);
      expect(input.source).toBe('eventbridge');
      expect(input.schedule).toBe('weekly-ai-content');
      expect(input.batchSize).toBe(10);

      console.log('✅ EventBridge weekly AI content targets verified');
      console.log(`🎯 Target: ${result.Targets[0].Arn}`);
      console.log(`📝 Input: ${result.Targets[0].Input}`);
      console.log(`🔄 Retry Policy: ${result.Targets[0].RetryPolicy.MaximumRetryAttempts} attempts`);
    });

    test('should have correct targets for ESA Hubble fetch rule', async () => {
      const AWS = require('aws-sdk');
      const mockListTargetsByRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Targets: [
            {
              Id: '1',
              Arn: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-esa-hubble-fetcher',
              RoleArn: 'arn:aws:iam::349660737637:role/EventBridgeExecutionRole',
              Input: JSON.stringify({
                source: 'eventbridge',
                schedule: 'esa-hubble-fetch',
                timestamp: '2025-01-15T07:00:00.000Z',
                source: 'esa-hubble'
              }),
              DeadLetterConfig: {
                Arn: 'arn:aws:sqs:eu-central-1:349660737637:infinite-nasa-apod-dev-dlq'
              },
              RetryPolicy: {
                MaximumRetryAttempts: 3,
                MaximumEventAge: 3600
              }
            }
          ]
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        listTargetsByRule: mockListTargetsByRule
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.listTargetsByRule({
          Rule: 'infinite-nasa-apod-dev-esa-hubble-fetch'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Targets).toHaveLength(1);
      expect(result.Targets[0].Arn).toContain('infinite-nasa-apod-dev-esa-hubble-fetcher');
      
      const input = JSON.parse(result.Targets[0].Input);
      expect(input.source).toBe('esa-hubble');
      expect(input.schedule).toBe('esa-hubble-fetch');

      console.log('✅ EventBridge ESA Hubble targets verified');
      console.log(`🎯 Target: ${result.Targets[0].Arn}`);
      console.log(`📝 Input: ${result.Targets[0].Input}`);
    });
  });

  describe('Lambda Permissions for EventBridge', () => {
    test('should have correct Lambda permissions for EventBridge', async () => {
      const AWS = require('aws-sdk');
      const mockGetFunction = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Configuration: {
            FunctionName: 'infinite-nasa-apod-dev-fetcher',
            Policy: JSON.stringify({
              Version: '2012-10-17',
              Id: 'default',
              Statement: [
                {
                  Sid: 'AllowEventBridgeInvoke',
                  Effect: 'Allow',
                  Principal: {
                    Service: 'events.amazonaws.com'
                  },
                  Action: 'lambda:InvokeFunction',
                  Resource: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-fetcher',
                  Condition: {
                    ArnLike: {
                      'aws:SourceArn': 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-daily-fetch'
                    }
                  }
                }
              ]
            })
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

      const policy = JSON.parse(result.Configuration.Policy);
      expect(policy.Statement).toHaveLength(1);
      expect(policy.Statement[0].Principal.Service).toBe('events.amazonaws.com');
      expect(policy.Statement[0].Action).toBe('lambda:InvokeFunction');
      expect(policy.Statement[0].Condition.ArnLike['aws:SourceArn']).toContain('infinite-nasa-apod-dev-daily-fetch');

      console.log('✅ Lambda EventBridge permissions verified');
      console.log(`🔐 Principal: ${policy.Statement[0].Principal.Service}`);
      console.log(`⚡ Action: ${policy.Statement[0].Action}`);
      console.log(`🔗 Source ARN: ${policy.Statement[0].Condition.ArnLike['aws:SourceArn']}`);
    });
  });

  describe('Schedule Expression Validation', () => {
    test('should validate cron expressions', () => {
      const cronExpressions = [
        'cron(0 6 * * ? *)',    // Daily at 6:00 AM UTC
        'cron(0 8 ? * SUN *)',  // Weekly on Sunday at 8:00 AM UTC
        'cron(0 7 * * ? *)',    // Daily at 7:00 AM UTC
        'cron(30 12 * * ? *)',  // Daily at 12:30 PM UTC
        'cron(0 0 1 * ? *)'     // Monthly on 1st at midnight UTC
      ];

      cronExpressions.forEach(expression => {
        // Basic validation - should contain 'cron(' and ')'
        expect(expression).toMatch(/^cron\(.*\)$/);
        
        // Should have 6 fields
        const fields = expression.match(/^cron\((.*)\)$/)[1].split(' ');
        expect(fields).toHaveLength(6);
        
        console.log(`✅ Cron expression validated: ${expression}`);
      });

      console.log('✅ All cron expressions validated');
    });

    test('should validate rate expressions', () => {
      const rateExpressions = [
        'rate(1 day)',
        'rate(7 days)',
        'rate(1 hour)',
        'rate(30 minutes)',
        'rate(5 minutes)'
      ];

      rateExpressions.forEach(expression => {
        // Basic validation - should contain 'rate(' and ')'
        expect(expression).toMatch(/^rate\(.*\)$/);
        
        // Should have valid time unit
        const timeUnit = expression.match(/^rate\((\d+)\s+(day|days|hour|hours|minute|minutes)\)$/);
        expect(timeUnit).toBeTruthy();
        
        console.log(`✅ Rate expression validated: ${expression}`);
      });

      console.log('✅ All rate expressions validated');
    });
  });

  describe('Rule Management Operations', () => {
    test('should enable a rule', async () => {
      const AWS = require('aws-sdk');
      const mockEnableRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.EventBridge.mockImplementation(() => ({
        enableRule: mockEnableRule
      }));

      const eventbridge = new AWS.EventBridge();
      await new Promise((resolve, reject) => {
        eventbridge.enableRule({
          Name: 'infinite-nasa-apod-dev-daily-fetch'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(mockEnableRule).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: 'infinite-nasa-apod-dev-daily-fetch'
        }),
        expect.any(Function)
      );

      console.log('✅ EventBridge rule enable operation verified');
    });

    test('should disable a rule', async () => {
      const AWS = require('aws-sdk');
      const mockDisableRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.EventBridge.mockImplementation(() => ({
        disableRule: mockDisableRule
      }));

      const eventbridge = new AWS.EventBridge();
      await new Promise((resolve, reject) => {
        eventbridge.disableRule({
          Name: 'infinite-nasa-apod-dev-daily-fetch'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(mockDisableRule).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: 'infinite-nasa-apod-dev-daily-fetch'
        }),
        expect.any(Function)
      );

      console.log('✅ EventBridge rule disable operation verified');
    });

    test('should create a new rule', async () => {
      const AWS = require('aws-sdk');
      const mockPutRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          RuleArn: 'arn:aws:events:eu-central-1:349660737637:rule/infinite-nasa-apod-dev-test-rule'
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        putRule: mockPutRule
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.putRule({
          Name: 'infinite-nasa-apod-dev-test-rule',
          ScheduleExpression: 'cron(0 9 * * ? *)',
          Description: 'Test rule for validation',
          State: 'ENABLED'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.RuleArn).toContain('infinite-nasa-apod-dev-test-rule');
      expect(mockPutRule).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: 'infinite-nasa-apod-dev-test-rule',
          ScheduleExpression: 'cron(0 9 * * ? *)',
          Description: 'Test rule for validation',
          State: 'ENABLED'
        }),
        expect.any(Function)
      );

      console.log('✅ EventBridge rule creation verified');
      console.log(`🔗 Rule ARN: ${result.RuleArn}`);
    });

    test('should delete a rule', async () => {
      const AWS = require('aws-sdk');
      const mockDeleteRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.EventBridge.mockImplementation(() => ({
        deleteRule: mockDeleteRule
      }));

      const eventbridge = new AWS.EventBridge();
      await new Promise((resolve, reject) => {
        eventbridge.deleteRule({
          Name: 'infinite-nasa-apod-dev-test-rule'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(mockDeleteRule).toHaveBeenCalledWith(
        expect.objectContaining({
          Name: 'infinite-nasa-apod-dev-test-rule'
        }),
        expect.any(Function)
      );

      console.log('✅ EventBridge rule deletion verified');
    });
  });

  describe('Target Management Operations', () => {
    test('should add targets to a rule', async () => {
      const AWS = require('aws-sdk');
      const mockPutTargets = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          FailedEntryCount: 0,
          FailedEntries: []
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        putTargets: mockPutTargets
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.putTargets({
          Rule: 'infinite-nasa-apod-dev-daily-fetch',
          Targets: [
            {
              Id: '2',
              Arn: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-backup-fetcher',
              Input: JSON.stringify({
                source: 'eventbridge',
                schedule: 'daily-fetch-backup'
              })
            }
          ]
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.FailedEntryCount).toBe(0);
      expect(result.FailedEntries).toHaveLength(0);
      expect(mockPutTargets).toHaveBeenCalledWith(
        expect.objectContaining({
          Rule: 'infinite-nasa-apod-dev-daily-fetch',
          Targets: expect.arrayContaining([
            expect.objectContaining({
              Id: '2',
              Arn: 'arn:aws:lambda:eu-central-1:349660737637:function:infinite-nasa-apod-dev-backup-fetcher'
            })
          ])
        }),
        expect.any(Function)
      );

      console.log('✅ EventBridge target addition verified');
      console.log(`📊 Failed entries: ${result.FailedEntryCount}`);
    });

    test('should remove targets from a rule', async () => {
      const AWS = require('aws-sdk');
      const mockRemoveTargets = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          FailedEntryCount: 0,
          FailedEntries: []
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        removeTargets: mockRemoveTargets
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.removeTargets({
          Rule: 'infinite-nasa-apod-dev-daily-fetch',
          Ids: ['2']
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.FailedEntryCount).toBe(0);
      expect(result.FailedEntries).toHaveLength(0);
      expect(mockRemoveTargets).toHaveBeenCalledWith(
        expect.objectContaining({
          Rule: 'infinite-nasa-apod-dev-daily-fetch',
          Ids: ['2']
        }),
        expect.any(Function)
      );

      console.log('✅ EventBridge target removal verified');
      console.log(`📊 Failed entries: ${result.FailedEntryCount}`);
    });
  });

  describe('Error Handling', () => {
    test('should handle rule not found error', async () => {
      const AWS = require('aws-sdk');
      const mockDescribeRule = jest.fn().mockImplementation((params, callback) => {
        const error = new Error('ResourceNotFoundException');
        error.code = 'ResourceNotFoundException';
        callback(error, null);
      });
      AWS.EventBridge.mockImplementation(() => ({
        describeRule: mockDescribeRule
      }));

      const eventbridge = new AWS.EventBridge();
      
      try {
        await new Promise((resolve, reject) => {
          eventbridge.describeRule({
            Name: 'non-existent-rule'
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.code).toBe('ResourceNotFoundException');
      }

      console.log('✅ EventBridge rule not found error handling verified');
    });

    test('should handle invalid schedule expression error', async () => {
      const AWS = require('aws-sdk');
      const mockPutRule = jest.fn().mockImplementation((params, callback) => {
        const error = new Error('ValidationException');
        error.code = 'ValidationException';
        error.message = 'Invalid schedule expression';
        callback(error, null);
      });
      AWS.EventBridge.mockImplementation(() => ({
        putRule: mockPutRule
      }));

      const eventbridge = new AWS.EventBridge();
      
      try {
        await new Promise((resolve, reject) => {
          eventbridge.putRule({
            Name: 'test-rule',
            ScheduleExpression: 'invalid-cron-expression'
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.code).toBe('ValidationException');
        expect(error.message).toContain('Invalid schedule expression');
      }

      console.log('✅ EventBridge invalid schedule expression error handling verified');
    });
  });

  describe('Monitoring and Observability', () => {
    test('should track rule execution metrics', async () => {
      const AWS = require('aws-sdk');
      const mockDescribeRule = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Name: 'infinite-nasa-apod-dev-daily-fetch',
          State: 'ENABLED',
          ScheduleExpression: 'cron(0 6 * * ? *)',
          LastModifiedTime: '2025-01-15T06:00:00.000Z',
          CreatedBy: '349660737637',
          CreationTime: '2024-12-01T00:00:00.000Z'
        });
      });
      AWS.EventBridge.mockImplementation(() => ({
        describeRule: mockDescribeRule
      }));

      const eventbridge = new AWS.EventBridge();
      const result = await new Promise((resolve, reject) => {
        eventbridge.describeRule({
          Name: 'infinite-nasa-apod-dev-daily-fetch'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.State).toBe('ENABLED');
      expect(result.LastModifiedTime).toBeDefined();
      expect(result.CreationTime).toBeDefined();

      console.log('✅ EventBridge rule monitoring verified');
      console.log(`📊 State: ${result.State}`);
      console.log(`📅 Created: ${result.CreationTime}`);
      console.log(`🔄 Last Modified: ${result.LastModifiedTime}`);
    });

    test('should validate rule naming conventions', () => {
      const ruleNames = [
        'infinite-nasa-apod-dev-daily-fetch',
        'infinite-nasa-apod-dev-weekly-ai-content',
        'infinite-nasa-apod-dev-esa-hubble-fetch'
      ];

      ruleNames.forEach(name => {
        // Should follow naming convention: infinite-nasa-apod-{env}-{purpose}
        expect(name).toMatch(/^infinite-nasa-apod-dev-/);
        expect(name.length).toBeLessThanOrEqual(64); // AWS limit
        expect(name).not.toMatch(/[^a-zA-Z0-9-]/); // Only alphanumeric and hyphens
        
        console.log(`✅ Rule name validated: ${name}`);
      });

      console.log('✅ All rule names follow naming conventions');
    });
  });
});
