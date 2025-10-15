const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const Parser = require('rss-parser');
const { v4: uuidv4 } = require('uuid');

// Environment configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || `InfiniteRawContent-${ENVIRONMENT}`;
const RSS_FEED_URL = 'https://www.space.com/feeds/all';

// Initialize DynamoDB client
const REGION = process.env.AWS_REGION || 'eu-central-1';
console.log('Initializing DynamoDB client with region:', REGION);
const dynamodb = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamodb);

// Initialize RSS parser with custom fields for Space.com
const parser = new Parser({
    customFields: {
        item: ['content:encoded', 'dc:creator', 'dc:date', 'media:content', 'media:credit']
    }
});

/**
 * Main Lambda handler for Space.com RSS fetcher
 */
exports.handler = async (event) => {
    console.log('Space.com RSS Fetcher started');
    console.log('Environment:', ENVIRONMENT);
    console.log('Raw Content Table:', RAW_CONTENT_TABLE);
    console.log('RSS Feed URL:', RSS_FEED_URL);
    
    try {
        const results = await fetchAndProcessFeed();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Space.com RSS fetch completed successfully',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error in Space.com RSS fetcher:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to fetch Space.com RSS content',
                details: error.message
            })
        };
    }
};

/**
 * Fetch and process the Space.com RSS feed
 */
async function fetchAndProcessFeed() {
    console.log('Fetching RSS feed from:', RSS_FEED_URL);
    
    try {
        const feed = await parser.parseURL(RSS_FEED_URL);
        console.log(`Feed parsed successfully. Found ${feed.items.length} items`);
        
        const results = {
            totalItems: feed.items.length,
            newItems: 0,
            skippedItems: 0,
            errors: []
        };
        
        // Process each item in the feed
        for (const item of feed.items) {
            try {
                const processed = await processFeedItem(item);
                if (processed.isNew) {
                    results.newItems++;
                } else {
                    results.skippedItems++;
                }
            } catch (itemError) {
                console.error('Error processing item:', item.title, itemError);
                results.errors.push({
                    title: item.title,
                    error: itemError.message
                });
            }
        }
        
        console.log('Feed processing completed:', results);
        return results;
        
    } catch (error) {
        console.error('Error fetching RSS feed:', error);
        throw new Error(`Failed to fetch RSS feed: ${error.message}`);
    }
}

/**
 * Process individual Space.com feed item
 */
async function processFeedItem(item) {
    console.log('Processing item:', item.title);
    
    // Extract image URL and credit from content:encoded
    const imageData = extractImageData(item['content:encoded']);
    
    // Generate content ID
    const contentId = `space-com-${uuidv4()}`;
    
    // Create content object
    const content = {
        contentId: contentId,
        title: item.title || '',
        description: item.contentSnippet || item.content || '',
        explanation: item.contentSnippet || item.content || '',
        url: item.link || '',
        imageUrl: imageData.url || '',
        imageCredit: imageData.credit || '',
        date: new Date(item.pubDate).toISOString(),
        originalDate: new Date(item.pubDate).toISOString().split('T')[0], // YYYY-MM-DD
        source: 'space-com',
        category: 'news',
        mediaType: 'image',
        guid: item.guid || item.link || contentId,
        status: 'raw',
        environment: ENVIRONMENT,
        fetchedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Additional Space.com specific fields
        author: item['dc:creator'] || item.creator || '',
        contentHtml: item['content:encoded'] || item.content || '',
        pubDate: item.pubDate || '',
        
        // Media fields
        mediaContent: item['media:content'] || '',
        mediaCredit: item['media:credit'] || ''
    };
    
    // Check for duplicates
    const isDuplicate = await checkForDuplicate(content.guid, content.title, content.originalDate);
    
    if (isDuplicate) {
        console.log('Skipping duplicate item:', content.title);
        return { isNew: false, content: null };
    }
    
    // Store the content
    await storeRawContent(content);
    console.log('Stored new content:', content.title);
    
    return { isNew: true, content: content };
}

