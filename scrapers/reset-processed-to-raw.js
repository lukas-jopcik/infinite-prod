const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

async function reset() {
    console.log('🔄 Resetting processed articles to raw...\n');
    
    // Get all processed articles
    const scan = await dynamodb.send(new ScanCommand({
        TableName: 'InfiniteRawContent-dev',
        FilterExpression: '#s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': 'processed' }
    }));
    
    console.log(`Found ${scan.Items.length} processed articles\n`);
    
    for (const item of scan.Items) {
        await dynamodb.send(new UpdateCommand({
            TableName: 'InfiniteRawContent-dev',
            Key: {
                contentId: item.contentId,
                source: item.source
            },
            UpdateExpression: 'SET #status = :status REMOVE processedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': 'raw' }
        }));
        
        console.log(`✅ Reset: ${item.date} - ${item.title}`);
        await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`\n✅ Reset complete! ${scan.Items.length} articles back to raw`);
}

reset();
