#!/usr/bin/env node

/**
 * Bulk Upload Script for APOD Archive Data to DynamoDB - V2
 * 
 * Features:
 * - Retry logic for failed batches
 * - Exponential backoff
 * - Progress tracking
 * - Detailed error reporting
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

// Configuration
const REGION = 'eu-central-1';
const RAW_CONTENT_TABLE = 'InfiniteApodArchive-dev';
const BATCH_SIZE = 25; // DynamoDB BatchWrite limit
const INITIAL_DELAY = 3000; // 3 seconds between batches
const MAX_RETRIES = 3; // Retry failed batches 3 times

// Initialize DynamoDB clients
const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Upload a single batch with retry logic
 */
async function uploadBatch(batch, batchNumber, totalBatches, retryCount = 0) {
    try {
        const params = {
            RequestItems: {
                [RAW_CONTENT_TABLE]: batch.map(item => ({
                    PutRequest: { Item: item }
                }))
            }
        };
        
        const result = await dynamodb.send(new BatchWriteCommand(params));
        
        // Check for unprocessed items
        if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
            const unprocessedCount = result.UnprocessedItems[RAW_CONTENT_TABLE]?.length || 0;
            
            if (retryCount < MAX_RETRIES) {
                console.log(`⚠️  Batch ${batchNumber}/${totalBatches}: ${unprocessedCount} unprocessed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
                
                // Exponential backoff
                const delay = INITIAL_DELAY * Math.pow(2, retryCount);
                await sleep(delay);
                
                // Extract unprocessed items and retry
                const unprocessedBatch = result.UnprocessedItems[RAW_CONTENT_TABLE].map(
                    item => item.PutRequest.Item
                );
                
                return await uploadBatch(unprocessedBatch, batchNumber, totalBatches, retryCount + 1);
            } else {
                throw new Error(`${unprocessedCount} items still unprocessed after ${MAX_RETRIES} retries`);
            }
        }
        
        return { success: true, count: batch.length };
        
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`⚠️  Batch ${batchNumber}/${totalBatches}: Error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
            
            // Exponential backoff
            const delay = INITIAL_DELAY * Math.pow(2, retryCount);
            await sleep(delay);
            
            return await uploadBatch(batch, batchNumber, totalBatches, retryCount + 1);
        } else {
            throw error;
        }
    }
}

/**
 * Upload articles to DynamoDB in batches
 */
async function uploadToDb() {
    try {
        console.log('🚀 Starting APOD Archive Upload to DynamoDB...\n');
        
        // Read the JSON file
        const dataPath = path.join(__dirname, 'apod-archive-data.json');
        console.log(`📂 Reading data from: ${dataPath}`);
        
        if (!fs.existsSync(dataPath)) {
            throw new Error('apod-archive-data.json not found!');
        }
        
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        console.log(`📊 Total articles to upload: ${data.length}`);
        console.log(`⚙️  Batch size: ${BATCH_SIZE}, Delay: ${INITIAL_DELAY}ms, Max retries: ${MAX_RETRIES}\n`);
        
        let successCount = 0;
        let failedCount = 0;
        const failedBatches = [];
        
        // Process in batches
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(data.length / BATCH_SIZE);
            
            try {
                const result = await uploadBatch(batch, batchNumber, totalBatches);
                successCount += result.count;
                
                console.log(`✅ Batch ${batchNumber}/${totalBatches}: Uploaded ${result.count} articles (${successCount}/${data.length})`);
                
            } catch (error) {
                failedCount += batch.length;
                failedBatches.push({ 
                    batchNumber, 
                    error: error.message,
                    articles: batch.map(b => `${b.date}: ${b.title}`)
                });
                console.error(`❌ Batch ${batchNumber}/${totalBatches}: Failed after ${MAX_RETRIES} retries - ${error.message}`);
            }
            
            // Delay between batches
            if (i + BATCH_SIZE < data.length) {
                await sleep(INITIAL_DELAY);
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 UPLOAD COMPLETE!');
        console.log('='.repeat(60));
        console.log(`✅ Successfully uploaded: ${successCount}/${data.length}`);
        
        if (failedCount > 0) {
            console.log(`❌ Failed: ${failedCount}/${data.length}`);
            console.log('\n🔍 Failed batches:');
            failedBatches.forEach(({ batchNumber, error, articles }) => {
                console.log(`\n   Batch ${batchNumber}:`);
                console.log(`   Error: ${error}`);
                console.log(`   Articles: ${articles.slice(0, 3).join(', ')}${articles.length > 3 ? '...' : ''}`);
            });
            
            // Save failed items to file
            const failedPath = path.join(__dirname, 'upload-failed.json');
            const failedArticles = failedBatches.flatMap(b => b.articles);
            fs.writeFileSync(failedPath, JSON.stringify(failedArticles, null, 2));
            console.log(`\n💾 Failed articles saved to: ${failedPath}`);
        } else {
            console.log('🎉 All articles uploaded successfully!');
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the upload
uploadToDb();