/**
 * Extract image URL and credit from HTML content
 */
function extractImageData(htmlContent) {
    if (!htmlContent) {
        return { url: '', credit: '' };
    }
    
    try {
        // Look for img tags
        const imgMatch = htmlContent.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
        const imageUrl = imgMatch ? imgMatch[1] : '';
        
        // Look for image credit in various formats
        let credit = '';
        
        // Pattern 1: Image credit: Author Name
        const creditMatch1 = htmlContent.match(/Image credit:\s*([^<>\n]+)/i);
        if (creditMatch1) {
            credit = creditMatch1[1].trim();
        }
        
        // Pattern 2: (Image credit: Author Name)
        const creditMatch2 = htmlContent.match(/\(Image credit:\s*([^)]+)\)/i);
        if (creditMatch2) {
            credit = creditMatch2[1].trim();
        }
        
        // Pattern 3: Credit: Author Name
        const creditMatch3 = htmlContent.match(/Credit:\s*([^<>\n]+)/i);
        if (creditMatch3) {
            credit = creditMatch3[1].trim();
        }
        
        // Pattern 4: Look for photographer/author in alt text or nearby text
        if (!credit && imgMatch) {
            const imgTag = imgMatch[0];
            const altMatch = imgTag.match(/alt="([^"]+)"/i);
            if (altMatch) {
                const altText = altMatch[1];
                // Check if alt text contains photographer info
                if (altText.includes('credit') || altText.includes('photo')) {
                    credit = altText;
                }
            }
        }
        
        console.log(`Extracted image data - URL: ${imageUrl}, Credit: ${credit}`);
        return { url: imageUrl, credit: credit };
        
    } catch (error) {
        console.error('Error extracting image data:', error.message);
        return { url: '', credit: '' };
    }
}

/**
 * Check for duplicate content using guid-index GSI
 */
async function checkForDuplicate(guid, title, date) {
    try {
        // Check by title and date using source-date-index GSI
        const titleDateQuery = {
            TableName: RAW_CONTENT_TABLE,
            IndexName: 'source-date-index',
            KeyConditionExpression: '#source = :source AND #date = :date',
            FilterExpression: 'title = :title',
            ExpressionAttributeNames: {
                '#source': 'source',
                '#date': 'date'
            },
            ExpressionAttributeValues: {
                ':source': 'space-com',
                ':date': date,
                ':title': title
            }
        };
        
        const titleResult = await docClient.send(new QueryCommand(titleDateQuery));
        
        if (titleResult.Items && titleResult.Items.length > 0) {
            console.log(`Found duplicate by title and date: ${title}`);
            return true;
        }
        
        // Also check by GUID using scan (since guid-index GSI doesn't exist)
        const guidQuery = {
            TableName: RAW_CONTENT_TABLE,
            FilterExpression: 'guid = :guid AND #source = :source',
            ExpressionAttributeNames: {
                '#source': 'source'
            },
            ExpressionAttributeValues: {
                ':guid': guid,
                ':source': 'space-com'
            }
        };
        
        const guidResult = await docClient.send(new ScanCommand(guidQuery));
        
        if (guidResult.Items && guidResult.Items.length > 0) {
            console.log(`Found duplicate by GUID: ${guid}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking for duplicates:', error.message);
        // If error, assume not duplicate to avoid missing content
        return false;
    }
}

/**
 * Store raw content in DynamoDB
 */
async function storeRawContent(content) {
    try {
        const putParams = {
            TableName: RAW_CONTENT_TABLE,
            Item: content
        };
        
        await docClient.send(new PutCommand(putParams));
        console.log(`Successfully stored content: ${content.contentId}`);
    } catch (error) {
        console.error('Error storing raw content:', error.message);
        throw new Error(`Failed to store content: ${error.message}`);
    }
}
