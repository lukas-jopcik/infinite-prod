const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.REGION || 'eu-central-1';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || `InfiniteRawContent-${ENVIRONMENT}`;
const ARTICLES_TABLE = process.env.DYNAMODB_ARTICLES_TABLE || `InfiniteArticles-${ENVIRONMENT}`;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize AWS clients
const dynamodbClient = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

// OpenAI configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

/**
 * Get OpenAI API key from environment variable
 */
async function getOpenAIApiKey() {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable not set');
    }
    return OPENAI_API_KEY;
}

/**
 * Get next raw idea to process
 */
async function getNextRawIdea() {
    try {
        console.log('Looking for next raw idea to process...');
        
        const params = {
            TableName: RAW_CONTENT_TABLE,
            FilterExpression: '#source = :source AND #status = :status',
            ExpressionAttributeNames: {
                '#source': 'source',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':source': 'ai-generated-ideas',
                ':status': 'raw'
            }
        };
        
        const result = await dynamodb.send(new ScanCommand(params));
        
        console.log('Scan result:', JSON.stringify(result, null, 2));
        
        if (!result.Items || result.Items.length === 0) {
            console.log('No raw ideas found for processing');
            return null;
        }
        
        // Sort by createdAt to process oldest first
        const sortedItems = result.Items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const idea = sortedItems[0];
        
        console.log(`Found idea to process: ${idea.title}`);
        return idea;
        
    } catch (error) {
        console.error('Error getting next raw idea:', error);
        throw error;
    }
}

/**
 * Check if article already exists for given contentId
 */
async function checkArticleExists(contentId) {
    try {
        const params = {
            TableName: ARTICLES_TABLE,
            FilterExpression: 'rawContentId = :contentId',
            ExpressionAttributeValues: {
                ':contentId': contentId
            },
            Limit: 1
        };
        
        const result = await dynamodb.send(new ScanCommand(params));
        return result.Items && result.Items.length > 0;
        
    } catch (error) {
        console.error('Error checking article existence:', error);
        return false;
    }
}

/**
 * Generate Slovak article content using OpenAI
 */
