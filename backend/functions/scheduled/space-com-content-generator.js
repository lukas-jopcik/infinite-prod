const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Import our utilities
const { getNASAImagesForArticle } = require('./nasa-image-service');
const { 
    generateBulvarArticlePrompt, 
    generateSEOMetadataPrompt,
    validateBulvarContent,
    validateSEOMetadata
} = require('./bulvar-prompts');

// Initialize AWS services
const dynamodbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const secretsManager = new SecretsManagerClient({ region: process.env.REGION || 'eu-central-1' });

// Configuration
const REGION = process.env.REGION || 'eu-central-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || 'InfiniteRawContent-dev';
const ARTICLES_TABLE = process.env.DYNAMODB_ARTICLES_TABLE || 'InfiniteArticles-dev';
const OPENAI_SECRET_ARN = process.env.OPENAI_SECRET_ARN;

// OpenAI configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Main Lambda handler for Space.com content generation
 */
exports.handler = async (event) => {
    console.log('Space.com Content Generator Lambda invoked:', JSON.stringify(event, null, 2));
    
    try {
        // Get OpenAI API key from Secrets Manager
        const openaiApiKey = await getOpenAIApiKey();
        
        // Check if specific content ID is provided in event
        let rawContentItems = [];
        if (event.contentId && event.source) {
            // Process specific content ID
            const specificItem = await getSpecificRawContent(event.contentId, event.source);
            if (specificItem) {
                rawContentItems = [specificItem];
            }
        } else {
            // Get raw content items that need processing (Space.com content with status: "raw")
            rawContentItems = await getSpaceComRawContentForProcessing();
        }
        
        if (!rawContentItems || rawContentItems.length === 0) {
            console.log('No Space.com raw content items found for processing');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No Space.com raw content items found for processing',
                    processedCount: 0
                })
            };
        }
        
        let processedCount = 0;
        let errorCount = 0;
        const results = [];
        
        // Process each raw content item
        for (const rawItem of rawContentItems) {
            try {
                console.log(`Processing Space.com content: ${rawItem.contentId}`);
                
                // Generate Slovak bulvár article using OpenAI
                const generatedArticle = await generateSlovakBulvarArticle(rawItem, openaiApiKey);
                
                // Validate generated content
                const validationResult = validateBulvarContent(generatedArticle);
                if (!validationResult.isValid) {
                    console.error(`Content validation failed for ${rawItem.contentId}:`, validationResult.errors);
                    errorCount++;
                    continue;
                }
                
                // Get NASA images for the article
                const nasaImages = await getNASAImagesForArticle(rawItem);
                
                // Generate SEO metadata
                const seoMetadata = await generateSEOMetadata(generatedArticle, openaiApiKey);
                
                // Validate SEO metadata
                const seoValidation = validateSEOMetadata(seoMetadata);
                if (!seoValidation.isValid) {
                    console.warn(`SEO validation failed for ${rawItem.contentId}:`, seoValidation.errors);
                    // Continue anyway, we'll use fallback SEO
                }
                
                // Create article record
                const articleRecord = createArticleRecord(rawItem, generatedArticle, nasaImages, seoMetadata);
                
                // Store article in DynamoDB
                await storeArticle(articleRecord);
                
                // Update raw content status
                await updateRawContentStatus(rawItem.contentId, rawItem.source, 'processed');
                
                processedCount++;
                results.push({
                    contentId: rawItem.contentId,
                    title: generatedArticle.headline,
                    status: 'success',
                    nasaImages: {
                        hero: !!nasaImages.hero,
                        inline: !!nasaImages.inline,
                        inline2: !!nasaImages.inline2
                    }
                });
                
                console.log(`✓ Successfully processed: ${generatedArticle.headline}`);
                
            } catch (itemError) {
                console.error(`Error processing ${rawItem.contentId}:`, itemError);
                errorCount++;
                results.push({
                    contentId: rawItem.contentId,
                    title: rawItem.title,
                    status: 'error',
                    error: itemError.message
                });
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Space.com content generation completed',
                processedCount: processedCount,
                errorCount: errorCount,
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error in Space.com content generator:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Space.com content generation failed',
                details: error.message
            })
        };
    }
};

