#!/usr/bin/env node

/**
 * Check NASA News Images Script
 * 
 * This script checks all nasa-news articles in both InfiniteRawContent-dev 
 * and InfiniteArticles-dev tables to identify articles without images.
 * 
 * Usage: node scripts/check-nasa-news-images.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

// Configuration
const REGION = process.env.AWS_REGION || 'eu-central-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = `InfiniteRawContent-${ENVIRONMENT}`;
const ARTICLES_TABLE = `InfiniteArticles-${ENVIRONMENT}`;

// Initialize DynamoDB client
const dynamodbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamodbClient);

/**
 * Check if an image URL is valid (not empty, null, or "None")
 */
function isValidImageUrl(imageUrl) {
    if (!imageUrl) return false;
    if (imageUrl === 'None') return false;
    if (imageUrl.trim() === '') return false;
    return true;
}

/**
 * Scan table for nasa-news items
 */
async function scanTableForNasaNews(tableName, tableType) {
    console.log(`\n📊 Scanning ${tableName} for nasa-news items...`);
    
    const items = [];
    let lastEvaluatedKey = null;
    
    do {
        const scanParams = {
            TableName: tableName,
            FilterExpression: '#source = :source',
            ExpressionAttributeNames: {
                '#source': 'source'
            },
            ExpressionAttributeValues: {
                ':source': 'nasa-news'
            }
        };
        
        if (lastEvaluatedKey) {
            scanParams.ExclusiveStartKey = lastEvaluatedKey;
        }
        
        const result = await docClient.send(new ScanCommand(scanParams));
        
        if (result.Items) {
            items.push(...result.Items);
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
    } while (lastEvaluatedKey);
    
    console.log(`Found ${items.length} nasa-news items in ${tableName}`);
    return items;
}

/**
 * Analyze items and categorize by image status
 */
function analyzeItems(items, tableType) {
    const analysis = {
        total: items.length,
        withImages: 0,
        withoutImages: 0,
        itemsWithoutImages: []
    };
    
    items.forEach(item => {
        let imageUrl = null;
        
        if (tableType === 'raw') {
            imageUrl = item.imageUrl;
        } else if (tableType === 'articles') {
            imageUrl = item.imageUrl || item.heroImage?.src;
        }
        
        if (isValidImageUrl(imageUrl)) {
            analysis.withImages++;
        } else {
            analysis.withoutImages++;
            analysis.itemsWithoutImages.push({
                contentId: item.contentId || item.articleId,
                title: item.title,
                date: item.date || item.originalDate || item.publishedAt,
                imageUrl: imageUrl,
                tableType: tableType,
                slug: item.slug,
                status: item.status
            });
        }
    });
    
    return analysis;
}

/**
 * Generate detailed report
 */
function generateReport(rawAnalysis, articlesAnalysis) {
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            rawContent: {
                total: rawAnalysis.total,
                withImages: rawAnalysis.withImages,
                withoutImages: rawAnalysis.withoutImages,
                percentageWithImages: rawAnalysis.total > 0 ? 
                    Math.round((rawAnalysis.withImages / rawAnalysis.total) * 100) : 0
            },
            articles: {
                total: articlesAnalysis.total,
                withImages: articlesAnalysis.withImages,
                withoutImages: articlesAnalysis.withoutImages,
                percentageWithImages: articlesAnalysis.total > 0 ? 
                    Math.round((articlesAnalysis.withImages / articlesAnalysis.total) * 100) : 0
            }
        },
        itemsWithoutImages: {
            rawContent: rawAnalysis.itemsWithoutImages,
            articles: articlesAnalysis.itemsWithoutImages
        }
    };
    
    return report;
}

/**
 * Display results to console
 */
function displayResults(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 NASA NEWS IMAGES ANALYSIS REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📅 Generated: ${report.timestamp}`);
    
    console.log('\n📊 RAW CONTENT TABLE (InfiniteRawContent-dev):');
    console.log(`   Total nasa-news items: ${report.summary.rawContent.total}`);
    console.log(`   With images: ${report.summary.rawContent.withImages} (${report.summary.rawContent.percentageWithImages}%)`);
    console.log(`   Without images: ${report.summary.rawContent.withoutImages}`);
    
    console.log('\n📰 ARTICLES TABLE (InfiniteArticles-dev):');
    console.log(`   Total nasa-news articles: ${report.summary.articles.total}`);
    console.log(`   With images: ${report.summary.articles.withImages} (${report.summary.articles.percentageWithImages}%)`);
    console.log(`   Without images: ${report.summary.articles.withoutImages}`);
    
    // Show items without images
    if (report.itemsWithoutImages.rawContent.length > 0) {
        console.log('\n❌ RAW CONTENT ITEMS WITHOUT IMAGES:');
        report.itemsWithoutImages.rawContent.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.title}`);
            console.log(`      ContentId: ${item.contentId}`);
            console.log(`      Date: ${item.date}`);
            console.log(`      ImageUrl: ${item.imageUrl || 'MISSING'}`);
        });
    }
    
    if (report.itemsWithoutImages.articles.length > 0) {
        console.log('\n❌ ARTICLES WITHOUT IMAGES:');
        report.itemsWithoutImages.articles.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.title}`);
            console.log(`      ArticleId: ${item.contentId}`);
            console.log(`      Slug: ${item.slug}`);
            console.log(`      Date: ${item.date}`);
            console.log(`      ImageUrl: ${item.imageUrl || 'MISSING'}`);
        });
    }
    
    console.log('\n' + '='.repeat(80));
}

/**
 * Save report to file
 */
function saveReport(report) {
    const reportPath = path.join(__dirname, '..', 'nasa-news-images-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${reportPath}`);
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🚀 Starting NASA News Images Check...');
        console.log(`Environment: ${ENVIRONMENT}`);
        console.log(`Region: ${REGION}`);
        
        // Check AWS credentials
        try {
            await docClient.send(new ScanCommand({ 
                TableName: RAW_CONTENT_TABLE,
                Limit: 1 
            }));
        } catch (error) {
            if (error.name === 'CredentialsProviderError' || error.name === 'UnauthorizedOperation') {
                console.error('❌ AWS credentials not configured. Please run "aws configure" first.');
                process.exit(1);
            }
            throw error;
        }
        
        // Scan both tables
        const rawItems = await scanTableForNasaNews(RAW_CONTENT_TABLE, 'raw');
        const articlesItems = await scanTableForNasaNews(ARTICLES_TABLE, 'articles');
        
        // Analyze results
        const rawAnalysis = analyzeItems(rawItems, 'raw');
        const articlesAnalysis = analyzeItems(articlesItems, 'articles');
        
        // Generate and display report
        const report = generateReport(rawAnalysis, articlesAnalysis);
        displayResults(report);
        saveReport(report);
        
        // Exit with appropriate code
        const totalWithoutImages = rawAnalysis.withoutImages + articlesAnalysis.withoutImages;
        if (totalWithoutImages > 0) {
            console.log(`\n⚠️  Found ${totalWithoutImages} items without images. Consider running fix script.`);
            process.exit(1);
        } else {
            console.log('\n✅ All nasa-news items have images!');
            process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Error during analysis:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, analyzeItems, isValidImageUrl };
