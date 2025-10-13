const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS services
const client = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

// Configuration
const REGION = process.env.REGION || 'eu-central-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const ARTICLES_TABLE = process.env.DYNAMODB_ARTICLES_TABLE || 'InfiniteArticles-dev';

/**
 * Main Lambda handler for Articles API
 */
exports.handler = async (event) => {
    console.log('Articles API Lambda invoked:', JSON.stringify(event, null, 2));
    
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight' })
        };
    }
    
    try {
        const path = event.path || '';
        const httpMethod = event.httpMethod || 'GET';
        
        // Route handling
        if (path === '/articles' && httpMethod === 'GET') {
            return await getAllArticles(headers, event.queryStringParameters);
        } else if (path === '/articles/latest' && httpMethod === 'GET') {
            return await getLatestArticles(headers, event.queryStringParameters);
        } else if (path.startsWith('/articles/slug/') && httpMethod === 'GET') {
            const slug = path.split('/')[3];
            return await getArticleBySlug(slug, headers);
        } else if (path.startsWith('/articles/category/') && httpMethod === 'GET') {
            const category = path.split('/')[3];
            return await getArticlesByCategory(category, headers, event.queryStringParameters);
        } else if (path.startsWith('/articles/search') && httpMethod === 'GET') {
            return await searchArticles(headers, event.queryStringParameters);
        } else if (path.startsWith('/articles/') && httpMethod === 'GET') {
            const articleId = path.split('/')[2];
            return await getArticleById(articleId, headers);
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Not found' })
            };
        }
        
    } catch (error) {
        console.error('Error in Articles API:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

/**
 * Get all articles with pagination - optimized with GSI
 */
async function getAllArticles(headers, queryParams) {
    const limit = parseInt(queryParams?.limit) || 20;
    const lastKey = queryParams?.lastKey ? JSON.parse(decodeURIComponent(queryParams.lastKey)) : null;
    
    try {
        // Use scan to get all published articles
        const params = {
            TableName: ARTICLES_TABLE,
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'published' // Only get published articles
            },
            Limit: limit
        };
        
        if (lastKey) {
            params.ExclusiveStartKey = lastKey;
        }
        
        let result;
        try {
            result = await dynamodb.send(new ScanCommand(params));
        } catch (scanError) {
            console.log('Scan failed, trying basic scan:', scanError.message);
            // Fallback to basic scan
            const basicScanParams = {
                TableName: ARTICLES_TABLE,
                Limit: limit
            };
            
            if (lastKey) {
                basicScanParams.ExclusiveStartKey = lastKey;
            }
            
            result = await dynamodb.send(new ScanCommand(basicScanParams));
        }
        
        // Transform the data for frontend and sort by originalDate
        const articles = result.Items
            .map(item => {
                const imageUrl = item.imageUrl || item.images?.heroImage?.url || item.images?.cardImage?.url || item.images?.ogImage?.url;
                return {
                    id: item.articleId,
                    title: item.title,
                    slug: item.slug,
                    perex: item.perex,
                    category: item.category || 'discovery',
                    publishedAt: item.originalDate || item.publishedAt, // Use originalDate if available, fallback to publishedAt
                    originalDate: item.originalDate,
                    author: item.author,
                    readingTime: item.estimatedReadingTime,
                    imageUrl: imageUrl,
                    image: imageUrl, // Add image field for frontend compatibility
                    imageAlt: item.metaTitle || item.title, // Add imageAlt for accessibility
                    metaTitle: item.metaTitle,
                    metaDescription: item.metaDescription,
                    type: item.type,
                    source: item.source,
                    sourceUrl: item.sourceUrl,
                    // Image license fields
                    imageLicense: item.imageLicense,
                    imageCreditText: item.imageCreditText,
                    imageCopyrightNotice: item.imageCopyrightNotice,
                    imageAcquireLicensePage: item.imageAcquireLicensePage,
                    imageSource: item.imageSource,
                    imagePhotographer: item.imagePhotographer,
                    imagePhotographerUrl: item.imagePhotographerUrl
                };
            })
            .sort((a, b) => new Date(b.originalDate || b.publishedAt) - new Date(a.originalDate || a.publishedAt));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                articles,
                lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
                count: articles.length,
                total: result.Count
            })
        };
        
    } catch (error) {
        console.error('Error getting all articles:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

/**
 * Get article by ID
 */
async function getArticleById(articleId, headers) {
    const params = {
        TableName: ARTICLES_TABLE,
        Key: {
            articleId: articleId,
            type: 'discovery' // Assuming all articles are discovery type for now
        }
    };
    
        const result = await dynamodb.send(new GetCommand(params));
    
    if (!result.Item) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Article not found' })
        };
    }
    
    // Transform the data for frontend
    const article = {
        id: result.Item.articleId,
        title: result.Item.title,
        slug: result.Item.slug,
        perex: result.Item.perex,
        content: result.Item.content, // This contains the sections array
        sections: result.Item.content, // Alias for clarity
        faq: result.Item.faq,
        category: result.Item.category || 'discovery',
        publishedAt: result.Item.originalDate || result.Item.publishedAt, // Use originalDate if available, fallback to publishedAt
        originalDate: result.Item.originalDate,
        author: result.Item.author,
        readingTime: result.Item.estimatedReadingTime,
        images: result.Item.images,
        imageUrl: result.Item.imageUrl || result.Item.images?.heroImage?.url || result.Item.images?.cardImage?.url || result.Item.images?.ogImage?.url,
        metaTitle: result.Item.metaTitle,
        metaDescription: result.Item.metaDescription,
        keywords: result.Item.keywords,
        type: result.Item.type,
        source: result.Item.source,
        sourceUrl: result.Item.sourceUrl,
        // Image license fields
        imageLicense: result.Item.imageLicense,
        imageCreditText: result.Item.imageCreditText,
        imageCopyrightNotice: result.Item.imageCopyrightNotice,
        imageAcquireLicensePage: result.Item.imageAcquireLicensePage,
        imageSource: result.Item.imageSource,
        imagePhotographer: result.Item.imagePhotographer,
        imagePhotographerUrl: result.Item.imagePhotographerUrl
    };
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ article })
    };
}

