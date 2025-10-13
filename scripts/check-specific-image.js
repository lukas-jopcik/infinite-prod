#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// AWS Configuration
const REGION = 'eu-central-1';
const ARTICLES_TABLE = 'InfiniteArticles-dev';

// Initialize AWS clients
const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

async function checkSpecificImage() {
    console.log('🔍 Checking specific ESA image record...\n');
    
    try {
        // Look for the specific contentId mentioned in the URL
        const contentId = 'esa-hubble-potw-2025-07-14-df1292c5-840c-41a6-a429-e3262dcf5799';
        
        const params = {
            TableName: ARTICLES_TABLE,
            FilterExpression: 'contains(rawContentId, :contentId)',
            ExpressionAttributeValues: {
                ':contentId': contentId
            }
        };
        
        const result = await dynamodb.send(new ScanCommand(params));
        
        if (result.Items && result.Items.length > 0) {
            const article = result.Items[0];
            console.log('📋 Found article:');
            console.log(`   Title: ${article.title}`);
            console.log(`   Article ID: ${article.articleId}`);
            console.log(`   Raw Content ID: ${article.rawContentId}`);
            console.log(`   Image URL: ${article.imageUrl}`);
            console.log(`   Source: ${article.source}`);
            
            if (article.images) {
                console.log('\n🖼️  Processed Images:');
                Object.entries(article.images).forEach(([key, value]) => {
                    if (value && value.url) {
                        console.log(`   ${key}: ${value.url}`);
                    }
                });
            }
        } else {
            console.log('❌ No article found with that contentId');
            
            // Let's search for any ESA articles with similar dates
            console.log('\n🔍 Searching for ESA articles with 2025-07-14...');
            const searchParams = {
                TableName: ARTICLES_TABLE,
                FilterExpression: '#source = :source AND contains(rawContentId, :date)',
                ExpressionAttributeNames: {
                    '#source': 'source'
                },
                ExpressionAttributeValues: {
                    ':source': 'esa-hubble-potw',
                    ':date': '2025-07-14'
                }
            };
            
            const searchResult = await dynamodb.send(new ScanCommand(searchParams));
            
            if (searchResult.Items && searchResult.Items.length > 0) {
                console.log(`Found ${searchResult.Items.length} ESA articles for 2025-07-14:`);
                searchResult.Items.forEach((item, index) => {
                    console.log(`\n${index + 1}. ${item.title}`);
                    console.log(`   Raw Content ID: ${item.rawContentId}`);
                    console.log(`   Image URL: ${item.imageUrl}`);
                });
            } else {
                console.log('No ESA articles found for 2025-07-14');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run check
if (require.main === module) {
    checkSpecificImage();
}

module.exports = { checkSpecificImage };
