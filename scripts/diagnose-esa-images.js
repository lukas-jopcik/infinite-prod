#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');

// AWS Configuration
const REGION = 'eu-central-1';
const S3_BUCKET = 'infinite-images-dev-349660737637';
const RAW_CONTENT_TABLE = 'InfiniteApodArchive-dev';
const ARTICLES_TABLE = 'InfiniteArticles-dev';

// Initialize AWS clients
const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: REGION });

/**
 * Main diagnostic function
 */
async function diagnoseESAImages() {
    console.log('🔍 Starting ESA Image Diagnostics...\n');
    
    try {
        // Step 1: Get all ESA articles from Articles table
        console.log('📋 Step 1: Fetching ESA articles from Articles table...');
        const articles = await getESAArticles();
        console.log(`   Found ${articles.length} ESA articles\n`);
        
        // Step 2: Get corresponding raw content records
        console.log('📋 Step 2: Fetching raw content records...');
        const rawContentMap = await getRawContentMap();
        console.log(`   Found ${Object.keys(rawContentMap).length} raw content records\n`);
        
        // Step 3: Analyze each article
        console.log('🔍 Step 3: Analyzing image storage...');
        const results = await analyzeImages(articles, rawContentMap);
        
        // Step 4: Generate report
        console.log('\n📊 DIAGNOSTIC REPORT');
        console.log('====================');
        generateReport(results);
        
    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
        process.exit(1);
    }
}

/**
 * Get all ESA articles from the Articles table
 */
async function getESAArticles() {
    const articles = [];
    let lastEvaluatedKey = null;
    
    do {
        const params = {
            TableName: ARTICLES_TABLE,
            FilterExpression: '#source = :source',
            ExpressionAttributeNames: {
                '#source': 'source'
            },
            ExpressionAttributeValues: {
                ':source': 'esa-hubble-potw'
            }
        };
        
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }
        
        const result = await dynamodb.send(new ScanCommand(params));
        articles.push(...(result.Items || []));
        lastEvaluatedKey = result.LastEvaluatedKey;
        
    } while (lastEvaluatedKey);
    
    return articles;
}

/**
 * Get raw content records mapped by contentId
 */
async function getRawContentMap() {
    const rawContentMap = {};
    let lastEvaluatedKey = null;
    
    do {
        const params = {
            TableName: RAW_CONTENT_TABLE,
            FilterExpression: '#source = :source',
            ExpressionAttributeNames: {
                '#source': 'source'
            },
            ExpressionAttributeValues: {
                ':source': 'esa-hubble-potw'
            }
        };
        
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }
        
        const result = await dynamodb.send(new ScanCommand(params));
        
        if (result.Items) {
            result.Items.forEach(item => {
                rawContentMap[item.contentId] = item;
            });
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
    } while (lastEvaluatedKey);
    
    return rawContentMap;
}

/**
 * Analyze images for each article
 */
async function analyzeImages(articles, rawContentMap) {
    const results = {
        total: articles.length,
        working: 0,
        broken: 0,
        missing: 0,
        issues: []
    };
    
    for (const article of articles) {
        const analysis = await analyzeArticle(article, rawContentMap);
        
        if (analysis.status === 'working') {
            results.working++;
        } else if (analysis.status === 'broken') {
            results.broken++;
        } else {
            results.missing++;
        }
        
        if (analysis.issues.length > 0) {
            results.issues.push(analysis);
        }
    }
    
    return results;
}

/**
 * Analyze a single article
 */
async function analyzeArticle(article, rawContentMap) {
    const analysis = {
        articleId: article.articleId,
        title: article.title,
        status: 'unknown',
        issues: [],
        imageUrl: article.imageUrl,
        rawContentId: article.rawContentId
    };
    
    // Check if we have raw content
    const rawContent = rawContentMap[article.rawContentId];
    if (!rawContent) {
        analysis.issues.push('No raw content record found');
        analysis.status = 'missing';
        return analysis;
    }
    
    // Check original ESA image URL
    if (!rawContent.imageUrl) {
        analysis.issues.push('No original image URL in raw content');
        analysis.status = 'missing';
        return analysis;
    }
    
    // Test original ESA image URL
    const originalUrlAccessible = await testImageUrl(rawContent.imageUrl);
    if (!originalUrlAccessible) {
        analysis.issues.push(`Original ESA image URL not accessible: ${rawContent.imageUrl}`);
        analysis.status = 'broken';
        return analysis;
    }
    
    // Check if article has processed image URL
    if (!article.imageUrl) {
        analysis.issues.push('No processed image URL in article');
        analysis.status = 'missing';
        return analysis;
    }
    
    // Extract S3 key from processed image URL
    const s3Key = extractS3Key(article.imageUrl);
    if (!s3Key) {
        analysis.issues.push(`Could not extract S3 key from URL: ${article.imageUrl}`);
        analysis.status = 'broken';
        return analysis;
    }
    
    // Check if file exists in S3
    const s3FileExists = await checkS3File(s3Key);
    if (!s3FileExists) {
        analysis.issues.push(`S3 file does not exist: ${s3Key}`);
        analysis.status = 'broken';
        return analysis;
    }
    
    // If we get here, everything is working
    analysis.status = 'working';
    return analysis;
}

/**
 * Test if an image URL is accessible
 */
async function testImageUrl(url) {
    try {
        const response = await axios.head(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Infinite-Diagnostics/1.0'
            }
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

/**
 * Extract S3 key from S3 URL
 */
function extractS3Key(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('s3') && urlObj.pathname) {
            return urlObj.pathname.substring(1); // Remove leading slash
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Check if file exists in S3
 */
async function checkS3File(key) {
    try {
        await s3.send(new HeadObjectCommand({
            Bucket: S3_BUCKET,
            Key: key
        }));
        return true;
    } catch (error) {
        if (error.name === 'NotFound') {
            return false;
        }
        throw error;
    }
}

/**
 * Generate diagnostic report
 */
function generateReport(results) {
    console.log(`Total ESA Articles: ${results.total}`);
    console.log(`Working Images: ${results.working}`);
    console.log(`Broken Images: ${results.broken}`);
    console.log(`Missing Images: ${results.missing}`);
    
    if (results.issues.length > 0) {
        console.log('\n🚨 ISSUES FOUND:');
        console.log('================');
        
        results.issues.forEach((issue, index) => {
            console.log(`\n${index + 1}. Article: ${issue.title}`);
            console.log(`   Article ID: ${issue.articleId}`);
            console.log(`   Status: ${issue.status}`);
            console.log(`   Image URL: ${issue.imageUrl || 'N/A'}`);
            console.log(`   Raw Content ID: ${issue.rawContentId || 'N/A'}`);
            console.log('   Issues:');
            issue.issues.forEach(issueText => {
                console.log(`     - ${issueText}`);
            });
        });
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('===================');
        
        const brokenCount = results.issues.filter(i => i.status === 'broken').length;
        const missingCount = results.issues.filter(i => i.status === 'missing').length;
        
        if (brokenCount > 0) {
            console.log(`- ${brokenCount} articles have broken images - need repair script`);
        }
        if (missingCount > 0) {
            console.log(`- ${missingCount} articles are missing images - need reprocessing`);
        }
        console.log('- Run repair script to fix all identified issues');
    } else {
        console.log('\n✅ All ESA images are working correctly!');
    }
}

// Run diagnostics
if (require.main === module) {
    diagnoseESAImages();
}

module.exports = { diagnoseESAImages };
