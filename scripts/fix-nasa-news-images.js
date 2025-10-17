#!/usr/bin/env node

/**
 * Fix NASA News Images Script
 * 
 * This script fixes existing nasa-news articles that don't have images by:
 * 1. Re-extracting images from original RSS content (if available)
 * 2. Using NASA Image API fallback to find relevant images
 * 3. Re-processing articles through ai-content-generator
 * 
 * Usage: node scripts/fix-nasa-news-images.js [--dry-run] [--content-id=ID]
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const fs = require('fs');
const path = require('path');

// Import our modules
const { getNASAImageForNews, needsImageFallback } = require('../backend/functions/scheduled/nasa-news-image-fallback');

// Configuration
const REGION = process.env.AWS_REGION || 'eu-central-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = `InfiniteRawContent-${ENVIRONMENT}`;
const ARTICLES_TABLE = `InfiniteArticles-${ENVIRONMENT}`;
const AI_CONTENT_GENERATOR_FUNCTION = `infinite-ai-content-generator-${ENVIRONMENT}`;

// Initialize AWS clients
const dynamodbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamodbClient);
const lambdaClient = new LambdaClient({ region: REGION });

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const contentIdArg = args.find(arg => arg.startsWith('--content-id='));
const specificContentId = contentIdArg ? contentIdArg.split('=')[1] : null;

/**
 * Check if an image URL is valid
 */
function isValidImageUrl(imageUrl) {
    if (!imageUrl) return false;
    if (imageUrl === 'None') return false;
    if (imageUrl.trim() === '') return false;
    return true;
}

/**
 * Load report from check script
 */
function loadReport() {
    const reportPath = path.join(__dirname, '..', 'nasa-news-images-report.json');
    
    if (!fs.existsSync(reportPath)) {
        console.error('❌ Report file not found. Please run check-nasa-news-images.js first.');
        process.exit(1);
    }
    
    try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        console.log(`📊 Loaded report from: ${reportPath}`);
        console.log(`📅 Report generated: ${report.timestamp}`);
        return report;
    } catch (error) {
        console.error('❌ Error loading report:', error.message);
        process.exit(1);
    }
}

/**
 * Get raw content item by contentId
 */
async function getRawContentItem(contentId) {
    try {
        const result = await docClient.send(new GetCommand({
            TableName: RAW_CONTENT_TABLE,
            Key: {
                contentId: contentId,
                source: 'nasa-news'
            }
        }));
        
        return result.Item || null;
    } catch (error) {
        console.error(`Error getting raw content ${contentId}:`, error.message);
        return null;
    }
}

/**
 * Update raw content item with new image URL
 */
async function updateRawContentImage(contentId, imageUrl, imageCredit = '') {
    if (isDryRun) {
        console.log(`[DRY RUN] Would update raw content ${contentId} with image: ${imageUrl}`);
        return true;
    }
    
    try {
        await docClient.send(new UpdateCommand({
            TableName: RAW_CONTENT_TABLE,
            Key: {
                contentId: contentId,
                source: 'nasa-news'
            },
            UpdateExpression: 'SET imageUrl = :imageUrl, imageCredit = :imageCredit, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':imageUrl': imageUrl,
                ':imageCredit': imageCredit,
                ':updatedAt': new Date().toISOString()
            }
        }));
        
        console.log(`✅ Updated raw content ${contentId} with image: ${imageUrl}`);
        return true;
    } catch (error) {
        console.error(`Error updating raw content ${contentId}:`, error.message);
        return false;
    }
}

/**
 * Re-process article through AI content generator
 */
async function reprocessArticle(contentId) {
    if (isDryRun) {
        console.log(`[DRY RUN] Would re-process article ${contentId}`);
        return true;
    }
    
    try {
        const payload = {
            contentId: contentId,
            source: 'nasa-news'
        };
        
        const result = await lambdaClient.send(new InvokeCommand({
            FunctionName: AI_CONTENT_GENERATOR_FUNCTION,
            Payload: JSON.stringify(payload),
            InvocationType: 'RequestResponse'
        }));
        
        const response = JSON.parse(Buffer.from(result.Payload).toString());
        
        if (response.statusCode === 200) {
            console.log(`✅ Re-processed article ${contentId}`);
            return true;
        } else {
            console.error(`❌ Failed to re-process article ${contentId}:`, response.body);
            return false;
        }
    } catch (error) {
        console.error(`Error re-processing article ${contentId}:`, error.message);
        return false;
    }
}

/**
 * Try to find image for raw content item
 */