/**
 * Get OpenAI API key from Secrets Manager
 */
async function getOpenAIApiKey() {
    try {
        if (!OPENAI_SECRET_ARN) {
            throw new Error('OPENAI_SECRET_ARN environment variable not set');
        }
        
        const command = new GetSecretValueCommand({
            SecretId: OPENAI_SECRET_ARN
        });
        
        const response = await secretsManager.send(command);
        let secretValue;
        
        if (response.SecretString) {
            try {
                const secret = JSON.parse(response.SecretString);
                secretValue = secret.api_key || secret.OPENAI_API_KEY || secret.openai_api_key;
            } catch {
                secretValue = response.SecretString;
            }
        } else {
            secretValue = Buffer.from(response.SecretBinary, 'base64').toString();
        }
        
        if (!secretValue || secretValue.length < 10) {
            throw new Error('Invalid OpenAI API key format');
        }
        
        return secretValue;
    } catch (error) {
        console.error('Error getting OpenAI API key:', error.message);
        throw new Error(`Failed to get OpenAI API key: ${error.message}`);
    }
}

/**
 * Get Space.com raw content items that need processing
 */
async function getSpaceComRawContentForProcessing() {
    try {
        console.log(`DEBUG: Using table name: ${RAW_CONTENT_TABLE}`);
        console.log(`DEBUG: Using region: ${process.env.REGION || 'eu-central-1'}`);
        
        const scanParams = {
            TableName: RAW_CONTENT_TABLE,
            FilterExpression: '#source = :source AND #status = :status',
            ExpressionAttributeNames: {
                '#source': 'source',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':source': 'space-com',
                ':status': 'raw'
            },
            Limit: 5 // Process up to 5 items at a time
        };
        
        console.log(`DEBUG: Scan params:`, JSON.stringify(scanParams, null, 2));
        const result = await dynamodb.send(new ScanCommand(scanParams));
        console.log(`DEBUG: Query result:`, JSON.stringify(result, null, 2));
        console.log(`Found ${result.Items.length} Space.com raw content items for processing`);
        
        return result.Items || [];
    } catch (error) {
        console.error('Error getting raw content for processing:', error.message);
        throw new Error(`Failed to get raw content: ${error.message}`);
    }
}

/**
 * Get specific raw content item
 */
async function getSpecificRawContent(contentId, source) {
    try {
        const getParams = {
            TableName: RAW_CONTENT_TABLE,
            Key: {
                contentId: contentId,
                source: source
            }
        };
        
        const result = await dynamodb.send(new GetCommand(getParams));
        return result.Item || null;
    } catch (error) {
        console.error('Error getting specific raw content:', error.message);
        return null;
    }
}

/**
 * Generate Slovak bulvár article using OpenAI
 */
async function generateSlovakBulvarArticle(rawItem, openaiApiKey) {
    try {
        const prompt = generateBulvarArticlePrompt(rawItem);
        
        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Si expert na písanie zaujímavých vesmírnych článkov v slovenčine. Píšeš v štýle pop-sci bulvár - zaujímavo, ale fakticky. Nikdy nevymýšľaš fakty.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        const content = response.data.choices[0].message.content;
        console.log('OpenAI response received, length:', content.length);
        
        // Parse JSON response
        try {
            const parsedContent = JSON.parse(content);
            return parsedContent;
        } catch (parseError) {
            console.error('Error parsing OpenAI JSON response:', parseError.message);
            console.log('Raw response:', content);
            
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Failed to parse OpenAI response as JSON');
        }
    } catch (error) {
        console.error('Error generating Slovak article:', error.message);
        throw new Error(`Article generation failed: ${error.message}`);
    }
}

/**
 * Generate SEO metadata using OpenAI
 */
