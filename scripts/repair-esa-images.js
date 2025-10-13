#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const sharp = require('sharp');

// AWS Configuration
const REGION = 'eu-central-1';
const S3_BUCKET = 'infinite-images-dev-349660737637';
const ARTICLES_TABLE = 'InfiniteArticles-dev';
const RAW_CONTENT_TABLE = 'InfiniteApodArchive-dev';

// Initialize AWS clients
const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({ region: REGION });

/**
 * Main repair function
 */
async function repairESAImages() {
    console.log('🔧 Starting ESA Image Repair...\n');
    
    try {
        // Step 1: Find all ESA articles
        console.log('📋 Step 1: Finding ESA articles...');
        const articles = await getESAArticles();
        console.log(`   Found ${articles.length} ESA articles\n`);
        
        // Step 2: Get raw content records
        console.log('📋 Step 2: Getting raw content records...');
        const rawContentMap = await getRawContentMap();
        console.log(`   Found ${Object.keys(rawContentMap).length} raw content records\n`);
        
        // Step 3: Identify broken images
        console.log('🔍 Step 3: Identifying broken images...');
        const brokenImages = await identifyBrokenImages(articles, rawContentMap);
        console.log(`   Found ${brokenImages.length} broken images\n`);
        
        if (brokenImages.length === 0) {
            console.log('✅ No broken images found!');
            return;
        }
        
        // Step 4: Repair broken images
        console.log('🔧 Step 4: Repairing broken images...');
        const results = await repairImages(brokenImages, rawContentMap);
        
        // Step 5: Generate report
        console.log('\n📊 REPAIR REPORT');
        console.log('=================');
        generateRepairReport(results);
        
    } catch (error) {
        console.error('❌ Repair failed:', error);
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
 * Identify broken images by checking S3 content
 */
async function identifyBrokenImages(articles, rawContentMap) {
    const brokenImages = [];
    
    for (const article of articles) {
        const rawContent = rawContentMap[article.rawContentId];
        if (!rawContent || !rawContent.imageUrl) {
            continue;
        }
        
        // Check if any of the processed images are broken
        if (article.images) {
            for (const [imageType, imageData] of Object.entries(article.images)) {
                if (imageData && imageData.url) {
                    const s3Key = extractS3Key(imageData.url);
                    if (s3Key) {
                        const isBroken = await checkIfImageIsBroken(s3Key);
                        if (isBroken) {
                            brokenImages.push({
                                article,
                                rawContent,
                                imageType,
                                imageData,
                                s3Key
                            });
                        }
                    }
                }
            }
        }
    }
    
    return brokenImages;
}

/**
 * Check if an S3 file contains HTML instead of an image
 */
async function checkIfImageIsBroken(s3Key) {
    try {
        // Download a small portion of the file to check its content
        const response = await axios.get(`https://${S3_BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'Range': 'bytes=0-200'
            }
        });
        
        const buffer = Buffer.from(response.data);
        const text = buffer.toString('utf8').toLowerCase();
        
        // If it contains HTML markers, it's broken
        return text.includes('<html') || text.includes('<!doctype') || text.includes('<head>');
    } catch (error) {
        console.warn(`Could not check S3 file ${s3Key}: ${error.message}`);
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
 * Repair broken images
 */
async function repairImages(brokenImages, rawContentMap) {
    const results = {
        total: brokenImages.length,
        repaired: 0,
        failed: 0,
        errors: []
    };
    
    for (const brokenImage of brokenImages) {
        try {
            console.log(`🔧 Repairing ${brokenImage.imageType} for: ${brokenImage.article.title}`);
            
            // Download the original image
            const originalImageBuffer = await downloadOriginalImage(brokenImage.rawContent.imageUrl);
            if (!originalImageBuffer) {
                throw new Error('Failed to download original image');
            }
            
            // Process the image to the required size
            const processedBuffer = await processImageToSize(
                originalImageBuffer,
                brokenImage.imageData.width,
                brokenImage.imageData.height,
                brokenImage.imageType
            );
            
            // Upload to S3
            const uploadSuccess = await uploadToS3(processedBuffer, brokenImage.s3Key);
            if (!uploadSuccess) {
                throw new Error('Failed to upload to S3');
            }
            
            console.log(`   ✅ Repaired ${brokenImage.imageType}`);
            results.repaired++;
            
        } catch (error) {
            console.error(`   ❌ Failed to repair ${brokenImage.imageType}: ${error.message}`);
            results.failed++;
            results.errors.push({
                article: brokenImage.article.title,
                imageType: brokenImage.imageType,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * Download original image from ESA
 */
async function downloadOriginalImage(imageUrl) {
    try {
        console.log(`   📥 Downloading from: ${imageUrl}`);
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Infinite-Repair-Bot/1.0'
            }
        });
        
        const buffer = Buffer.from(response.data);
        
        // Validate it's actually an image
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}`);
        }
        
        // Check for HTML content
        const firstBytes = buffer.slice(0, 200);
        const text = firstBytes.toString('utf8').toLowerCase();
        if (text.includes('<html') || text.includes('<!doctype')) {
            throw new Error('Downloaded content is HTML, not an image');
        }
        
        console.log(`   ✅ Downloaded ${buffer.length} bytes`);
        return buffer;
    } catch (error) {
        console.error(`   ❌ Download failed: ${error.message}`);
        return null;
    }
}

/**
 * Process image to specific size
 */
async function processImageToSize(imageBuffer, width, height, imageType) {
    try {
        if (!sharp) {
            console.warn('   ⚠️  Sharp not available, returning original buffer');
            return imageBuffer;
        }
        
        const processedBuffer = await sharp(imageBuffer)
            .resize(width, height, {
                fit: 'cover',
                position: 'center'
            })
            .webp({
                quality: 85,
                effort: 6
            })
            .toBuffer();
            
        console.log(`   ✅ Processed to ${width}x${height}`);
        return processedBuffer;
    } catch (error) {
        console.error(`   ❌ Processing failed: ${error.message}`);
        return imageBuffer; // Return original as fallback
    }
}

/**
 * Upload processed image to S3
 */
async function uploadToS3(imageBuffer, s3Key) {
    try {
        const uploadParams = {
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: imageBuffer,
            ContentType: 'image/webp',
            CacheControl: 'max-age=31536000',
            Metadata: {
                'repaired-by': 'infinite-repair-script',
                'repaired-at': new Date().toISOString()
            }
        };
        
        await s3.send(new PutObjectCommand(uploadParams));
        console.log(`   ✅ Uploaded to S3: ${s3Key}`);
        return true;
    } catch (error) {
        console.error(`   ❌ Upload failed: ${error.message}`);
        return false;
    }
}

/**
 * Generate repair report
 */
function generateRepairReport(results) {
    console.log(`Total Images Checked: ${results.total}`);
    console.log(`Successfully Repaired: ${results.repaired}`);
    console.log(`Failed to Repair: ${results.failed}`);
    
    if (results.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        results.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error.article} (${error.imageType}): ${error.error}`);
        });
    }
    
    if (results.repaired > 0) {
        console.log('\n✅ Repair completed successfully!');
        console.log('   All repaired images should now be accessible.');
    }
}

// Run repair
if (require.main === module) {
    repairESAImages();
}

module.exports = { repairESAImages };
