const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

async function deleteAll() {
    console.log('🗑️  DELETING ALL RAW CONTENT...\n');
    
    let deletedCount = 0;
    let lastEvaluatedKey = null;
    
    do {
        const scanParams = {
            TableName: 'InfiniteRawContent-dev',
            ProjectionExpression: 'contentId, #src',
            ExpressionAttributeNames: { '#src': 'source' }
        };
        
        if (lastEvaluatedKey) {
            scanParams.ExclusiveStartKey = lastEvaluatedKey;
        }
        
        const scan = await dynamodb.send(new ScanCommand(scanParams));
        
        if (scan.Items && scan.Items.length > 0) {
            for (let i = 0; i < scan.Items.length; i += 25) {
                const batch = scan.Items.slice(i, i + 25);
                
                await dynamodb.send(new BatchWriteCommand({
                    RequestItems: {
                        'InfiniteRawContent-dev': batch.map(item => ({
                            DeleteRequest: {
                                Key: {
                                    contentId: item.contentId,
                                    source: item.source
                                }
                            }
                        }))
                    }
                }));
                
                deletedCount += batch.length;
                console.log(`✅ Deleted ${deletedCount} articles...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        
        lastEvaluatedKey = scan.LastEvaluatedKey;
        
    } while (lastEvaluatedKey);
    
    console.log(`\n✅ COMPLETE! Deleted ${deletedCount} total articles`);
}

deleteAll();
