const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const Parser = require('rss-parser');
const crypto = require('crypto');

// Environment configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || `InfiniteRawContent-${ENVIRONMENT}`;
const RSS_FEED_URL = 'https://www.nasa.gov/news-release/feed/';

// Initialize DynamoDB client
const REGION = process.env.AWS_REGION || 'eu-central-1';
console.log('Initializing DynamoDB client with region:', REGION);
const dynamodb = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamodb);

// Initialize RSS parser with custom fields for NASA
const parser = new Parser({
    customFields: {
        item: ['content:encoded', 'dc:creator', 'dc:date', 'media:content', 'media:credit']
    }
});

/**
 * Main Lambda handler for NASA RSS fetcher
 */
exports.handler = async (event) => {
    console.log('NASA RSS Fetcher started');
    console.log('Environment:', ENVIRONMENT);
    console.log('Raw Content Table:', RAW_CONTENT_TABLE);
    console.log('RSS Feed URL:', RSS_FEED_URL);
    
    try {
        const results = await fetchAndProcessFeed();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'NASA RSS fetch completed successfully',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error in NASA RSS fetcher:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to fetch NASA RSS content',
                details: error.message
            })
        };
    }
};

/**
 * Fetch and process the NASA RSS feed
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
            skippedNoImage: 0,
            skippedNotNews: 0,
            errors: []
        };
        
        // Process each item in the feed
        for (const item of feed.items) {
            try {
                // Check if item should be processed (news + has image)
                const shouldProcess = shouldProcessItem(item);
                
                if (shouldProcess) {
                    const processed = await processFeedItem(item);
                    if (processed.isNew) {
                        results.newItems++;
                    } else {
                        results.skippedItems++;
                    }
                } else {
                    // Determine why item was skipped
                    const hasImage = checkIfItemHasImage(item);
                    if (!hasImage) {
                        console.log(`Skipping item without image: ${item.title}`);
                        results.skippedNoImage++;
                    } else {
                        console.log(`Skipping non-news item: ${item.title}`);
                        results.skippedNotNews++;
                    }
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
        console.log(`📊 Summary: ${results.newItems} new items, ${results.skippedItems} skipped total`);
        console.log(`   - Skipped (no image): ${results.skippedNoImage}`);
        console.log(`   - Skipped (not news): ${results.skippedNotNews}`);
        console.log(`   - Errors: ${results.errors.length}`);
        return results;
        
    } catch (error) {
        console.error('Error fetching RSS feed:', error);
        throw new Error(`Failed to fetch RSS feed: ${error.message}`);
    }
}

/**
 * Determine if an item should be processed (news releases and discovery alerts only)
 * AND has an image available
 */
function shouldProcessItem(item) {
    const title = (item.title || '').toLowerCase();
    const link = (item.link || '').toLowerCase();
    const description = (item.description || '').toLowerCase();
    
    // Include news releases and discovery alerts
    const includePatterns = [
        'news release',
        'discovery alert',
        'press release',
        'announcement',
        'mission',
        'launch',
        'spacecraft',
        'telescope',
        'planet',
        'exoplanet',
        'black hole',
        'galaxy',
        'solar system',
        'mars',
        'moon',
        'asteroid',
        'comet'
    ];
    
    // Exclude image-only articles and other content types
    const excludePatterns = [
        'image of the day',
        'apod',
        'picture of the day',
        'image article',
        'photo of the day',
        'night sky notes',
        'skywatching',
        'observing',
        'calendar',
        'event',
        'conference',
        'meeting',
        'workshop',
        'symposium'
    ];
    
    // Check if item matches any exclude patterns
    for (const pattern of excludePatterns) {
        if (title.includes(pattern) || link.includes(pattern) || description.includes(pattern)) {
            return false;
        }
    }
    
    // Check if item matches any include patterns
    let matchesIncludePattern = false;
    for (const pattern of includePatterns) {
        if (title.includes(pattern) || link.includes(pattern) || description.includes(pattern)) {
            matchesIncludePattern = true;
            break;
        }
    }
    
    // If no include patterns match, exclude by default
    if (!matchesIncludePattern) {
        return false;
    }
    
    // CRITICAL: Check if item has an image available
    const hasImage = checkIfItemHasImage(item);
    if (!hasImage) {
        console.log(`Skipping item without image: ${item.title}`);
        return false;
    }
    
    return true;
}