async function generateSEOMetadata(generatedContent, openaiApiKey) {
    try {
        const prompt = generateSEOMetadataPrompt(generatedContent);
        
        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'Si expert na SEO pre slovenské webové stránky. Vytváraš meta titulky, popisy a kľúčové slová optimalizované pre slovenské publikum.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 500
        }, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        
        const content = response.data.choices[0].message.content;
        console.log('SEO metadata response received, length:', content.length);
        
        // Parse JSON response
        try {
            const parsedContent = JSON.parse(content);
            return parsedContent;
        } catch (parseError) {
            console.error('Error parsing SEO JSON response:', parseError.message);
            
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Return fallback SEO data
            return generateFallbackSEOMetadata(generatedContent);
        }
    } catch (error) {
        console.error('Error generating SEO metadata:', error.message);
        return generateFallbackSEOMetadata(generatedContent);
    }
}

/**
 * Generate fallback SEO metadata
 */
function generateFallbackSEOMetadata(generatedContent) {
    const headline = generatedContent.headline || '';
    const perex = generatedContent.perex || '';
    
    return {
        metaTitle: headline.length > 60 ? headline.substring(0, 57) + '...' : headline,
        metaDescription: perex.length > 160 ? perex.substring(0, 157) + '...' : perex,
        keywords: ['vesmír', 'astronómia', 'NASA', 'vesmírne novinky', 'vesmírny výskum'],
        slug: headline.toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim().replace(/\s+/g, '-')
            .substring(0, 50)
    };
}

/**
 * Create article record for DynamoDB
 */
function createArticleRecord(rawItem, generatedContent, nasaImages, seoMetadata) {
    const articleId = uuidv4();
    const now = new Date().toISOString();
    
    return {
        articleId: articleId,
        type: 'news',
        title: generatedContent.headline,
        slug: seoMetadata.slug,
        content: generatedContent.body,
        perex: generatedContent.perex,
        subheads: generatedContent.subheads || [],
        cta: generatedContent.cta || getDefaultCTA(),
        
        // Images
        imageUrl: nasaImages.hero ? nasaImages.hero.src : rawItem.imageUrl,
        heroImage: nasaImages.hero ? {
            src: nasaImages.hero.src,
            alt: nasaImages.hero.alt,
            credit: nasaImages.hero.credit
        } : null,
        inlineImage: nasaImages.inline ? {
            src: nasaImages.inline.src,
            alt: nasaImages.inline.alt,
            credit: nasaImages.inline.credit
        } : null,
        inlineImage2: nasaImages.inline2 ? {
            src: nasaImages.inline2.src,
            alt: nasaImages.inline2.alt,
            credit: nasaImages.inline2.credit
        } : null,
        
        // SEO
        metaTitle: seoMetadata.metaTitle,
        metaDescription: seoMetadata.metaDescription,
        keywords: seoMetadata.keywords,
        
        // Metadata
        category: 'news',
        source: 'space-com',
        originalTitle: rawItem.title,
        originalUrl: rawItem.url,
        originalDate: rawItem.originalDate,
        author: rawItem.author || 'Space.com',
        publishedAt: now,
        
        // Status
        status: 'published',
        environment: ENVIRONMENT,
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Store article in DynamoDB
 */
async function storeArticle(articleRecord) {
    try {
        const putParams = {
            TableName: ARTICLES_TABLE,
            Item: articleRecord
        };
        
        await dynamodb.send(new PutCommand(putParams));
        console.log(`Successfully stored article: ${articleRecord.articleId}`);
    } catch (error) {
        console.error('Error storing article:', error.message);
        throw new Error(`Failed to store article: ${error.message}`);
    }
}

/**
 * Update raw content status
 */
async function updateRawContentStatus(contentId, source, status) {
    try {
        const updateParams = {
            TableName: RAW_CONTENT_TABLE,
            Key: {
                contentId: contentId,
                source: source
            },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': status,
                ':updatedAt': new Date().toISOString()
            }
        };
        
        await dynamodb.send(new UpdateCommand(updateParams));
        console.log(`Updated raw content status: ${contentId} -> ${status}`);
    } catch (error) {
        console.error('Error updating raw content status:', error.message);
        // Don't throw error, this is not critical
    }
}
