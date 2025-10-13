#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// AWS Configuration
const REGION = 'eu-central-1';
const RAW_CONTENT_TABLE = 'InfiniteApodArchive-dev';

// Initialize AWS clients
const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

async function checkRawContent() {
    console.log('🔍 Checking raw content for ESA image...\n');
    
    try {
        const contentId = 'esa-hubble-potw-2025-07-14-df1292c5-840c-41a6-a429-e3262dcf5799';
        
        const params = {
            TableName: RAW_CONTENT_TABLE,
            FilterExpression: 'contentId = :contentId',
            ExpressionAttributeValues: {
                ':contentId': contentId
            }
        };
        
        const result = await dynamodb.send(new ScanCommand(params));
        
        if (result.Items && result.Items.length > 0) {
            const rawContent = result.Items[0];
            console.log('📋 Raw Content Record:');
            console.log(`   Content ID: ${rawContent.contentId}`);
            console.log(`   Title: ${rawContent.title}`);
            console.log(`   Source: ${rawContent.source}`);
            console.log(`   Original Image URL: ${rawContent.imageUrl}`);
            console.log(`   URL: ${rawContent.url}`);
            console.log(`   Date: ${rawContent.date}`);
            console.log(`   Status: ${rawContent.status}`);
            
            // Test the original image URL
            if (rawContent.imageUrl) {
                console.log('\n🔍 Testing original image URL...');
                const axios = require('axios');
                try {
                    const response = await axios.head(rawContent.imageUrl, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Infinite-Diagnostics/1.0'
                        }
                    });
                    console.log(`   ✅ Original URL accessible: ${response.status}`);
                    console.log(`   Content-Type: ${response.headers['content-type']}`);
                } catch (error) {
                    console.log(`   ❌ Original URL not accessible: ${error.message}`);
                }
            }
        } else {
            console.log('❌ No raw content found with that contentId');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run check
if (require.main === module) {
    checkRawContent();
}

module.exports = { checkRawContent };