/**
 * Get latest articles - optimized with GSI
 */
async function getLatestArticles(headers, queryParams) {
    const limit = parseInt(queryParams?.limit) || 10;
    
    try {
        // Get articles from both types (discovery and weekly-pick) using separate queries
        const discoveryParams = {
            TableName: ARTICLES_TABLE,
            IndexName: 'type-originalDate-index',
            KeyConditionExpression: '#type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':type': 'discovery'
            },
            ScanIndexForward: false, // Sort by originalDate descending (newest first)
            Limit: limit
        };
        
        const weeklyPickParams = {
            TableName: ARTICLES_TABLE,
            IndexName: 'type-originalDate-index',
            KeyConditionExpression: '#type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':type': 'weekly-pick'
            },
            ScanIndexForward: false,
            Limit: limit
        };
        
        let discoveryResult, weeklyPickResult;
        try {
            // Execute both queries in parallel
            [discoveryResult, weeklyPickResult] = await Promise.all([
                dynamodb.send(new QueryCommand(discoveryParams)),
                dynamodb.send(new QueryCommand(weeklyPickParams))
            ]);
        } catch (gsiError) {
            console.log('GSI not ready, falling back to scan:', gsiError.message);
            // Fallback to scan if GSI is not ready
            const scanParams = {
                TableName: ARTICLES_TABLE,
                FilterExpression: '#type = :type1 OR #type = :type2',
                ExpressionAttributeNames: {
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':type1': 'discovery',
                    ':type2': 'weekly-pick'
                },
                Limit: limit * 2 // Get more items since we're filtering
            };
            
            const scanResult = await dynamodb.send(new ScanCommand(scanParams));
            discoveryResult = { Items: scanResult.Items.filter(item => item.type === 'discovery') };
            weeklyPickResult = { Items: scanResult.Items.filter(item => item.type === 'weekly-pick') };
        }
        
        // Combine and sort results by originalDate
        const allItems = [...(discoveryResult.Items || []), ...(weeklyPickResult.Items || [])];
        allItems.sort((a, b) => {
            const dateA = new Date(a.originalDate || a.publishedAt);
            const dateB = new Date(b.originalDate || b.publishedAt);
            return dateB.getTime() - dateA.getTime();
        });
        
        // Limit to requested number
        const result = { Items: allItems.slice(0, limit) };
        
        // Transform the data for frontend
        const articles = result.Items.map(item => {
            const imageUrl = item.imageUrl || item.images?.heroImage?.url || item.images?.cardImage?.url || item.images?.ogImage?.url;
            return {
                id: item.articleId,
                title: item.title,
                slug: item.slug,
                perex: item.perex,
                category: item.category || 'discovery',
                publishedAt: item.originalDate || item.publishedAt, // Use originalDate if available, fallback to publishedAt
                originalDate: item.originalDate,
                author: item.author,
                readingTime: item.estimatedReadingTime,
                imageUrl: imageUrl,
                image: imageUrl, // Add image field for frontend compatibility
                imageAlt: item.metaTitle || item.title, // Add imageAlt for accessibility
                metaTitle: item.metaTitle,
                metaDescription: item.metaDescription,
                type: item.type,
                tags: item.tags || [],
                // Image license fields
                imageLicense: item.imageLicense,
                imageCreditText: item.imageCreditText,
                imageCopyrightNotice: item.imageCopyrightNotice,
                imageAcquireLicensePage: item.imageAcquireLicensePage,
                imageSource: item.imageSource,
                imagePhotographer: item.imagePhotographer,
                imagePhotographerUrl: item.imagePhotographerUrl
            };
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                articles,
                count: articles.length
            })
        };
        
    } catch (error) {
        console.error('Error getting latest articles:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

/**
 * Get article by slug - optimized for direct lookup using GSI
 */
async function getArticleBySlug(slug, headers) {
    console.log('Getting article by slug:', slug);
    
    try {
        // Try GSI first, fallback to scan if GSI is not ready
        let result;
        try {
            // Use GSI (Global Secondary Index) for fast query instead of scan
            const params = {
                TableName: ARTICLES_TABLE,
                IndexName: 'slug-index',
                KeyConditionExpression: 'slug = :slug',
                ExpressionAttributeValues: {
                    ':slug': slug
                },
                Limit: 1 // We only need one result
            };
            
            result = await dynamodb.send(new QueryCommand(params));
        } catch (gsiError) {
            console.log('GSI not ready, falling back to scan:', gsiError.message);
            // Fallback to scan if GSI is not ready
            const scanParams = {
                TableName: ARTICLES_TABLE,
                FilterExpression: 'slug = :slug',
                ExpressionAttributeValues: {
                    ':slug': slug
                },
                Limit: 1 // We only need one result
            };
            
            result = await dynamodb.send(new ScanCommand(scanParams));
        }
        
        if (!result.Items || result.Items.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Article not found' })
            };
        }
        
        const item = result.Items[0];
        
        // Transform the data to match frontend expectations
        const imageUrl = item.imageUrl || item.images?.heroImage?.url || item.images?.cardImage?.url || item.images?.ogImage?.url;
        const article = {
            id: item.articleId,
            title: item.title,
            slug: item.slug,
            perex: item.perex,
            content: item.content,
            sections: item.content,
            faq: item.faq,
            category: item.category || 'discovery',
            publishedAt: item.originalDate || item.publishedAt,
            originalDate: item.originalDate,
            author: item.author,
            readingTime: item.estimatedReadingTime,
            images: item.images,
            imageUrl: imageUrl,
            image: imageUrl, // Add image field for frontend compatibility
            imageAlt: item.metaTitle || item.title, // Add imageAlt for accessibility
            metaTitle: item.metaTitle,
            metaDescription: item.metaDescription,
            keywords: item.keywords,
            type: item.type,
            source: item.source,
            sourceUrl: item.sourceUrl,
            tags: item.tags || [],
            // Image license fields
            imageLicense: item.imageLicense,
            imageCreditText: item.imageCreditText,
            imageCopyrightNotice: item.imageCopyrightNotice,
            imageAcquireLicensePage: item.imageAcquireLicensePage,
            imageSource: item.imageSource,
            imagePhotographer: item.imagePhotographer,
            imagePhotographerUrl: item.imagePhotographerUrl
        };
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(article)
        };
        
    } catch (error) {
        console.error('Error getting article by slug:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

/**
 * Get articles by category with pagination
 */
async function getArticlesByCategory(category, headers, queryParams = {}) {
    try {
        const limit = parseInt(queryParams.limit) || 20;
        const lastKey = queryParams.lastKey ? JSON.parse(decodeURIComponent(queryParams.lastKey)) : null;
        
        console.log(`Getting articles for category: ${category}, limit: ${limit}`);
        
        // Use GSI on category field for efficient querying
        const queryParams_dynamo = {
            TableName: ARTICLES_TABLE,
            IndexName: 'category-originalDate-index', // Use new GSI with originalDate
            KeyConditionExpression: 'category = :category',
            ExpressionAttributeValues: {
                ':category': category
            },
            ScanIndexForward: false, // Sort by originalDate descending (newest first)
            Limit: limit
        };
        
        if (lastKey) {
            queryParams_dynamo.ExclusiveStartKey = lastKey;
        }
        
        let result;
        try {
            result = await dynamodb.send(new QueryCommand(queryParams_dynamo));
        } catch (gsiError) {
            console.log('GSI not ready, falling back to scan:', gsiError.message);
            // Fallback to scan if GSI is not ready
            const scanParams = {
                TableName: ARTICLES_TABLE,
                FilterExpression: 'category = :category',
                ExpressionAttributeValues: {
                    ':category': category
                },
                ScanIndexForward: false,
                Limit: limit
            };
            
            if (lastKey) {
                scanParams.ExclusiveStartKey = lastKey;
            }
            
            result = await dynamodb.send(new ScanCommand(scanParams));
        }
        
        // Transform the data to match frontend expectations
        const articles = result.Items.map(item => {
            const imageUrl = item.imageUrl || item.images?.heroImage?.url || item.images?.cardImage?.url || item.images?.ogImage?.url;
            return {
                id: item.articleId,
                title: item.title,
                slug: item.slug,
                perex: item.perex,
                category: item.category || 'discovery',
                publishedAt: item.originalDate || item.publishedAt,
                originalDate: item.originalDate,
                author: item.author,
                readingTime: item.estimatedReadingTime,
                imageUrl: imageUrl,
                image: imageUrl, // Add image field for frontend compatibility
                imageAlt: item.metaTitle || item.title, // Add imageAlt for accessibility
                metaTitle: item.metaTitle,
                metaDescription: item.metaDescription,
                type: item.type,
                source: item.source,
                sourceUrl: item.sourceUrl,
                tags: item.tags || [],
                // Image license fields
                imageLicense: item.imageLicense,
                imageCreditText: item.imageCreditText,
                imageCopyrightNotice: item.imageCopyrightNotice,
                imageAcquireLicensePage: item.imageAcquireLicensePage,
                imageSource: item.imageSource,
                imagePhotographer: item.imagePhotographer,
                imagePhotographerUrl: item.imagePhotographerUrl
            };
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                articles,
                lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
                count: articles.length,
                total: result.Count
            })
        };
        
    } catch (error) {
        console.error('Error getting articles by category:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

/**
 * Search articles with GSI optimization
 */
async function searchArticles(headers, queryParams) {
    try {
        const query = queryParams?.q || '';
        const limit = parseInt(queryParams?.limit) || 20;
        const lastKey = queryParams?.lastKey ? JSON.parse(decodeURIComponent(queryParams.lastKey)) : null;
        
        if (!query.trim()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Search query is required' })
            };
        }
        
        console.log(`Searching for: "${query}", limit: ${limit}`);
        
        // Use GSI to get all articles efficiently, then filter
        // We'll use scan with filter to get all article types
        const params = {
            TableName: ARTICLES_TABLE,
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'published' // Only search published articles
            },
            ScanIndexForward: false, // Sort by originalDate descending (newest first)
            Limit: Math.min(limit * 3, 100) // Get more results to filter, but cap at 100
        };
        
        if (lastKey) {
            params.ExclusiveStartKey = lastKey;
        }
        
        let result;
        try {
            result = await dynamodb.send(new ScanCommand(params));
        } catch (scanError) {
            console.log('Scan failed, trying basic scan:', scanError.message);
            // Fallback to basic scan
            const basicScanParams = {
                TableName: ARTICLES_TABLE,
                Limit: Math.min(limit * 3, 100)
            };
            
            if (lastKey) {
                basicScanParams.ExclusiveStartKey = lastKey;
            }
            
            result = await dynamodb.send(new ScanCommand(basicScanParams));
        }
        
        // Transform and filter results, sort by originalDate
        const allArticles = result.Items
            .map(item => {
                const imageUrl = item.imageUrl || item.images?.heroImage?.url || item.images?.cardImage?.url || item.images?.ogImage?.url;
                return {
                    id: item.articleId,
                    title: item.title,
                    slug: item.slug,
                    perex: item.perex,
                    category: item.category || 'discovery',
                    publishedAt: item.originalDate || item.publishedAt,
                    originalDate: item.originalDate,
                    author: item.author,
                    readingTime: item.estimatedReadingTime,
                    imageUrl: imageUrl,
                    image: imageUrl, // Add image field for frontend compatibility
                    imageAlt: item.metaTitle || item.title, // Add imageAlt for accessibility
                    metaTitle: item.metaTitle,
                    metaDescription: item.metaDescription,
                    type: item.type,
                    source: item.source,
                    sourceUrl: item.sourceUrl,
                    tags: item.tags || [], // Pridať tags pre search
                    // Image license fields
                    imageLicense: item.imageLicense,
                    imageCreditText: item.imageCreditText,
                    imageCopyrightNotice: item.imageCopyrightNotice,
                    imageAcquireLicensePage: item.imageAcquireLicensePage,
                    imageSource: item.imageSource,
                    imagePhotographer: item.imagePhotographer,
                    imagePhotographerUrl: item.imagePhotographerUrl
                };
            })
            .sort((a, b) => new Date(b.originalDate || b.publishedAt) - new Date(a.originalDate || a.publishedAt));
        
        // Client-side filtering for search (case-insensitive)
        const searchLower = query.toLowerCase();
        const filteredArticles = allArticles.filter(article => 
            article.title.toLowerCase().includes(searchLower) ||
            article.perex.toLowerCase().includes(searchLower) ||
            article.category.toLowerCase().includes(searchLower) ||
            (article.metaDescription && article.metaDescription.toLowerCase().includes(searchLower)) ||
            (article.tags && article.tags.some(tag => tag.toLowerCase().includes(searchLower)))
        );
        
        // Limit results
        const limitedArticles = filteredArticles.slice(0, limit);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                articles: limitedArticles,
                lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
                count: limitedArticles.length,
                total: filteredArticles.length,
                query: query
            })
        };
        
    } catch (error) {
        console.error('Error searching articles:', error);
        console.error('Error stack:', error.stack);
        console.error('Query params:', queryParams);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message,
                details: process.env.ENVIRONMENT === 'dev' ? error.stack : undefined
            })
        };
    }
}

// Export functions for testing
module.exports = {
    handler: exports.handler,
    getAllArticles,
    getArticleById,
    getLatestArticles,
    getArticleBySlug,
    getArticlesByCategory,
    searchArticles
};