async function findImageForRawContent(rawItem) {
    console.log(`🔍 Looking for image for: ${rawItem.title}`);
    
    // Method 1: Check if raw content already has an image URL
    if (isValidImageUrl(rawItem.imageUrl)) {
        console.log(`✅ Raw content already has image: ${rawItem.imageUrl}`);
        return { url: rawItem.imageUrl, credit: rawItem.imageCredit || '' };
    }
    
    // Method 2: Try NASA Image API fallback
    console.log('🔍 Trying NASA Image API fallback...');
    const fallbackImage = await getNASAImageForNews(rawItem);
    if (fallbackImage) {
        console.log(`✅ Found fallback image: ${fallbackImage.title}`);
        return { 
            url: fallbackImage.url, 
            credit: fallbackImage.credit || 'NASA' 
        };
    }
    
    console.log('❌ No image found');
    return null;
}

/**
 * Fix a single raw content item
 */
async function fixRawContentItem(rawItem) {
    const contentId = rawItem.contentId;
    console.log(`\n🔧 Fixing raw content: ${contentId}`);
    console.log(`   Title: ${rawItem.title}`);
    console.log(`   Current imageUrl: ${rawItem.imageUrl || 'MISSING'}`);
    
    // Find image
    const imageData = await findImageForRawContent(rawItem);
    if (!imageData) {
        console.log(`❌ Could not find image for ${contentId}`);
        return { success: false, reason: 'no_image_found' };
    }
    
    // Update raw content
    const updateSuccess = await updateRawContentImage(contentId, imageData.url, imageData.credit);
    if (!updateSuccess) {
        return { success: false, reason: 'update_failed' };
    }
    
    // Re-process article
    const reprocessSuccess = await reprocessArticle(contentId);
    if (!reprocessSuccess) {
        return { success: false, reason: 'reprocess_failed' };
    }
    
    return { success: true, imageUrl: imageData.url };
}

/**
 * Fix articles without images
 */
async function fixArticlesWithoutImages() {
    console.log('🚀 Starting NASA News Images Fix...');
    console.log(`Environment: ${ENVIRONMENT}`);
    console.log(`Region: ${REGION}`);
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    
    if (specificContentId) {
        console.log(`Targeting specific content ID: ${specificContentId}`);
    }
    
    // Load report
    const report = loadReport();
    
    // Get items to fix
    let itemsToFix = [];
    
    if (specificContentId) {
        // Fix specific content ID
        const rawItem = await getRawContentItem(specificContentId);
        if (rawItem) {
            itemsToFix = [rawItem];
        } else {
            console.error(`❌ Raw content item not found: ${specificContentId}`);
            process.exit(1);
        }
    } else {
        // Fix all items without images from report
        const rawContentItems = report.itemsWithoutImages.rawContent || [];
        const articlesItems = report.itemsWithoutImages.articles || [];
        
        // Get raw content items for articles without images
        for (const articleItem of articlesItems) {
            const rawItem = await getRawContentItem(articleItem.contentId);
            if (rawItem) {
                itemsToFix.push(rawItem);
            }
        }
        
        // Add raw content items without images
        for (const rawItem of rawContentItems) {
            const existingItem = itemsToFix.find(item => item.contentId === rawItem.contentId);
            if (!existingItem) {
                const fullRawItem = await getRawContentItem(rawItem.contentId);
                if (fullRawItem) {
                    itemsToFix.push(fullRawItem);
                }
            }
        }
    }
    
    console.log(`\n📊 Found ${itemsToFix.length} items to fix`);
    
    if (itemsToFix.length === 0) {
        console.log('✅ No items need fixing!');
        return;
    }
    
    // Process each item
    const results = {
        total: itemsToFix.length,
        successful: 0,
        failed: 0,
        errors: []
    };
    
    for (const rawItem of itemsToFix) {
        try {
            const result = await fixRawContentItem(rawItem);
            if (result.success) {
                results.successful++;
                console.log(`✅ Successfully fixed: ${rawItem.contentId}`);
            } else {
                results.failed++;
                results.errors.push({
                    contentId: rawItem.contentId,
                    title: rawItem.title,
                    reason: result.reason
                });
                console.log(`❌ Failed to fix: ${rawItem.contentId} (${result.reason})`);
            }
        } catch (error) {
            results.failed++;
            results.errors.push({
                contentId: rawItem.contentId,
                title: rawItem.title,
                reason: error.message
            });
            console.error(`❌ Error fixing ${rawItem.contentId}:`, error.message);
        }
    }
    
    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('🔧 NASA NEWS IMAGES FIX SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total items processed: ${results.total}`);
    console.log(`Successfully fixed: ${results.successful}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
        console.log('\n❌ Errors:');
        results.errors.forEach(error => {
            console.log(`   ${error.contentId}: ${error.reason}`);
        });
    }
    
    // Save results
    const resultsPath = path.join(__dirname, '..', 'nasa-news-images-fix-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: isDryRun ? 'dry-run' : 'live',
        results: results
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsPath}`);
    console.log('='.repeat(80));
    
    if (results.failed > 0) {
        process.exit(1);
    }
}

/**
 * Main function
 */
async function main() {
    try {
        await fixArticlesWithoutImages();
    } catch (error) {
        console.error('❌ Error during fix process:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, fixRawContentItem, findImageForRawContent };
