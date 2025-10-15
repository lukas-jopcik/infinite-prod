const Parser = require('rss-parser');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const parser = new Parser();
const client = new DynamoDBClient({ region: 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

async function fixESAImages() {
    try {
        console.log('🔍 Fetching RSS feed...');
        const feed = await parser.parseURL('https://feeds.feedburner.com/esahubble/images/potw/');
        
        console.log(`📋 Found ${feed.items.length} items in RSS feed`);
        
        // Create a map of title -> imageUrl
        const imageMap = {};
        feed.items.forEach(item => {
            if (item.enclosure && item.enclosure.url) {
                imageMap[item.title] = item.enclosure.url;
            }
        });
        
        console.log(`📊 Created image map with ${Object.keys(imageMap).length} entries`);
        
        // Scan for ESA articles without imageUrl
        console.log('🔍 Scanning DynamoDB for ESA articles...');
        const scanResult = await dynamodb.send(new ScanCommand({
            TableName: 'InfiniteApodArchive-dev',
            FilterExpression: '#source = :source',
            ExpressionAttributeNames: {
                '#source': 'source'
            },
            ExpressionAttributeValues: {
                ':source': 'esa-hubble-potw'
            }
        }));
        
        console.log(`📊 Found ${scanResult.Items.length} ESA articles in DB`);
        
        let updated = 0;
        let skipped = 0;
        
        for (const item of scanResult.Items) {
            const imageUrl = imageMap[item.title];
            
            if (imageUrl && (!item.imageUrl || item.imageUrl === null)) {
                console.log(`✅ Updating: ${item.title}`);
                console.log(`   Image URL: ${imageUrl}`);
                
                await dynamodb.send(new UpdateCommand({
                    TableName: 'InfiniteApodArchive-dev',
                    Key: {
                        contentId: item.contentId,
                        source: item.source
                    },
                    UpdateExpression: 'SET imageUrl = :url',
                    ExpressionAttributeValues: {
                        ':url': imageUrl
                    }
                }));
                
                updated++;
            } else {
                skipped++;
            }
        }
        
        console.log('\n✅ Update complete!');
        console.log(`   Updated: ${updated}`);
        console.log(`   Skipped: ${skipped}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixESAImages();
