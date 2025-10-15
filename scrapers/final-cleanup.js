const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

async function cleanup() {
    console.log('🗑️  Final cleanup...\n');
    
    // Get all articles
    const scan = await dynamodb.send(new ScanCommand({
        TableName: 'InfiniteArticles-dev'
    }));
    
    // Keep only first 5 (oldest), delete the rest
    const toDelete = scan.Items.slice(5);
    
    console.log(`Found ${scan.Items.length} articles, keeping 5, deleting ${toDelete.length}...\n`);
    
    for (let i = 0; i < toDelete.length; i += 25) {
        const batch = toDelete.slice(i, i + 25);
        
        await dynamodb.send(new BatchWriteCommand({
            RequestItems: {
                'InfiniteArticles-dev': batch.map(item => ({
                    DeleteRequest: {
                        Key: {
                            articleId: item.articleId,
                            type: item.type
                        }
                    }
                }))
            }
        }));
        
        console.log(`✅ Deleted batch ${Math.floor(i / 25) + 1}`);
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`\n✅ Done! Kept 5 articles, deleted ${toDelete.length}`);
}

cleanup();
