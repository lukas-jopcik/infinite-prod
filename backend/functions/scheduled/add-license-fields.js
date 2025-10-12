const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamodb = new DynamoDBClient({ region: 'eu-central-1' });
const TABLE_NAME = 'InfiniteArticles-dev';

/**
 * Get license information based on article source
 */
function getLicenseInfo(source) {
    if (!source) {
        console.log('No source provided, skipping license info');
        return null;
    }

    const sourceLower = source.toLowerCase();

    // NASA APOD articles
    if (sourceLower === 'apod-rss' || sourceLower === 'apod') {
        return {
            imageLicense: 'Public Domain',
            imageCreditText: 'Image Credit: NASA APOD',
            imageCopyrightNotice: 'Public Domain - NASA',
            imageAcquireLicensePage: 'https://apod.nasa.gov/apod/',
            imageSource: 'nasa-apod',
            imagePhotographer: 'NASA',
            imagePhotographerUrl: 'https://www.nasa.gov/'
        };
    }
    
    // ESA Hubble articles
    if (sourceLower === 'esa-hubble-potw' || sourceLower.includes('esa')) {
        return {
            imageLicense: 'ESA License',
            imageCreditText: 'Image Credit: ESA/Hubble',
            imageCopyrightNotice: '© ESA/Hubble',
            imageAcquireLicensePage: 'https://www.spacetelescope.org/',
            imageSource: 'esa-hubble',
            imagePhotographer: 'ESA/Hubble',
            imagePhotographerUrl: 'https://www.spacetelescope.org/'
        };
    }
    
    // Pexels/Reddit community articles
    if (sourceLower.includes('reddit') || sourceLower.includes('pexels')) {
        return {
            imageLicense: 'Pexels License',
            imageCreditText: 'Photo by Pexels Contributor on Pexels',
            imageCopyrightNotice: '© Pexels Contributor / Pexels',
            imageAcquireLicensePage: 'https://www.pexels.com/',
            imageSource: 'pexels',
            imagePhotographer: 'Pexels Contributor',
            imagePhotographerUrl: 'https://www.pexels.com/'
        };
    }

    console.log(`Unknown source: ${source}, skipping license info`);
    return null;
}

/**
 * Update article with license information
 */
async function updateArticleLicense(articleId, type, source, licenseInfo) {
    if (!licenseInfo) {
        console.log(`Skipping article ${articleId} - no license info for source: ${source}`);
        return false;
    }

    try {
        const updateParams = {
            TableName: TABLE_NAME,
            Key: {
                articleId: { S: articleId },
                type: { S: type }
            },
            UpdateExpression: 'SET imageLicense = :license, imageCreditText = :credit, imageCopyrightNotice = :copyright, imageAcquireLicensePage = :acquire, imageSource = :imgSource, imagePhotographer = :photographer, imagePhotographerUrl = :photographerUrl',
            ExpressionAttributeValues: {
                ':license': { S: licenseInfo.imageLicense },
                ':credit': { S: licenseInfo.imageCreditText },
                ':copyright': { S: licenseInfo.imageCopyrightNotice },
                ':acquire': { S: licenseInfo.imageAcquireLicensePage },
                ':imgSource': { S: licenseInfo.imageSource },
                ':photographer': { S: licenseInfo.imagePhotographer },
                ':photographerUrl': { S: licenseInfo.imagePhotographerUrl }
            },
            ReturnValues: 'UPDATED_NEW'
        };

        const result = await dynamodb.send(new UpdateItemCommand(updateParams));
        console.log(`✅ Updated article ${articleId} (source: ${source}) with license info`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to update article ${articleId}:`, error.message);
        return false;
    }
}

/**
 * Migrate all articles to add license fields
 */
async function migrateAllArticles() {
    console.log('🚀 Starting license fields migration...');
    
    let totalScanned = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let lastEvaluatedKey = null;

    try {
        do {
            // Scan articles in batches
            const scanParams = {
                TableName: TABLE_NAME,
                ProjectionExpression: 'articleId, #type, #src',
                ExpressionAttributeNames: {
                    '#type': 'type',
                    '#src': 'source'
                },
                Limit: 25 // Process in smaller batches
            };

            if (lastEvaluatedKey) {
                scanParams.ExclusiveStartKey = lastEvaluatedKey;
            }

            const scanResult = await dynamodb.send(new ScanCommand(scanParams));
            const articles = scanResult.Items || [];
            
            console.log(`📄 Processing batch of ${articles.length} articles...`);
            totalScanned += articles.length;

            // Process each article in the batch
            for (const article of articles) {
                const articleId = article.articleId?.S;
                const type = article.type?.S;
                const source = article.source?.S;

                if (!articleId || !type) {
                    console.log('⚠️ Article missing articleId or type, skipping');
                    totalSkipped++;
                    continue;
                }

                const licenseInfo = getLicenseInfo(source);
                const updated = await updateArticleLicense(articleId, type, source, licenseInfo);
                
                if (updated) {
                    totalUpdated++;
                } else {
                    totalSkipped++;
                }

                // Small delay to avoid throttling
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            lastEvaluatedKey = scanResult.LastEvaluatedKey;
            
            if (lastEvaluatedKey) {
                console.log(`📊 Progress: ${totalScanned} scanned, ${totalUpdated} updated, ${totalSkipped} skipped`);
            }

        } while (lastEvaluatedKey);

        console.log('🎉 Migration completed!');
        console.log(`📊 Final results:`);
        console.log(`   - Total articles scanned: ${totalScanned}`);
        console.log(`   - Total articles updated: ${totalUpdated}`);
        console.log(`   - Total articles skipped: ${totalSkipped}`);

        return {
            success: true,
            totalScanned,
            totalUpdated,
            totalSkipped
        };

    } catch (error) {
        console.error('❌ Migration failed:', error);
        return {
            success: false,
            error: error.message,
            totalScanned,
            totalUpdated,
            totalSkipped
        };
    }
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
    console.log('License fields migration Lambda started');
    console.log('Event:', JSON.stringify(event, null, 2));

    const result = await migrateAllArticles();
    
    return {
        statusCode: result.success ? 200 : 500,
        body: JSON.stringify(result)
    };
};

// For local testing
if (require.main === module) {
    migrateAllArticles()
        .then(result => {
            console.log('Local test completed:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Local test failed:', error);
            process.exit(1);
        });
}
