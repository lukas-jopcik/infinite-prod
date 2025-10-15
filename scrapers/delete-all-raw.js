#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = 'eu-central-1';
const RAW_CONTENT_TABLE = 'InfiniteRawContent-dev';
const BATCH_SIZE = 25;

const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

async function deleteAllRawContent() {
    try {
        console.log('🗑️  Deleting all RAW content from DynamoDB...\n');
        
        let deletedCount = 0;
        let lastEvaluatedKey = null;
        
        do {
            const scanParams = {
                TableName: RAW_CONTENT_TABLE,
                ProjectionExpression: 'contentId, #src',
                ExpressionAttributeNames: {
                    '#src': 'source'
                }
            };
            
            if (lastEvaluatedKey) {
                scanParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const scanResult = await dynamodb.send(new ScanCommand(scanParams));
            
            if (scanResult.Items && scanResult.Items.length > 0) {
                for (let i = 0; i < scanResult.Items.length; i += BATCH_SIZE) {
                    const batch = scanResult.Items.slice(i, i + BATCH_SIZE);
                    
                    const deleteParams = {
                        RequestItems: {
                            [RAW_CONTENT_TABLE]: batch.map(item => ({
                                DeleteRequest: {
                                    Key: {
                                        contentId: item.contentId,
                                        source: item.source
                                    }
                                }
                            }))
                        }
                    };
                    
                    await dynamodb.send(new BatchWriteCommand(deleteParams));
                    deletedCount += batch.length;
                    
                    console.log(`✅ Deleted ${deletedCount} articles...`);
                    
                    // 3 second delay to avoid throttling
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
            
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
            
        } while (lastEvaluatedKey);
        
        console.log(`\n✅ Successfully deleted ${deletedCount} articles from ${RAW_CONTENT_TABLE}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

deleteAllRawContent();
