const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

async function deleteDuplicates() {
    try {
        console.log('🔍 Hľadám duplikáty...');
        
        // Scan all articles
        const result = await dynamodb.send(new ScanCommand({
            TableName: 'InfiniteArticles-dev'
        }));
        
        // Group by rawContentId
        const grouped = {};
        result.Items.forEach(item => {
            const rawId = item.rawContentId;
            if (!grouped[rawId]) grouped[rawId] = [];
            grouped[rawId].push(item);
        });
        
        // Find duplicates
        const duplicates = Object.entries(grouped)
            .filter(([rawId, items]) => items.length > 1)
            .map(([rawId, items]) => items.slice(1)); // Keep first, delete rest
        
        console.log(`📊 Nájdené ${duplicates.length} skupín duplikátov`);
        
        // Delete duplicates
        for (const duplicateGroup of duplicates) {
            for (const duplicate of duplicateGroup) {
                console.log(`🗑️  Vymazávam: ${duplicate.title} (${duplicate.articleId})`);
                await dynamodb.send(new DeleteCommand({
                    TableName: 'InfiniteArticles-dev',
                    Key: {
                        articleId: duplicate.articleId,
                        type: duplicate.type
                    }
                }));
            }
        }
        
        console.log('✅ Duplikáty vymazané');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

deleteDuplicates();