/**
 * Check if RSS item has an image available
 */
function checkIfItemHasImage(item) {
    // Method 1: Check media:content field
    if (item['media:content']) {
        const mediaContent = item['media:content'];
        if (typeof mediaContent === 'string') {
            const mediaMatch = mediaContent.match(/url="([^"]+)"/i);
            if (mediaMatch && mediaMatch[1]) {
                console.log(`Found image in media:content: ${mediaMatch[1]}`);
                return true;
            }
        } else if (mediaContent.url) {
            console.log(`Found image in media:content object: ${mediaContent.url}`);
            return true;
        }
    }
    
    // Method 2: Check enclosure field
    if (item.enclosure) {
        const enclosure = item.enclosure;
        if (enclosure.type && enclosure.type.startsWith('image/') && enclosure.url) {
            console.log(`Found image in enclosure: ${enclosure.url}`);
            return true;
        }
    }
    
    // Method 3: Check content:encoded for img tags
    const htmlContent = item['content:encoded'] || item.description || '';
    if (htmlContent) {
        // Look for img tags
        const imgPatterns = [
            /<img[^>]+src="([^"]+)"[^>]*>/i,
            /<img[^>]+src='([^']+)'[^>]*>/i,
            /<picture[^>]*>.*?<img[^>]+src="([^"]+)"[^>]*>.*?<\/picture>/is,
            /<figure[^>]*>.*?<img[^>]+src="([^"]+)"[^>]*>.*?<\/figure>/is
        ];
        
        for (const pattern of imgPatterns) {
            const match = htmlContent.match(pattern);
            if (match && match[1]) {
                console.log(`Found image in HTML content: ${match[1]}`);
                return true;
            }
        }
        
        // Method 4: Check for OpenGraph meta tags
        const ogImageMatch = htmlContent.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"[^>]*>/i);
        if (ogImageMatch && ogImageMatch[1]) {
            console.log(`Found image in OpenGraph meta: ${ogImageMatch[1]}`);
            return true;
        }
        
        // Method 5: Check for Twitter card image
        const twitterImageMatch = htmlContent.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"[^>]*>/i);
        if (twitterImageMatch && twitterImageMatch[1]) {
            console.log(`Found image in Twitter meta: ${twitterImageMatch[1]}`);
            return true;
        }
        
        // Method 6: Check for NASA.gov domain images in links
        const nasaImageMatch = htmlContent.match(/href="(https?:\/\/[^"]*nasa\.gov[^"]*\.(jpg|jpeg|png|gif|webp))"/i);
        if (nasaImageMatch && nasaImageMatch[1]) {
            console.log(`Found NASA image link: ${nasaImageMatch[1]}`);
            return true;
        }
    }
    
    console.log(`No image found for item: ${item.title}`);
    return false;
}

/**
 * Process individual NASA feed item
 */
