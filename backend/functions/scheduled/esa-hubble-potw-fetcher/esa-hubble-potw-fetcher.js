const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Parser = require('rss-parser');
const { v4: uuidv4 } = require('uuid');

// Environment configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = `InfiniteApodArchive-${ENVIRONMENT}`;
const RSS_FEED_URL = 'https://feeds.feedburner.com/esahubble/images/potw/';

// Initialize DynamoDB client
const REGION = process.env.AWS_REGION || 'eu-central-1';
const dynamodb = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamodb);

// Initialize RSS parser
const parser = new Parser({
    customFields: {
        item: ['content:encoded']
    }
});

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
    console.log('ESA Hubble POTW Fetcher started');
    console.log('Environment:', ENVIRONMENT);
    console.log('Raw Content Table:', RAW_CONTENT_TABLE);
    
    try {
        const results = await fetchAndProcessFeed();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'ESA Hubble POTW fetch completed successfully',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error in ESA Hubble POTW fetcher:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to fetch ESA Hubble POTW content',
                details: error.message
            })
        };
    }
};

/**
 * Fetch and process the RSS feed
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
 * Process individual feed item
 */
async function processFeedItem(item) {
    console.log('Processing item:', item.title);
    
    // Extract image URL - prefer enclosure URL over content:encoded
    let imageUrl = null;
    
    // First try enclosure tag (most reliable)
    if (item.enclosure && item.enclosure.url) {
        imageUrl = item.enclosure.url;
        console.log('Using enclosure URL:', imageUrl);
    } else {
        // Fallback to extracting from content:encoded
        imageUrl = extractImageUrl(item['content:encoded']);
        console.log('Extracted from content:', imageUrl);
    }
    
    // Generate date string for contentId
    const dateStr = new Date(item.pubDate).toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Create content object
    const content = {
        contentId: `esa-hubble-potw-${dateStr}-${uuidv4()}`,
        title: item.title,
        description: item.contentSnippet || item.content || '',
        explanation: item.contentSnippet || item.content || '',
        url: item.link,
        imageUrl: imageUrl,
        date: new Date(item.pubDate).toISOString(),
        source: 'esa-hubble-potw',
        category: 'tyzdenny-vyber',
        mediaType: 'image',
        guid: item.guid || item.link,
        status: 'raw',
        environment: ENVIRONMENT,
        fetchedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Check for duplicates
    const isDuplicate = await checkForDuplicate(content.guid, content.title, content.date);
    
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
 * Extract image URL from HTML content
 */
function extractImageUrl(htmlContent) {
    if (!htmlContent) return null;
    
    try {
        // Look for img tags in the HTML content
        const imgMatch = htmlContent.match(/<img[^>]+src="([^"]+)"/i);
        if (imgMatch && imgMatch[1]) {
            let imageUrl = imgMatch[1];
            
            // Handle relative URLs
            if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
                imageUrl = 'https://esahubble.org' + imageUrl;
            }
            
            return imageUrl;
        }
        
        // Fallback: look for any URL that looks like an image
        const urlMatch = htmlContent.match(/https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|gif|webp)/i);
        if (urlMatch) {
            return urlMatch[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting image URL:', error);
        return null;
    }
}

/**
 * Check for duplicate content using GUID
 */
async function checkForDuplicate(guid, title, date) {
    try {
        const params = {
            TableName: RAW_CONTENT_TABLE,
            IndexName: 'guid-index',
            KeyConditionExpression: 'guid = :guid',
            ExpressionAttributeValues: {
                ':guid': guid
            }
        };
        
        const result = await docClient.send(new QueryCommand(params));
        
        if (result.Items && result.Items.length > 0) {
            console.log('Found duplicate by GUID:', guid);
            return true;
        }
        
        // Also check by title and date as fallback
        const titleDateParams = {
            TableName: RAW_CONTENT_TABLE,
            IndexName: 'source-date-index',
            KeyConditionExpression: '#source = :source AND #date = :date',
            FilterExpression: 'title = :title',
            ExpressionAttributeNames: {
                '#source': 'source',
                '#date': 'date'
            },
            ExpressionAttributeValues: {
                ':source': 'esa-hubble-potw',
                ':date': date,
                ':title': title
            }
        };
        
        const titleDateResult = await docClient.send(new QueryCommand(titleDateParams));
        
        if (titleDateResult.Items && titleDateResult.Items.length > 0) {
            console.log('Found duplicate by title and date:', title);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Error checking for duplicates:', error);
        // If GSI is not ready, assume it's not a duplicate to avoid missing content
        return false;
    }
}

/**
 * Store raw content in DynamoDB
 */
async function storeRawContent(content) {
    try {
        const params = {
            TableName: RAW_CONTENT_TABLE,
            Item: content
        };
        
        await docClient.send(new PutCommand(params));
        console.log('Raw content stored successfully:', content.contentId);
        
    } catch (error) {
        console.error('Error storing raw content:', error);
        throw new Error('Failed to store raw content');
    }
}

/**
 * Test function for manual invocation
 */
async function testHandler() {
    console.log('Running ESA Hubble POTW Fetcher test...');
    
    try {
        const result = await fetchAndProcessFeed();
        console.log('Test completed successfully:', result);
        return result;
    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    }
}

// Export for testing
module.exports = {
    handler: exports.handler,
    testHandler,
    fetchAndProcessFeed,
    processFeedItem,
    extractImageUrl,
    checkForDuplicate,
    storeRawContent
};
