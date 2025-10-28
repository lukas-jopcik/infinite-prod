const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { fetchNASASpaceImages } = require('./nasa-image-sources');

// Configuration
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.REGION || 'eu-central-1';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || `InfiniteRawContent-${ENVIRONMENT}`;
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
 * Generate article idea from image using OpenAI GPT-4o with vision
 */
async function generateArticleIdea(imageData, openaiApiKey) {
    try {
        console.log(`Generating idea for image: ${imageData.title}`);
        
        const prompt = `You are a space content strategist. Analyze this image and create an engaging article idea.

Image: ${imageData.imageUrl}
Description: ${imageData.description}
Title: ${imageData.title}

Generate a clickbait article idea in English about this space image. Make it engaging and curiosity-driven (e.g., "Why Do We Always See The Same Side Of The Moon?"). 

Provide:
1. Clickbait title (curiosity-driven, question format preferred)
2. Article concept (2-3 sentences explaining what the article would cover)
3. Key topics to cover (3-5 bullet points)
4. Target audience (general public, enthusiasts, students)

Make it engaging but scientifically accurate. The title should be in English but suitable for translation to Slovak.

Respond in JSON format:
{
  "title": "Why Do We Always See The Same Side Of The Moon?",
  "ideaSummary": "This article would explore the fascinating phenomenon of tidal locking...",
  "keyTopics": ["Tidal locking", "Moon phases", "Gravitational forces"],
  "targetAudience": "general public"
}`;

        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageData.imageUrl,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        const content = response.data.choices[0].message.content;
        console.log('OpenAI response:', content);
        
        // Remove markdown code blocks if present
        let jsonContent = content.trim();
        if (jsonContent.startsWith('```json')) {
            jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
            jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse JSON response
        const ideaData = JSON.parse(jsonContent);
        
        return {
            title: ideaData.title,
            ideaSummary: ideaData.ideaSummary,
            keyTopics: ideaData.keyTopics || [],
            targetAudience: ideaData.targetAudience || 'general public',
            aiPrompt: prompt,
            imageData: imageData
        };
        
    } catch (error) {
        console.error(`Error generating idea for image ${imageData.id}:`, error);
        throw error;
    }
}

/**
 * Generate fallback text-based ideas when images are insufficient
 */
async function generateFallbackIdeas(openaiApiKey, count = 5) {
    try {
        console.log(`Generating ${count} fallback text-based ideas...`);
        
        const prompt = `Generate ${count} engaging space article ideas in English. Each should be clickbait-style but scientifically accurate.

Focus on topics like:
- Space phenomena (auroras, eclipses, meteor showers)
- Planetary science (Mars exploration, Jupiter's moons)
- Astronomy basics (why stars twinkle, black holes)
- Space technology (satellites, space stations)
- Cosmic mysteries (dark matter, exoplanets)

For each idea, provide:
1. Clickbait title (question format preferred)
2. Brief concept (2-3 sentences)
3. Key topics (3-5 bullet points)
4. Target audience

Respond in JSON array format:
[
  {
    "title": "Why Do Stars Twinkle?",
    "ideaSummary": "This article explores the atmospheric effects that make stars appear to twinkle...",
    "keyTopics": ["Atmospheric refraction", "Star observation", "Light pollution"],
    "targetAudience": "general public"
  }
]`;

        const response = await axios.post(OPENAI_API_URL, {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 2000,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const content = response.data.choices[0].message.content;
        console.log('OpenAI fallback response:', content);
        
        // Remove markdown code blocks if present
        let jsonContent = content.trim();
        if (jsonContent.startsWith('```json')) {
            jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonContent.startsWith('```')) {
            jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const ideas = JSON.parse(jsonContent);
        
        return ideas.map(idea => ({
            title: idea.title,
            ideaSummary: idea.ideaSummary,
            keyTopics: idea.keyTopics || [],
            targetAudience: idea.targetAudience || 'general public',
            aiPrompt: prompt,
            imageData: null // No image for fallback ideas
        }));
        
    } catch (error) {
        console.error('Error generating fallback ideas:', error);
        throw error;
    }
}

/**
 * Store idea in DynamoDB
 */
async function storeIdea(ideaData) {
    try {
        const contentId = uuidv4();
        const now = new Date();
        const dateISO = now.toISOString().split('T')[0];
        
        const item = {
            contentId: contentId,
            source: 'ai-generated-ideas',
            category: 'ai-discoveries',
            status: 'raw',
            title: ideaData.title,
            ideaSummary: ideaData.ideaSummary,
            keyTopics: ideaData.keyTopics,
            targetAudience: ideaData.targetAudience,
            aiPrompt: ideaData.aiPrompt,
            createdAt: now.toISOString(),
            dateISO: dateISO,
            // Image data (if available)
            ...(ideaData.imageData && {
                imageUrl: ideaData.imageData.imageUrl,
                imageBucket: ideaData.imageData.imageBucket,
                imageKey: ideaData.imageData.imageKey,
                imageCredit: ideaData.imageData.imageCredit,
                imageLicense: ideaData.imageData.imageLicense,
                imageNasaId: ideaData.imageData.imageNasaId,
                originalUrl: ideaData.imageData.originalUrl,
                flickrUrl: ideaData.imageData.flickrUrl,
                uploadedAt: ideaData.imageData.uploadedAt
            })
        };
        
        const params = {
            TableName: RAW_CONTENT_TABLE,
            Item: item
        };
        
        await dynamodb.send(new PutCommand(params));
        console.log(`Stored idea: ${ideaData.title}`);
        
        return contentId;
        
    } catch (error) {
        console.error('Error storing idea:', error);
        throw error;
    }
}

/**
 * Main Lambda handler for AI idea generation
 */
exports.handler = async (event) => {
    console.log('AI Idea Generator Lambda invoked:', JSON.stringify(event, null, 2));
    
    try {
        // Get OpenAI API key
        const openaiApiKey = await getOpenAIApiKey();
        
        const ideasGenerated = [];
        const errors = [];
        
        // Try image-first approach
        try {
            console.log('Fetching NASA space images...');
            const images = await fetchNASASpaceImages(8); // Fetch more images than needed
            
            console.log(`Found ${images.length} images, generating ideas...`);
            
            // Generate ideas for each image (limit to 5)
            const imageIdeas = images.slice(0, 5);
            for (const imageData of imageIdeas) {
                try {
                    const ideaData = await generateArticleIdea(imageData, openaiApiKey);
                    const contentId = await storeIdea(ideaData);
                    ideasGenerated.push({
                        contentId: contentId,
                        title: ideaData.title,
                        hasImage: true,
                        imageId: imageData.id
                    });
                } catch (error) {
                    console.error(`Failed to generate idea for image ${imageData.id}:`, error);
                    errors.push(`Image ${imageData.id}: ${error.message}`);
                }
            }
            
        } catch (error) {
            console.error('Image-first approach failed:', error);
            errors.push(`Image fetching: ${error.message}`);
        }
        
        // Fill remaining slots with fallback text-based ideas
        const remaining = 5 - ideasGenerated.length;
        if (remaining > 0) {
            try {
                console.log(`Generating ${remaining} fallback ideas...`);
                const fallbackIdeas = await generateFallbackIdeas(openaiApiKey, remaining);
                
                for (const ideaData of fallbackIdeas) {
                    try {
                        const contentId = await storeIdea(ideaData);
                        ideasGenerated.push({
                            contentId: contentId,
                            title: ideaData.title,
                            hasImage: false,
                            imageId: null
                        });
                    } catch (error) {
                        console.error(`Failed to store fallback idea:`, error);
                        errors.push(`Fallback idea: ${error.message}`);
                    }
                }
                
            } catch (error) {
                console.error('Fallback ideas failed:', error);
                errors.push(`Fallback ideas: ${error.message}`);
            }
        }
        
        console.log(`Successfully generated ${ideasGenerated.length} ideas`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'AI idea generation completed',
                ideasGenerated: ideasGenerated.length,
                ideas: ideasGenerated,
                errors: errors,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Error in AI idea generator:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to generate AI ideas',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
