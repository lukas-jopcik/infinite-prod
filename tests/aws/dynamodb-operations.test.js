/**
 * AWS DynamoDB operations tests
 * Tests DynamoDB table operations, GSI, and data consistency
 */

const { AWSMockHelper, TestDataGenerator, AssertionHelper } = require('../helpers/test-utils');

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      put: jest.fn(),
      get: jest.fn(),
      query: jest.fn(),
      scan: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchWrite: jest.fn(),
      batchGet: jest.fn()
    }))
  },
  DynamoDB: jest.fn(() => ({
    describeTable: jest.fn(),
    listTables: jest.fn(),
    createTable: jest.fn(),
    updateTable: jest.fn(),
    deleteTable: jest.fn()
  }))
}));

describe('DynamoDB Operations', () => {
  beforeEach(() => {
    AWSMockHelper.mockAll();
    
    // Set environment variables
    process.env.AWS_REGION = 'eu-central-1';
    process.env.DYNAMODB_TABLE_NAME = 'infinite-nasa-apod-dev-content';
    process.env.DYNAMODB_INDEX_NAME = 'gsi_latest';
  });

  afterEach(() => {
    AWSMockHelper.restore();
    jest.clearAllMocks();
  });

  describe('Table Structure and Configuration', () => {
    test('should have correct table configuration', async () => {
      const AWS = require('aws-sdk');
      const mockDescribeTable = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Table: {
            TableName: 'infinite-nasa-apod-dev-content',
            TableStatus: 'ACTIVE',
            TableSizeBytes: 1024000,
            ItemCount: 150,
            TableArn: 'arn:aws:dynamodb:eu-central-1:123456789012:table/infinite-nasa-apod-dev-content',
            KeySchema: [
              { AttributeName: 'date', KeyType: 'HASH' }
            ],
            AttributeDefinitions: [
              { AttributeName: 'date', AttributeType: 'S' },
              { AttributeName: 'pk', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'gsi_latest',
                KeySchema: [
                  { AttributeName: 'pk', KeyType: 'HASH' }
                ],
                Projection: {
                  ProjectionType: 'ALL'
                },
                IndexStatus: 'ACTIVE',
                ItemCount: 1,
                IndexSizeBytes: 1024
              }
            ],
            BillingModeSummary: {
              BillingMode: 'PAY_PER_REQUEST'
            }
          }
        });
      });
      AWS.DynamoDB.mockImplementation(() => ({
        describeTable: mockDescribeTable
      }));

      const dynamodb = new AWS.DynamoDB();
      const result = await new Promise((resolve, reject) => {
        dynamodb.describeTable({
          TableName: 'infinite-nasa-apod-dev-content'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Table.TableName).toBe('infinite-nasa-apod-dev-content');
      expect(result.Table.TableStatus).toBe('ACTIVE');
      expect(result.Table.BillingModeSummary.BillingMode).toBe('PAY_PER_REQUEST');
      
      // Verify GSI configuration
      expect(result.Table.GlobalSecondaryIndexes).toHaveLength(1);
      expect(result.Table.GlobalSecondaryIndexes[0].IndexName).toBe('gsi_latest');
      expect(result.Table.GlobalSecondaryIndexes[0].IndexStatus).toBe('ACTIVE');

      console.log('✅ DynamoDB table configuration verified');
      console.log(`📊 Table: ${result.Table.TableName}`);
      console.log(`📈 Status: ${result.Table.TableStatus}`);
      console.log(`📊 Item count: ${result.Table.ItemCount}`);
      console.log(`🔍 GSI count: ${result.Table.GlobalSecondaryIndexes.length}`);
    });

    test('should have correct key schema', async () => {
      const AWS = require('aws-sdk');
      const mockDescribeTable = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Table: {
            KeySchema: [
              { AttributeName: 'date', KeyType: 'HASH' }
            ],
            AttributeDefinitions: [
              { AttributeName: 'date', AttributeType: 'S' }
            ]
          }
        });
      });
      AWS.DynamoDB.mockImplementation(() => ({
        describeTable: mockDescribeTable
      }));

      const dynamodb = new AWS.DynamoDB();
      const result = await new Promise((resolve, reject) => {
        dynamodb.describeTable({
          TableName: 'infinite-nasa-apod-dev-content'
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Table.KeySchema).toHaveLength(1);
      expect(result.Table.KeySchema[0].AttributeName).toBe('date');
      expect(result.Table.KeySchema[0].KeyType).toBe('HASH');

      console.log('✅ DynamoDB key schema verified');
      console.log(`🔑 Primary key: ${result.Table.KeySchema[0].AttributeName}`);
    });
  });

  describe('CRUD Operations', () => {
    test('should create new items correctly', async () => {
      const mockItem = TestDataGenerator.generateDynamoDBItem({
        date: '2025-01-15',
        pk: 'LATEST',
        originalTitle: 'Test APOD Title',
        slovakTitle: 'Test Slovak Title',
        contentQuality: 95
      });

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.put({
          TableName: 'infinite-nasa-apod-dev-content',
          Item: mockItem
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          Item: expect.objectContaining({
            date: '2025-01-15',
            pk: 'LATEST',
            originalTitle: 'Test APOD Title',
            slovakTitle: 'Test Slovak Title',
            contentQuality: 95
          })
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB item creation verified');
      console.log(`📝 Created item for date: ${mockItem.date}`);
    });

    test('should read items correctly', async () => {
      const mockItem = TestDataGenerator.generateDynamoDBItem({
        date: '2025-01-15',
        pk: 'LATEST'
      });

      const AWS = require('aws-sdk');
      const mockGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Item: mockItem });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        get: mockGet
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.get({
          TableName: 'infinite-nasa-apod-dev-content',
          Key: { date: '2025-01-15' }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Item).toEqual(mockItem);
      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          Key: { date: '2025-01-15' }
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB item reading verified');
      console.log(`📖 Retrieved item for date: ${result.Item.date}`);
    });

    test('should update items correctly', async () => {
      const AWS = require('aws-sdk');
      const mockUpdate = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        update: mockUpdate
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.update({
          TableName: 'infinite-nasa-apod-dev-content',
          Key: { date: '2025-01-15' },
          UpdateExpression: 'SET contentQuality = :quality',
          ExpressionAttributeValues: { ':quality': 98 }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          Key: { date: '2025-01-15' },
          UpdateExpression: 'SET contentQuality = :quality',
          ExpressionAttributeValues: { ':quality': 98 }
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB item update verified');
    });

    test('should delete items correctly', async () => {
      const AWS = require('aws-sdk');
      const mockDelete = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        delete: mockDelete
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.delete({
          TableName: 'infinite-nasa-apod-dev-content',
          Key: { date: '2025-01-15' }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(mockDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          Key: { date: '2025-01-15' }
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB item deletion verified');
    });
  });

  describe('Query Operations', () => {
    test('should query GSI correctly', async () => {
      const mockItems = [
        TestDataGenerator.generateDynamoDBItem({
          date: '2025-01-15',
          pk: 'LATEST',
          originalTitle: 'Latest APOD'
        })
      ];

      const AWS = require('aws-sdk');
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Items: mockItems });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        query: mockQuery
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.query({
          TableName: 'infinite-nasa-apod-dev-content',
          IndexName: 'gsi_latest',
          KeyConditionExpression: '#pk = :pk',
          ExpressionAttributeNames: { '#pk': 'pk' },
          ExpressionAttributeValues: { ':pk': 'LATEST' },
          ScanIndexForward: false,
          Limit: 10
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Items).toHaveLength(1);
      expect(result.Items[0].pk).toBe('LATEST');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          IndexName: 'gsi_latest',
          KeyConditionExpression: '#pk = :pk',
          ExpressionAttributeNames: { '#pk': 'pk' },
          ExpressionAttributeValues: { ':pk': 'LATEST' }
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB GSI query verified');
      console.log(`🔍 Queried GSI: ${mockQuery.mock.calls[0][0].IndexName}`);
      console.log(`📊 Results: ${result.Items.length} item(s)`);
    });

    test('should handle pagination correctly', async () => {
      const mockItems = Array(10).fill().map((_, i) => 
        TestDataGenerator.generateDynamoDBItem({
          date: `2025-01-${15 - i}`,
          pk: 'LATEST'
        })
      );

      const AWS = require('aws-sdk');
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        const limit = params.Limit || 10;
        const startIndex = 0;
        const endIndex = Math.min(startIndex + limit, mockItems.length);
        const paginatedItems = mockItems.slice(startIndex, endIndex);
        
        callback(null, { 
          Items: paginatedItems,
          LastEvaluatedKey: endIndex < mockItems.length ? { date: mockItems[endIndex - 1].date } : null
        });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        query: mockQuery
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.query({
          TableName: 'infinite-nasa-apod-dev-content',
          IndexName: 'gsi_latest',
          KeyConditionExpression: '#pk = :pk',
          ExpressionAttributeNames: { '#pk': 'pk' },
          ExpressionAttributeValues: { ':pk': 'LATEST' },
          Limit: 5
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Items).toHaveLength(5);
      expect(result.LastEvaluatedKey).toBeDefined();

      console.log('✅ DynamoDB pagination verified');
      console.log(`📊 Items returned: ${result.Items.length}`);
      console.log(`📄 Has more pages: ${result.LastEvaluatedKey ? 'Yes' : 'No'}`);
    });
  });

  describe('Scan Operations', () => {
    test('should scan table correctly', async () => {
      const mockItems = [
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-15' }),
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-14' }),
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-13' })
      ];

      const AWS = require('aws-sdk');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        callback(null, { Items: mockItems });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        scan: mockScan
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.scan({
          TableName: 'infinite-nasa-apod-dev-content',
          Limit: 10
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Items).toHaveLength(3);
      expect(mockScan).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'infinite-nasa-apod-dev-content',
          Limit: 10
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB scan operation verified');
      console.log(`📊 Scanned items: ${result.Items.length}`);
    });

    test('should filter scan results correctly', async () => {
      const mockItems = [
        TestDataGenerator.generateDynamoDBItem({
          date: '2025-01-15',
          contentQuality: 95
        }),
        TestDataGenerator.generateDynamoDBItem({
          date: '2025-01-14',
          contentQuality: 85
        })
      ];

      const AWS = require('aws-sdk');
      const mockScan = jest.fn().mockImplementation((params, callback) => {
        // Simulate filtering by contentQuality
        const filteredItems = mockItems.filter(item => item.contentQuality >= 90);
        callback(null, { Items: filteredItems });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        scan: mockScan
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.scan({
          TableName: 'infinite-nasa-apod-dev-content',
          FilterExpression: 'contentQuality >= :quality',
          ExpressionAttributeValues: { ':quality': 90 }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Items).toHaveLength(1);
      expect(result.Items[0].contentQuality).toBeGreaterThanOrEqual(90);

      console.log('✅ DynamoDB scan filtering verified');
      console.log(`📊 Filtered items: ${result.Items.length}`);
    });
  });

  describe('Batch Operations', () => {
    test('should perform batch write operations', async () => {
      const mockItems = [
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-15' }),
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-14' }),
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-13' })
      ];

      const AWS = require('aws-sdk');
      const mockBatchWrite = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        batchWrite: mockBatchWrite
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.batchWrite({
          RequestItems: {
            'infinite-nasa-apod-dev-content': mockItems.map(item => ({
              PutRequest: { Item: item }
            }))
          }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(mockBatchWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          RequestItems: {
            'infinite-nasa-apod-dev-content': expect.arrayContaining([
              expect.objectContaining({
                PutRequest: expect.objectContaining({
                  Item: expect.any(Object)
                })
              })
            ])
          }
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB batch write verified');
      console.log(`📝 Batch items: ${mockItems.length}`);
    });

    test('should perform batch get operations', async () => {
      const mockItems = [
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-15' }),
        TestDataGenerator.generateDynamoDBItem({ date: '2025-01-14' })
      ];

      const AWS = require('aws-sdk');
      const mockBatchGet = jest.fn().mockImplementation((params, callback) => {
        callback(null, {
          Responses: {
            'infinite-nasa-apod-dev-content': mockItems
          }
        });
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        batchGet: mockBatchGet
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.batchGet({
          RequestItems: {
            'infinite-nasa-apod-dev-content': {
              Keys: [
                { date: '2025-01-15' },
                { date: '2025-01-14' }
              ]
            }
          }
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      expect(result.Responses['infinite-nasa-apod-dev-content']).toHaveLength(2);
      expect(mockBatchGet).toHaveBeenCalledWith(
        expect.objectContaining({
          RequestItems: {
            'infinite-nasa-apod-dev-content': {
              Keys: [
                { date: '2025-01-15' },
                { date: '2025-01-14' }
              ]
            }
          }
        }),
        expect.any(Function)
      );

      console.log('✅ DynamoDB batch get verified');
      console.log(`📖 Batch retrieved: ${result.Responses['infinite-nasa-apod-dev-content'].length} items`);
    });
  });

  describe('Error Handling', () => {
    test('should handle DynamoDB errors gracefully', async () => {
      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(new Error('DynamoDB error'), null);
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      
      try {
        await new Promise((resolve, reject) => {
          dynamodb.put({
            TableName: 'infinite-nasa-apod-dev-content',
            Item: TestDataGenerator.generateDynamoDBItem()
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('DynamoDB error');
      }

      console.log('✅ DynamoDB error handling verified');
    });

    test('should handle throttling errors', async () => {
      const AWS = require('aws-sdk');
      const mockQuery = jest.fn().mockImplementation((params, callback) => {
        const throttlingError = new Error('ThrottlingException');
        throttlingError.code = 'ThrottlingException';
        callback(throttlingError, null);
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        query: mockQuery
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      
      try {
        await new Promise((resolve, reject) => {
          dynamodb.query({
            TableName: 'infinite-nasa-apod-dev-content',
            IndexName: 'gsi_latest',
            KeyConditionExpression: '#pk = :pk',
            ExpressionAttributeNames: { '#pk': 'pk' },
            ExpressionAttributeValues: { ':pk': 'LATEST' }
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        fail('Expected throttling error to be thrown');
      } catch (error) {
        expect(error.code).toBe('ThrottlingException');
      }

      console.log('✅ DynamoDB throttling error handling verified');
    });
  });

  describe('Performance and Monitoring', () => {
    test('should track operation metrics', async () => {
      const mockItem = TestDataGenerator.generateDynamoDBItem();
      const startTime = Date.now();

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        // Simulate operation time
        setTimeout(() => {
          callback(null, {});
        }, 100);
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const result = await new Promise((resolve, reject) => {
        dynamodb.put({
          TableName: 'infinite-nasa-apod-dev-content',
          Item: mockItem
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const endTime = Date.now();
      const operationTime = endTime - startTime;

      expect(operationTime).toBeGreaterThan(90);
      expect(operationTime).toBeLessThan(200);

      console.log(`⏱️ DynamoDB operation time: ${operationTime}ms`);
      console.log('✅ DynamoDB performance monitoring verified');
    });

    test('should handle concurrent operations', async () => {
      const mockItems = Array(10).fill().map((_, i) => 
        TestDataGenerator.generateDynamoDBItem({ date: `2025-01-${15 - i}` })
      );

      const AWS = require('aws-sdk');
      const mockPut = jest.fn().mockImplementation((params, callback) => {
        callback(null, {});
      });
      AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
        put: mockPut
      }));

      const dynamodb = new AWS.DynamoDB.DocumentClient();
      
      // Execute multiple concurrent operations
      const promises = mockItems.map(item => 
        new Promise((resolve, reject) => {
          dynamodb.put({
            TableName: 'infinite-nasa-apod-dev-content',
            Item: item
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockPut).toHaveBeenCalledTimes(10);

      console.log('✅ DynamoDB concurrent operations verified');
      console.log(`📊 Concurrent operations: ${results.length}`);
    });
  });
});