async function generateSlovakArticle(ideaData, openaiApiKey) {
    try {
        console.log(`Generating Slovak article for: ${ideaData.title}`);
        
        const prompt = `Vytvor pútavý slovenský článok o vesmíre na základe tohto nápadu:

Názov: ${ideaData.title}
Koncept: ${ideaData.ideaSummary}
Kľúčové témy: ${ideaData.keyTopics ? ideaData.keyTopics.join(', ') : 'Všeobecné vesmírne témy'}
Cieľová skupina: ${ideaData.targetAudience}

${ideaData.imageUrl ? `Obrázok: ${ideaData.imageUrl}` : ''}

Požiadavky:
- 5-7 odsekov, 2-3 H2 nadpisy
- Bulvárny štýl, ale fakticky presný
- Minimálne 1200 znakov
- Zaujímavé, ľahko čitateľné
- Cieľová skupina: široká verejnosť
- Používaj správne slovenské diakritiky

Štruktúra:
1. Úvodný odstavec (pútavý, zaujme čitateľa)
2. Hlavné témy (s nadpismi H2)
3. Zaujímavosti a širší kontext
4. Záver so zhrnutím

Odpovedaj v JSON formáte:
{
  "title": "Slovenský názov článku",
  "content": "Celý obsah článku s HTML značkami pre nadpisy",
  "excerpt": "Krátky úryvok (2-3 vety)",
  "keywords": ["kľúčové", "slová", "pre", "SEO"],
  "readingTime": "5 minút"
}`;

        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 3000,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        const content = response.data.choices[0].message.content;
        console.log('OpenAI Slovak response received');
        
        // Remove markdown code blocks if present
        let jsonContent = content.trim();
        if (jsonContent.startsWith('```json')) {
            jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
            jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse JSON response
        const articleData = JSON.parse(jsonContent);
        
        return {
            title: articleData.title,
            content: articleData.content,
            excerpt: articleData.excerpt,
            keywords: articleData.keywords || [],
            readingTime: articleData.readingTime || '5 minút'
        };
        
    } catch (error) {
        console.error(`Error generating Slovak article for ${ideaData.title}:`, error);
        throw error;
    }
}

/**
 * Generate SEO metadata for the article
 */
function generateSEOMetadata(articleData, ideaData) {
    const title = articleData.title;
    const excerpt = articleData.excerpt;
    const keywords = articleData.keywords || [];
    
    // Generate slug from title
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    
    // Generate meta description (max 155 chars)
    const metaDescription = excerpt.length > 155 
        ? excerpt.substring(0, 152) + '...'
        : excerpt;
    
    // Generate meta title (max 60 chars)
    const metaTitle = title.length > 60 
        ? title.substring(0, 57) + '...'
        : title;
    
    return {
        slug: slug,
        metaTitle: metaTitle,
        metaDescription: metaDescription,
        keywords: keywords,
        canonical: `https://infinite.sk/vesmirne-objavy/${slug}`
    };
}

/**
 * Store article in DynamoDB
 */
async function storeArticle(ideaData, articleData, seoData) {
    try {
        const articleId = uuidv4();
        const now = new Date();
        const dateISO = now.toISOString().split('T')[0];
        
        const article = {
            articleId: articleId,
            type: 'ai-generated',
            rawContentId: ideaData.contentId,
            title: articleData.title,
            slug: seoData.slug,
            content: articleData.content,
            excerpt: articleData.excerpt,
            category: 'ai-discoveries',
            status: 'published',
            publishedAt: now.toISOString(),
            originalDate: now.toISOString(), // Add originalDate for GSI compatibility
            dateISO: dateISO,
            readingTime: articleData.readingTime,
            // SEO metadata
            metaTitle: seoData.metaTitle,
            metaDescription: seoData.metaDescription,
            keywords: seoData.keywords,
            canonical: seoData.canonical,
            // Image data (if available)
            ...(ideaData.imageUrl && {
                hero: {
                    src: ideaData.imageUrl,
                    alt: ideaData.title,
                    credit: ideaData.imageCredit || 'NASA',
                    bucket: ideaData.imageBucket,
                    key: ideaData.imageKey
                }
            }),
            // Original idea data for reference
            originalIdea: {
                title: ideaData.title,
                summary: ideaData.ideaSummary,
                keyTopics: ideaData.keyTopics,
                targetAudience: ideaData.targetAudience
            }
        };
        
        const params = {
            TableName: ARTICLES_TABLE,
            Item: article
        };
        
        await dynamodb.send(new PutCommand(params));
        console.log(`Stored article: ${articleData.title}`);
        
        return articleId;
        
    } catch (error) {
        console.error('Error storing article:', error);
        throw error;
    }
}

/**
 * Update idea status to processed
 */
async function updateIdeaStatus(contentId) {
    try {
        const params = {
            TableName: RAW_CONTENT_TABLE,
            Key: {
                contentId: contentId,
                source: 'ai-generated-ideas'
            },
            UpdateExpression: 'SET #status = :status, processedAt = :processedAt',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'processed',
                ':processedAt': new Date().toISOString()
            }
        };
        
        await dynamodb.send(new UpdateCommand(params));
        console.log(`Updated idea status to processed: ${contentId}`);
        
    } catch (error) {
        console.error('Error updating idea status:', error);
        throw error;
    }
}

/**
 * Main Lambda handler for AI discoveries content generation
 */
exports.handler = async (event) => {
    console.log('AI Discoveries Generator Lambda invoked:', JSON.stringify(event, null, 2));
    
    try {
        // Get OpenAI API key
        const openaiApiKey = await getOpenAIApiKey();
        
        // Get next raw idea to process
        const ideaData = await getNextRawIdea();
        
        if (!ideaData) {
            console.log('No raw ideas available for processing');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No raw ideas available for processing',
                    processedCount: 0,
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        // Check if article already exists
        const articleExists = await checkArticleExists(ideaData.contentId);
        if (articleExists) {
            console.log(`Article already exists for idea: ${ideaData.title}`);
            await updateIdeaStatus(ideaData.contentId);
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Article already exists, marked as processed',
                    contentId: ideaData.contentId,
                    processedCount: 0,
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        // Generate Slovak article
        const articleData = await generateSlovakArticle(ideaData, openaiApiKey);
        
        // Generate SEO metadata
        const seoData = generateSEOMetadata(articleData, ideaData);
        
        // Store article
        const articleId = await storeArticle(ideaData, articleData, seoData);
        
        // Update idea status to processed
        await updateIdeaStatus(ideaData.contentId);
        
        console.log(`Successfully processed idea: ${ideaData.title}`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'AI discoveries article generated successfully',
                articleId: articleId,
                title: articleData.title,
                slug: seoData.slug,
                contentId: ideaData.contentId,
                processedCount: 1,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Error in AI discoveries generator:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to generate AI discoveries article',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