async function processFeedItem(item) {
    console.log('Processing item:', item.title);
    
    // Extract image URL and credit from content:encoded and RSS item
    const imageData = extractImageData(item['content:encoded'] || item.description || '', item);
    
    // Generate content ID
    const contentId = `nasa-news-${crypto.randomUUID()}`;
    
    // Create content object
    const content = {
        contentId: contentId,
        title: item.title || '',
        description: item.contentSnippet || item.description || '',
        explanation: item.contentSnippet || item.description || '',
        url: item.link || '',
        imageUrl: imageData.url || '',
        imageCredit: imageData.credit || '',
        date: new Date(item.pubDate).toISOString(),
        originalDate: new Date(item.pubDate).toISOString().split('T')[0], // YYYY-MM-DD
        source: 'nasa-news',
        category: 'news',
        mediaType: 'image',
        guid: item.guid || item.link || contentId,
        status: 'raw',
        environment: ENVIRONMENT,
        fetchedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Additional NASA specific fields
        author: item['dc:creator'] || item.creator || 'NASA',
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
 * Extract image URL and credit from HTML content and RSS item
 */
function extractImageData(htmlContent, rssItem = null) {
    if (!htmlContent && !rssItem) {
        return { url: '', credit: '' };
    }
    
    try {
        let imageUrl = '';
        let credit = '';
        
        // Method 1: Check RSS media:content field first (highest priority)
        if (rssItem && rssItem['media:content']) {
            const mediaContent = rssItem['media:content'];
            if (typeof mediaContent === 'string') {
                // Parse media:content URL
                const mediaMatch = mediaContent.match(/url="([^"]+)"/i);
                if (mediaMatch) {
                    imageUrl = mediaMatch[1];
                }
            } else if (mediaContent.url) {
                imageUrl = mediaContent.url;
            }
            
            // Get credit from media:credit
            if (rssItem['media:credit']) {
                credit = rssItem['media:credit'];
            }
        }
        
        // Method 2: Check RSS enclosure field
        if (!imageUrl && rssItem && rssItem.enclosure) {
            const enclosure = rssItem.enclosure;
            if (enclosure.type && enclosure.type.startsWith('image/') && enclosure.url) {
                imageUrl = enclosure.url;
            }
        }
        
        // Method 3: Extract from HTML content (original method)
        if (!imageUrl && htmlContent) {
            // Look for img tags with various patterns
            const imgPatterns = [
                /<img[^>]+src="([^"]+)"[^>]*>/i,
                /<img[^>]+src='([^']+)'[^>]*>/i,
                /<picture[^>]*>.*?<img[^>]+src="([^"]+)"[^>]*>.*?<\/picture>/is,
                /<figure[^>]*>.*?<img[^>]+src="([^"]+)"[^>]*>.*?<\/figure>/is
            ];
            
            for (const pattern of imgPatterns) {
                const match = htmlContent.match(pattern);
                if (match && match[1]) {
                    imageUrl = match[1];
                    break;
                }
            }
            
            // Method 4: Look for OpenGraph meta tags
            if (!imageUrl) {
                const ogImageMatch = htmlContent.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"[^>]*>/i);
                if (ogImageMatch) {
                    imageUrl = ogImageMatch[1];
                }
            }
            
            // Method 5: Look for Twitter card image
            if (!imageUrl) {
                const twitterImageMatch = htmlContent.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"[^>]*>/i);
                if (twitterImageMatch) {
                    imageUrl = twitterImageMatch[1];
                }
            }
            
            // Method 6: Look for NASA.gov domain images in links
            if (!imageUrl) {
                const nasaImageMatch = htmlContent.match(/href="(https?:\/\/[^"]*nasa\.gov[^"]*\.(jpg|jpeg|png|gif|webp))"/i);
                if (nasaImageMatch) {
                    imageUrl = nasaImageMatch[1];
                }
            }
        }
        
        // Extract credit if not already found
        if (!credit && htmlContent) {
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
            
            // Pattern 4: NASA/JPL-Caltech style credits
            const creditMatch4 = htmlContent.match(/(NASA\/[^<>\n]+)/i);
            if (creditMatch4) {
                credit = creditMatch4[1].trim();
            }
            
            // Pattern 5: Look for photographer/author in alt text or nearby text
            if (!credit && imageUrl) {
                const imgTagMatch = htmlContent.match(/<img[^>]+alt="([^"]+)"[^>]*>/i);
                if (imgTagMatch) {
                    const altText = imgTagMatch[1];
                    // Check if alt text contains photographer info
                    if (altText.includes('credit') || altText.includes('photo') || altText.includes('NASA')) {
                        credit = altText;
                    }
                }
            }
        }
        
        // Clean up image URL
        if (imageUrl) {
            // Remove query parameters that might cause issues
            imageUrl = imageUrl.split('?')[0];
            
            // Ensure it's a valid URL
            try {
                new URL(imageUrl);
            } catch (e) {
                console.warn(`Invalid image URL extracted: ${imageUrl}`);
                imageUrl = '';
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
 * Check for duplicate content using guid and title+date
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
                ':source': 'nasa-news',
                ':date': date,
                ':title': title
            }
        };
        
        const titleResult = await docClient.send(new QueryCommand(titleDateQuery));
        
        if (titleResult.Items && titleResult.Items.length > 0) {
            console.log(`Found duplicate by title and date: ${title}`);
            return true;
        }
        
        // Also check by GUID using scan
        const guidQuery = {
            TableName: RAW_CONTENT_TABLE,
            FilterExpression: 'guid = :guid AND #source = :source',
            ExpressionAttributeNames: {
                '#source': 'source'
            },
            ExpressionAttributeValues: {
                ':guid': guid,
                ':source': 'nasa-news'
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
