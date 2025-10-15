#!/usr/bin/env node

/**
 * Bulk Upload Script for APOD Archive Data to DynamoDB
 * 
 * This script uploads scraped APOD articles from apod-archive-data.json
 * to the InfiniteRawContent-dev table in batches.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

// Configuration
const REGION = 'eu-central-1';
const RAW_CONTENT_TABLE = 'InfiniteRawContent-dev';
const BATCH_SIZE = 25; // DynamoDB BatchWrite limit
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds to avoid throttling

// Initialize DynamoDB clients
const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

/**
 * Upload articles to DynamoDB in batches
 */
async function uploadToDb() {
    try {
        // Read JSON file
        const dataPath = path.join(__dirname, 'apod-archive-data.json');
        console.log(`📂 Reading data from: ${dataPath}`);
        
        if (!fs.existsSync(dataPath)) {
            throw new Error(`File not found: ${dataPath}`);
        }
        
        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        const articles = JSON.parse(fileContent);
        
        console.log(`📊 Total articles to upload: ${articles.length}`);
        console.log(`📦 Batch size: ${BATCH_SIZE}`);
        console.log(`⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES}ms\n`);
        
        // Upload in batches
        let uploadedCount = 0;
        let errorCount = 0;
        const totalBatches = Math.ceil(articles.length / BATCH_SIZE);
        
        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const batch = articles.slice(i, i + BATCH_SIZE);
            
            try {
                const params = {
                    RequestItems: {
                        [RAW_CONTENT_TABLE]: batch.map(item => ({
                            PutRequest: { Item: item }
                        }))
                    }
                };
                
                await dynamodb.send(new BatchWriteCommand(params));
                uploadedCount += batch.length;
                
                console.log(`✅ Batch ${batchNumber}/${totalBatches}: Uploaded ${batch.length} articles (${uploadedCount}/${articles.length})`);
                
                // Delay to avoid throughput exceeded errors
                if (i + BATCH_SIZE < articles.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
                
            } catch (batchError) {
                console.error(`❌ Batch ${batchNumber}/${totalBatches} failed:`, batchError.message);
                errorCount += batch.length;
            }
        }
        
        console.log('\n📊 UPLOAD COMPLETE!');
        console.log('==================================================');
        console.log(`✅ Successfully uploaded: ${uploadedCount}/${articles.length}`);
        console.log(`❌ Failed: ${errorCount}/${articles.length}`);
        console.log(`📁 Table: ${RAW_CONTENT_TABLE}`);
        console.log(`🌍 Region: ${REGION}`);
        
        if (errorCount > 0) {
            console.log('\n⚠️  Some articles failed to upload. Check the logs above.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ UPLOAD FAILED:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run the upload
console.log('🚀 Starting APOD Archive Upload to DynamoDB...\n');
uploadToDb();

