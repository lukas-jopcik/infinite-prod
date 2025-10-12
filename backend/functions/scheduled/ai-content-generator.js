const { DynamoDBClient, ScanCommand: RawScanCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Try to import Sharp, but handle gracefully if it fails
let sharp;
try {
    sharp = require('sharp');
} catch (error) {
    console.warn('Sharp not available, image processing will be limited:', error.message);
    sharp = null;
}

// Initialize AWS services
const dynamodbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const dynamodbRaw = dynamodbClient; // Use raw client for scan operations
const s3 = new S3Client({ region: process.env.REGION || 'eu-central-1' });
const secretsManager = new SecretsManagerClient({ region: process.env.REGION || 'eu-central-1' });

// Configuration
const REGION = process.env.REGION || 'eu-central-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || 'InfiniteRawContent-dev';
const ARTICLES_TABLE = process.env.DYNAMODB_ARTICLES_TABLE || 'InfiniteArticles-dev';
const S3_IMAGES_BUCKET = process.env.S3_IMAGES_BUCKET || 'infinite-images-dev-349660737637';
const OPENAI_SECRET_ARN = process.env.OPENAI_SECRET_ARN;

// OpenAI configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';

/**
 * Main Lambda handler for AI content generation
 */
exports.handler = async (event) => {
    console.log('AI Content Generator Lambda invoked:', JSON.stringify(event, null, 2));
    
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
            // Get raw content items that need processing (APOD, ESA Hubble, and Community content with status: "raw")
            const apodItems = await getRawContentForProcessing();
            
            // Also get ESA Hubble content with pending status
            const esaHubbleItems = await getESAHubbleContentForProcessing();
            
            // Combine all types of content
            rawContentItems = [...apodItems, ...esaHubbleItems];
        }
        
        if (!rawContentItems || rawContentItems.length === 0) {
            console.log('No raw content items found for processing');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No raw content items found for processing',
                    processedCount: 0
                })
            };
        }
        
        // For testing: process only first item
        const testMode = event.testMode || false;
        if (testMode && rawContentItems.length > 0) {
            rawContentItems = [rawContentItems[0]];
            console.log('TEST MODE: Processing only first item');
        }
        
        let processedCount = 0;
        let errorCount = 0;
        const results = [];
        
            // Process each raw content item
            for (const rawItem of rawContentItems) {
                try {
                    console.log(`Processing raw content: ${rawItem.contentId}`);
                    
                    // Check if article already exists for this raw content (idempotency check)
                    console.log(`Checking for existing article: ${rawItem.contentId}, source: ${rawItem.source}`);
                    const existingArticle = await checkExistingArticle(rawItem.contentId, rawItem.source);
                    if (existingArticle) {
                        console.log(`Article already exists for raw content ${rawItem.contentId}, skipping`);
                        continue;
                    }
                    console.log(`No existing article found for ${rawItem.contentId}, proceeding with generation`);
                    
                    // Generate Slovak article using OpenAI
                const generatedArticle = await generateSlovakArticle(rawItem, openaiApiKey);
                
                // Validate generated content
                const validationResult = validateGeneratedContent(generatedArticle, rawItem.category);
                if (!validationResult.isValid) {
                    console.error(`Content validation failed for ${rawItem.contentId}:`, validationResult.errors);
                    errorCount++;
                    continue;
                }
                
                // Process and optimize images
                const processedImages = await processImages(rawItem, generatedArticle);
                
                // Fetch community image if this is a community article
                let communityImageUrl = null;
                if (rawItem.category === 'komunita') {
                    communityImageUrl = await fetchCommunityImage(generatedArticle.h1Title, generatedArticle.keywords);
                }
                
                // Create article record
                const articleRecord = createArticleRecord(rawItem, generatedArticle, processedImages, communityImageUrl);
                
                // Store article in DynamoDB
                await storeArticle(articleRecord);
                
                // Update raw content status
                await updateRawContentStatus(rawItem.contentId, rawItem.source, 'processed');
                
                processedCount++;
                results.push({
                    contentId: rawItem.contentId,
                    articleId: articleRecord.articleId,
                    title: articleRecord.title,
                    slug: articleRecord.slug
                });
                
                console.log(`Successfully processed: ${rawItem.contentId} -> ${articleRecord.articleId}`);
                
            } catch (itemError) {
                console.error(`Error processing raw content ${rawItem.contentId}:`, itemError);
                errorCount++;
                
                // Update raw content status to failed
                try {
                    await updateRawContentStatus(rawItem.contentId, rawItem.source, 'failed');
                } catch (updateError) {
                    console.error('Failed to update raw content status:', updateError);
                }
            }
        }
        
        console.log(`AI content generation completed: ${processedCount} processed, ${errorCount} errors`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'AI content generation completed successfully',
                processedCount: processedCount,
                errorCount: errorCount,
                totalItems: rawContentItems.length,
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error in AI Content Generator:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'AI content generation failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};

/**
 * Get OpenAI API key from Secrets Manager
 */
async function getOpenAIApiKey() {
    try {
        const secretData = await secretsManager.send(new GetSecretValueCommand({ SecretId: OPENAI_SECRET_ARN }));
        
        if (secretData.SecretString) {
            const secret = JSON.parse(secretData.SecretString);
            return secret.OPENAI_API_KEY;
        }
        
        throw new Error('OpenAI API key not found in secret');
    } catch (error) {
        console.error('Error retrieving OpenAI API key:', error);
        throw new Error('Failed to retrieve OpenAI API key');
    }
}

/**
 * Get specific raw content item by contentId and source
 */
async function getSpecificRawContent(contentId, source) {
    try {
        const params = {
            TableName: RAW_CONTENT_TABLE,
            Key: {
                contentId: contentId,
                source: source
            }
        };
        
        const result = await dynamodb.send(new GetCommand(params));
        
        if (!result.Item) {
            console.log(`No item found for contentId: ${contentId}, source: ${source}`);
            return null;
        }
        
        // Check if the item is already processed
        if (result.Item.status === 'processed') {
            console.log(`Item ${contentId} is already processed, skipping`);
            return null;
        }
        
        // Only return items with status 'raw'
        if (result.Item.status === 'raw') {
            console.log(`Found raw item for processing: ${contentId}`);
            return result.Item;
        }
        
        console.log(`Item ${contentId} has status '${result.Item.status}', skipping`);
        return null;
        
    } catch (error) {
        console.error('Error getting specific raw content:', error);
        throw new Error('Failed to get specific raw content');
    }
}

/**
 * Get raw content items that need processing - optimized with GSI
 */
async function getRawContentForProcessing() {
    try {
        console.log('Getting raw content for processing...');
        
        // Try GSI first, fallback to scan if GSI is not ready
        let result;
        try {
            // Use GSI for efficient querying by status
            const params = {
                TableName: RAW_CONTENT_TABLE,
                IndexName: 'status-index',
                KeyConditionExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': 'raw'
                }
            };
            
            console.log('DynamoDB GSI query params:', JSON.stringify(params, null, 2));
            result = await dynamodb.send(new QueryCommand(params));
            
        } catch (gsiError) {
            console.log('GSI not ready, falling back to scan:', gsiError.message);
            // Fallback to scan if GSI is not ready
            const scanParams = {
                TableName: RAW_CONTENT_TABLE,
                FilterExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': { S: 'raw' }
                }
            };
            
            console.log('DynamoDB scan params:', JSON.stringify(scanParams, null, 2));
            result = await dynamodbRaw.send(new RawScanCommand(scanParams));
        }
        
        console.log(`DynamoDB found ${result.Items ? result.Items.length : 0} items`);
        
        if (result.Items && result.Items.length > 0) {
            // Convert raw DynamoDB items to DocumentClient format if needed
            const convertedItems = result.Items.map(item => {
                // If using GSI query, items are already in DocumentClient format
                if (typeof item.status === 'string') {
                    return item;
                }
                
                // If using scan, convert from raw DynamoDB format
                const converted = {};
                for (const [key, value] of Object.entries(item)) {
                    if (value.S) converted[key] = value.S;
                    else if (value.N) converted[key] = value.N;
                    else if (value.BOOL !== undefined) converted[key] = value.BOOL;
                    else if (value.SS) converted[key] = value.SS;
                    else if (value.NS) converted[key] = value.NS;
                    else if (value.L) converted[key] = value.L;
                    else if (value.M) converted[key] = value.M;
                }
                return converted;
            });
            
            console.log('Found items:', convertedItems.map(item => ({ contentId: item.contentId, source: item.source, status: item.status })));
            return convertedItems;
        }
        
        return [];
        
    } catch (error) {
        console.error('Error getting raw content for processing:', error);
        throw new Error('Failed to get raw content for processing');
    }
}

/**
 * Generate Slovak article using OpenAI
 */
async function generateSlovakArticle(rawItem, openaiApiKey) {
    try {
        // Prepare the enhanced prompt based on objav-dna-slovenstina.md
        const prompt = createEnhancedPrompt(rawItem);
        
        // Determine system message based on category
        const systemMessage = rawItem.category === 'komunita' 
            ? "Si expertný slovenský astronomický novinár špecializujúci sa na zrozumiteľné vysvetľovanie vesmírnych javov. Píšeš zaujímavé, originálne články, ktoré sú prístupné širokej verejnosti, ale zostávajú fakticky presné a informatívne."
            : "Si expertný astronóm a skvelý slovenský spisovateľ. Tvoja úloha je vytvoriť zaujímavý, vedecky presný a ľahko zrozumiteľný článok o astronómii v slovenčine.";
        
        const requestBody = {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: systemMessage
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 6000,
            temperature: rawItem.category === 'komunita' ? 0.8 : 0.7, // Higher creativity for community content
            top_p: 1,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
        };
        
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response from OpenAI API');
        }
        
        const generatedContent = data.choices[0].message.content;
        
        // Parse the generated content
        return parseGeneratedContent(generatedContent, rawItem);
        
    } catch (error) {
        console.error('Error generating Slovak article:', error);
        throw new Error(`Failed to generate Slovak article: ${error.message}`);
    }
}

/**
 * Create enhanced prompt for OpenAI based on objav-dna-slovenstina.md
 */
function createEnhancedPrompt(rawItem) {
    const isWeeklyPick = rawItem.category === 'tyzdenny-vyber';
    const isCommunity = rawItem.category === 'komunita';
    
    if (isWeeklyPick) {
        return createWeeklyPickPrompt(rawItem);
    } else if (isCommunity) {
        return createCommunityPrompt(rawItem);
    } else {
        return createDailyDiscoveryPrompt(rawItem);
    }
}

function createWeeklyPickPrompt(rawItem) {
    return `
🚨 KRITICKÉ UPOZORNENIE: TENTO TÝŽDENNÝ VÝBER MUSÍ MAŤ MINIMÁLNE 1500 ZNAKOV CELKOVO! 🚨
🚨 AK ČLÁNOK NEBUDE DOSTATOČNE DLHÝ, BUDE ZAMIETNUTÝ! 🚨

**POVINNÉ POŽIADAVKY NA DĹŽKU (TÝŽDENNÝ VÝBER):**
- Perex: MINIMÁLNE 150 znakov
- Každá z 4 sekcií: MINIMÁLNE 300 znakov (celkovo 1200 znakov len sekcie)
- FAQ odpovede: MINIMÁLNE 100 znakov na odpoveď
- CELKOVÝ obsah: MINIMÁLNE 1500 znakov (perex + sekcie + FAQ)

Si odborný slovenský redaktor pre astronomický magazín Infinite. 
Vytvor KURÁTORSKÝ TÝŽDENNÝ VÝBER článku o tomto vesmírnom objave z ESA Hubble.

**DÔLEŽITÉ ROZDIELY OD DENNÝCH OBJAVOV:**
- Tón: Viac editoriálny, kurátorský, vysvetľujúci "prečo je toto výnimočné"
- Štruktúra: Pridaj sekciu "Prečo sme si vybrali tento objav" na začiatok
- Dĺžka: Kratšie, stručnejšie sekcie (2-3 odseky namiesto 3-4)
- Štýl: Viac priateľský, menej technický ako denné objavy
- Kontext: Zdôrazni význam a zaujímavosť pre širokú verejnosť

**Základné informácie:**
- Názov: ${rawItem.title || 'Astronomický objav'}
- Zdroj: ${rawItem.source || 'ESA Hubble'}
- Dátum: ${rawItem.date || new Date().toISOString().split('T')[0]}
- Popis: ${rawItem.explanation || rawItem.description || 'Astronomický objav'}

**Požiadavky na článok (TÝŽDENNÝ VÝBER):**
1. **Meta title** (max 60 znakov): Zaujímavý, SEO-optimalizovaný názov VÝLUČNE V SLOVENČINE
   - Formát: "[Názov objektu] – Týždenný výber [deň. mesiac slovne, rok]"
   - Príklad: "Krabia hmlovina – Týždenný výber 7. októbra 2025"
2. **Meta description** (max 160 znakov): Krátky popis článku VÝLUČNE V SLOVENČINE
3. **H1 názov**: Hlavný názov článku VÝLUČNE V SLOVENČINE
   - Formát: "[Názov objektu] – [zaujímavý opis]"
   - Príklad: "Krabia hmlovina – fascinujúce okno do konca života hviezdy"
4. **Perex** (MINIMÁLNE 150 znakov): Úvodný text, ktorý zaujme čitateľa
5. **4 H2 sekcií** s podrobným obsahom (každá sekcia MINIMÁLNE 300 znakov):
   - **Prečo sme si vybrali tento objav** (MINIMÁLNE 300 znakov) - NOVÁ SEKCIA!
   - **Čo vidíme na snímke** (MINIMÁLNE 300 znakov)
   - **Prečo je tento objav dôležitý** (MINIMÁLNE 300 znakov)
   - **Zaujímavosti a budúcnosť** (MINIMÁLNE 300 znakov)
6. **FAQ sekcia** s 3 otázkami a odpoveďami (každá odpoveď MINIMÁLNE 100 znakov)

**Štýl a jazyk (TÝŽDENNÝ VÝBER):**
- Používaj správnu slovenčinu s diakritikou
- Píš pre širokú verejnosť (nie pre odborníkov)
- Vysvetľuj zložité pojmy jednoducho
- Používaj aktívny rod
- Vedecky presné, ale zrozumiteľné
- **TÓN: Viac editoriálny, kurátorský, priateľský**
- **ŠTYL: Menej technický, viac príbehový ako denné objavy**
- **KRITICKÉ: Všetky názvy, nadpisy a titulky MUSÍ byť VÝLUČNE V SLOVENČINE - žiadne anglické slová!**
- **KRITICKÉ: Nepoužívaj anglické slová ako "image", "credit", "amazing", "incredible" atď.**
- **KRITICKÉ: Prekladaj všetky anglické termíny do slovenčiny (napr. "hmlovina" namiesto "nebula")**
- **KRITICKÉ: NIKDY nepoužívaj názvy chorôb pre astronomické objekty! (napr. "Krabia hmlovina" namiesto "Rakovina hmlovina")**

🚨 FINÁLNE UPOZORNENIE: PÍŠ DLHÝ A PODROBNÝ TÝŽDENNÝ VÝBER! 🚨
🚨 CELKOVÝ obsah MUSÍ mať aspoň 1500 znakov, inak bude článok zamietnutý! 🚨

**Formát výstupu:**
Vráť obsah v JSON formáte:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "h1Title": "...",
  "perex": "...",
  "sections": [
    {"title": "Prečo sme si vybrali tento objav", "content": "..."},
    {"title": "Čo vidíme na snímke", "content": "..."},
    {"title": "Prečo je tento objav dôležitý", "content": "..."},
    {"title": "Zaujímavosti a budúcnosť", "content": "..."}
  ],
  "faq": [
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ],
  "keywords": ["kľúčové", "slová", "pre", "SEO"],
  "estimatedReadingTime": "X minút"
}

**PAMATUJ SI:** Celkový obsah MUSÍ mať aspoň 1500 znakov, inak bude článok zamietnutý!
`;
}

function createDailyDiscoveryPrompt(rawItem) {
    return `
🚨 KRITICKÉ UPOZORNENIE: TENTO ČLÁNOK MUSÍ MAŤ MINIMÁLNE 2000 ZNAKOV CELKOVO! 🚨
🚨 AK ČLÁNOK NEBUDE DOSTATOČNE DLHÝ, BUDE ZAMIETNUTÝ! 🚨

**POVINNÉ POŽIADAVKY NA DĹŽKU:**
- Perex: MINIMÁLNE 200 znakov
- Každá z 5 sekcií: MINIMÁLNE 400 znakov (celkovo 2000 znakov len sekcie)
- FAQ odpovede: MINIMÁLNE 150 znakov na odpoveď
- CELKOVÝ obsah: MINIMÁLNE 2000 znakov (perex + sekcie + FAQ)

Vytvor zaujímavý slovenský článok o astronómii na základe týchto údajov:

**Základné informácie:**
- Názov: ${rawItem.title || 'Astronomický objav'}
- Zdroj: ${rawItem.source || 'NASA/ESA'}
- Dátum: ${rawItem.date || new Date().toISOString().split('T')[0]}
- Popis: ${rawItem.explanation || rawItem.description || 'Astronomický objav'}

**Požiadavky na článok:**
1. **Meta title** (max 60 znakov): Zaujímavý, SEO-optimalizovaný názov VÝLUČNE V SLOVENČINE - žiadne anglické slová!
   - Formát: "[Zaujímavý jav/objekt] – Objav dňa [deň. mesiac slovne, rok]"
   - Príklad: "Krabia hmlovina – Objav dňa 7. októbra 2025" (NIKDY nepoužívaj "Rakovina"!)
2. **Meta description** (max 160 znakov): Krátky popis článku VÝLUČNE V SLOVENČINE
3. **H1 názov**: Hlavný názov článku VÝLUČNE V SLOVENČINE - žiadne anglické slová!
   - Formát: "[Názov objektu] – [zaujímavý opis]"
   - Príklad: "Krabia hmlovina – fascinujúce okno do konca života hviezdy" (NIKDY nepoužívaj "Rakovina"!)
4. **Perex** (MINIMÁLNE 200 znakov): Úvodný text, ktorý zaujme čitateľa
5. **5 H2 sekcií** s podrobným obsahom (každá sekcia MINIMÁLNE 400 znakov):
   - **Čo vidíme na snímke** (MINIMÁLNE 400 znakov)
   - **Prečo je tento objav dôležitý** (MINIMÁLNE 400 znakov)
   - **Ako záber vznikol** (MINIMÁLNE 400 znakov)
   - **Zaujímavosti o objekte** (MINIMÁLNE 400 znakov)
   - **Vedecký význam a budúcnosť** (MINIMÁLNE 400 znakov)
6. **FAQ sekcia** s 3-5 otázkami a odpoveďami (každá odpoveď MINIMÁLNE 150 znakov)

**Štýl a jazyk:**
- Používaj správnu slovenčinu s diakritikou
- Píš pre širokú verejnosť (nie pre odborníkov)
- Vysvetľuj zložité pojmy jednoducho
- Používaj aktívny rod
- Vedecky presné, ale zrozumiteľné
- Rozširuj myšlienky a pridávaj kontext
- **KRITICKÉ: Všetky názvy, nadpisy a titulky MUSÍ byť VÝLUČNE V SLOVENČINE - žiadne anglické slová!**
- **KRITICKÉ: Nepoužívaj anglické slová ako "image", "credit", "amazing", "incredible" atď.**
- **KRITICKÉ: Prekladaj všetky anglické termíny do slovenčiny (napr. "hmlovina" namiesto "nebula")**
- **KRITICKÉ: NIKDY nepoužívaj názvy chorôb pre astronomické objekty! (napr. "Krabia hmlovina" namiesto "Rakovina hmlovina")**

🚨 FINÁLNE UPOZORNENIE: PÍŠ VEĽMI DLHÝ A PODROBNÝ ČLÁNOK! 🚨
🚨 CELKOVÝ obsah MUSÍ mať aspoň 2000 znakov, inak bude článok zamietnutý! 🚨

**Formát výstupu:**
Vráť obsah v JSON formáte:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "h1Title": "...",
  "perex": "...",
  "sections": [
    {"title": "...", "content": "..."},
    {"title": "...", "content": "..."},
    {"title": "...", "content": "..."},
    {"title": "...", "content": "..."},
    {"title": "...", "content": "..."}
  ],
  "faq": [
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ],
  "keywords": ["kľúčové", "slová", "pre", "SEO"],
  "estimatedReadingTime": "X minút"
}

**PAMATUJ SI:** Celkový obsah MUSÍ mať aspoň 2000 znakov, inak bude článok zamietnutý!
`;
}

/**
 * Parse generated content from OpenAI response
 */
function parseGeneratedContent(generatedContent, rawItem) {
    try {
        // Try to extract JSON from the response
        const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in generated content');
        }
        
        const parsedContent = JSON.parse(jsonMatch[0]);
        
        // Validate required fields based on category
        const isCommunity = rawItem.category === 'komunita';
        const requiredFields = ['metaTitle', 'metaDescription', 'h1Title', 'perex', 'sections', 'faq'];
        
        for (const field of requiredFields) {
            if (!parsedContent[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Add metadata
        parsedContent.rawContentId = rawItem.contentId;
        parsedContent.source = rawItem.source;
        parsedContent.originalDate = rawItem.date;
        parsedContent.generatedAt = new Date().toISOString();
        
        return parsedContent;
        
    } catch (error) {
        console.error('Error parsing generated content:', error);
        throw new Error(`Failed to parse generated content: ${error.message}`);
    }
}

/**
 * Validate generated content
 */
function validateGeneratedContent(generatedContent, category) {
    const errors = [];
    const isWeeklyPick = category === 'tyzdenny-vyber';
    const isCommunity = category === 'komunita';
    
    // Check required fields
    if (!generatedContent.metaTitle || generatedContent.metaTitle.length > 60) {
        errors.push('Meta title is missing or too long (max 60 characters)');
    }
    
    if (!generatedContent.metaDescription || generatedContent.metaDescription.length > 160) {
        errors.push('Meta description is missing or too long (max 160 characters)');
    }
    
    if (!generatedContent.h1Title) {
        errors.push('H1 title is missing');
    }
    
    if (!generatedContent.perex || generatedContent.perex.length < 50) {
        errors.push('Perex is missing or too short (min 50 characters)');
    }
    
    // Check sections based on content type
    if (isWeeklyPick) {
        // Weekly picks should have exactly 4 sections
        if (!generatedContent.sections || generatedContent.sections.length !== 4) {
            errors.push('Weekly picks must have exactly 4 sections');
        }
    } else if (isCommunity) {
        // Community articles should have 3-5 dynamic sections
        if (!generatedContent.sections || generatedContent.sections.length < 3 || generatedContent.sections.length > 5) {
            errors.push('Community articles must have 3-5 sections');
        }
    } else {
        // Daily discoveries should have exactly 5 sections
        if (!generatedContent.sections || generatedContent.sections.length !== 5) {
            errors.push('Daily discoveries must have exactly 5 sections');
        }
    }
    
    // FAQ is required for all content types including community
    if (!generatedContent.faq || generatedContent.faq.length < 3) {
        errors.push('Must have at least 3 FAQ items');
    }
    
    // Check content quality
    const totalContentLength = generatedContent.perex.length + 
        generatedContent.sections.reduce((sum, section) => sum + section.content.length, 0);
    
    // Different minimum lengths for different content types
    const minLength = isWeeklyPick ? 1500 : isCommunity ? 1200 : 2000;
    if (totalContentLength < minLength) {
        errors.push(`Total content length is too short (min ${minLength} characters, got ${totalContentLength})`);
    }
    
    // Check individual section lengths
    if (generatedContent.sections) {
        generatedContent.sections.forEach((section, index) => {
            if (section.content.length < 300) {
                errors.push(`Section ${index + 1} is too short (min 300 characters, got ${section.content.length})`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Process and optimize images
 */
async function processImages(rawItem, generatedContent) {
    try {
        const processedImages = {};
        
        // Get the main image URL
        const imageUrl = rawItem.imageUrl || rawItem.media_url;
        if (!imageUrl) {
            console.log('No image URL found for processing');
            return processedImages;
        }
        
        console.log(`Processing image: ${imageUrl}`);
        
        // Download the image
        const imageBuffer = await downloadImage(imageUrl);
        if (!imageBuffer) {
            console.error('Failed to download image');
            return processedImages;
        }
        
        // Generate alt text
        const altText = generateAltText(rawItem, generatedContent);
        
        // Process different image sizes
        const imageSizes = {
            og: { width: 1200, height: 630, folder: 'og' },
            hero: { width: 1200, height: 675, folder: 'hero' },
            card: { width: 400, height: 225, folder: 'card' },
            thumb: { width: 200, height: 112, folder: 'thumb' }
        };
        
        for (const [sizeName, config] of Object.entries(imageSizes)) {
            try {
                const processedImage = await processImageSize(
                    imageBuffer, 
                    config.width, 
                    config.height, 
                    `${rawItem.contentId}-${sizeName}`
                );
                
                if (processedImage) {
                    const extension = sharp ? 'webp' : 'jpg';
                    const s3Key = `images/${config.folder}/${rawItem.contentId}-${sizeName}.${extension}`;
                    const s3Url = await uploadToS3(processedImage, s3Key);
                    
                    processedImages[`${sizeName}Image`] = {
                        url: s3Url,
                        s3Key: s3Key,
                        alt: altText,
                        width: config.width,
                        height: config.height,
                        // Add license information based on source
                        ...(rawItem.source === 'apod' && {
                            license: 'Public Domain',
                            creditText: 'Image Credit: NASA APOD',
                            copyrightNotice: 'Public Domain - NASA',
                            acquireLicensePage: 'https://apod.nasa.gov/apod/',
                            source: 'nasa-apod',
                            photographer: 'NASA',
                            photographerUrl: 'https://www.nasa.gov/'
                        }),
                        ...(rawItem.source?.includes('esa') && {
                            license: 'ESA License',
                            creditText: 'Image Credit: ESA/Hubble',
                            copyrightNotice: '© ESA/Hubble',
                            acquireLicensePage: 'https://www.spacetelescope.org/',
                            source: 'esa-hubble',
                            photographer: 'ESA/Hubble',
                            photographerUrl: 'https://www.spacetelescope.org/'
                        })
                    };
                    
                    console.log(`Processed ${sizeName} image: ${s3Url}`);
                }
            } catch (sizeError) {
                console.error(`Error processing ${sizeName} image:`, sizeError);
            }
        }
        
        return processedImages;
        
    } catch (error) {
        console.error('Error processing images:', error);
        return {};
    }
}

/**
 * Download image from URL
 */
async function downloadImage(url) {
    try {
        console.log(`Downloading image from: ${url}`);
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Infinite-Astronomy-Bot/1.0'
            }
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error downloading image:', error.message);
        return null;
    }
}

/**
 * Process image to specific size and format
 */
async function processImageSize(imageBuffer, width, height, filename) {
    try {
        if (!sharp) {
            console.warn('Sharp not available, returning original image buffer');
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
            
        return processedBuffer;
    } catch (error) {
        console.error(`Error processing image size ${width}x${height}:`, error);
        return imageBuffer; // Return original buffer as fallback
    }
}

/**
 * Upload processed image to S3
 */
async function uploadToS3(imageBuffer, s3Key) {
    try {
        // Determine content type based on file extension
        const contentType = s3Key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        
        const uploadParams = {
            Bucket: S3_IMAGES_BUCKET,
            Key: s3Key,
            Body: imageBuffer,
            ContentType: contentType,
            CacheControl: 'max-age=31536000', // 1 year cache
            Metadata: {
                'processed-by': 'infinite-ai-content-generator',
                'processed-at': new Date().toISOString()
            }
        };
        
        await s3.send(new PutObjectCommand(uploadParams));
        
        return `https://${S3_IMAGES_BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
    } catch (error) {
        console.error('Error uploading to S3:', error);
        return null;
    }
}

/**
 * Generate alt text for images
 */
function generateAltText(rawItem, generatedContent) {
    const title = generatedContent.h1Title || rawItem.title || 'Astronomický objekt';
    const source = rawItem.source === 'apod' ? 'APOD / NASA' : 
                   rawItem.source?.includes('reddit') ? 'Komunita' : 'ESA / Hubble';
    
    return `${title} - ${source}`;
}

/**
 * Fetch community image from Pexels
 */
async function fetchCommunityImage(title, keywords) {
    try {
        console.log(`Fetching community image for: ${title}`);
        
        // Get Pexels API key from environment variables
        const pexelsApiKey = process.env.PEXELS_API_KEY;
        
        if (!pexelsApiKey) {
            console.log('No Pexels API key available, skipping image fetch');
            return null;
        }
        
        // Get list of already used Pexels photo IDs
        const usedPhotoIds = await getUsedPexelsPhotoIds();
        console.log(`Found ${usedPhotoIds.length} already used Pexels photos`);
        
        // Create search query from title and keywords
        const searchQuery = createImageSearchQuery(title, keywords);
        console.log(`Search query: ${searchQuery}`);
        
        // Try Pexels API with primary query
        const pexelsImage = await fetchFromPexels(searchQuery, pexelsApiKey, usedPhotoIds);
        if (pexelsImage) {
            return pexelsImage;
        }
        
        // Try fallback queries if primary query returns only used images
        const fallbackQueries = [
            'space astronomy',
            'galaxy stars',
            'universe cosmos',
            'astronomy telescope',
            'space exploration'
        ];
        
        for (const fallbackQuery of fallbackQueries) {
            console.log(`Trying fallback query: ${fallbackQuery}`);
            const fallbackImage = await fetchFromPexels(fallbackQuery, pexelsApiKey, usedPhotoIds);
            if (fallbackImage) {
                console.log(`Found image with fallback query: ${fallbackQuery}`);
                return fallbackImage;
            }
        }
        
        console.log('No suitable image found from Pexels with any query');
        return null;
        
    } catch (error) {
        console.error('Error fetching community image:', error);
        return null;
    }
}

/**
 * Get list of already used Pexels photo IDs to ensure uniqueness
 */
async function getUsedPexelsPhotoIds() {
    try {
        const command = new ScanCommand({
            TableName: ARTICLES_TABLE,
            FilterExpression: 'attribute_exists(pexelsPhotoId)',
            ProjectionExpression: 'pexelsPhotoId'
        });
        const response = await dynamodb.send(command);
        return response.Items?.map(item => item.pexelsPhotoId) || [];
    } catch (error) {
        console.error('Error getting used Pexels photo IDs:', error);
        return [];
    }
}

/**
 * Create search query for image APIs
 */
function createImageSearchQuery(title, keywords) {
    // Extract relevant words from title
    const titleWords = title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 3);
    
    // Add relevant keywords
    const relevantKeywords = (keywords || [])
        .filter(keyword => keyword.length > 3)
        .slice(0, 2);
    
    // Combine and create search query
    const searchTerms = [...titleWords, ...relevantKeywords];
    return searchTerms.join(' ');
}

/**
 * Fetch image from Pexels API
 */
async function fetchFromPexels(query, apiKey, usedPhotoIds = []) {
    try {
        console.log(`Searching Pexels for: ${query}`);
        
        const response = await axios.get('https://api.pexels.com/v1/search', {
            headers: {
                'Authorization': apiKey
            },
            params: {
                query: query,
                per_page: 20, // Increased for more options
                orientation: 'landscape'
            },
            timeout: 10000
        });
        
        if (response.data && response.data.photos && response.data.photos.length > 0) {
            // Filter out already used photos
            const availablePhotos = response.data.photos.filter(photo => 
                !usedPhotoIds.includes(photo.id.toString())
            );
            
            if (availablePhotos.length === 0) {
                console.log('All photos from this query are already used');
                return null;
            }
            
            const photo = availablePhotos[0]; // Use first available photo
            const imageUrl = photo.src.large2x || photo.src.large;
            
            console.log(`Found unused Pexels image: ${imageUrl} (ID: ${photo.id})`);
            
            // Download and upload to S3
            const s3Url = await downloadAndUploadImage(imageUrl, 'pexels');
            
            // Return image object with license information and photo ID
            return {
                url: s3Url,
                license: 'Pexels License',
                creditText: `Photo by ${photo.photographer} on Pexels`,
                copyrightNotice: `© ${photo.photographer} / Pexels`,
                acquireLicensePage: photo.url,
                source: 'pexels',
                photographer: photo.photographer,
                photographerUrl: photo.photographer_url,
                pexelsPhotoId: photo.id.toString()
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('Error fetching from Pexels:', error.message);
        return null;
    }
}


/**
 * Download image and upload to S3
 */
async function downloadAndUploadImage(imageUrl, source) {
    try {
        console.log(`Downloading image from ${source}: ${imageUrl}`);
        
        // Download image
        const imageBuffer = await downloadImage(imageUrl);
        if (!imageBuffer) {
            throw new Error('Failed to download image');
        }
        
        // Generate S3 key
        const timestamp = Date.now();
        const s3Key = `images/community/${source}-${timestamp}.jpg`;
        
        // Upload to S3
        const s3Url = await uploadToS3(imageBuffer, s3Key);
        
        console.log(`Successfully uploaded community image: ${s3Url}`);
        return s3Url;
        
    } catch (error) {
        console.error('Error downloading and uploading image:', error);
        return null;
    }
}

/**
 * Create article record for DynamoDB
 */
function createArticleRecord(rawItem, generatedContent, processedImages, communityImageUrl = null) {
    const articleId = uuidv4();
    const slug = generateSlug(generatedContent.h1Title);
    
    // Set the main image URL for frontend compatibility
    // For community articles, prioritize community image, otherwise use processed images
    const imageUrl = (typeof communityImageUrl === 'string' ? communityImageUrl : communityImageUrl?.url) || 
                    processedImages.heroImage?.url || 
                    processedImages.cardImage?.url || 
                    processedImages.ogImage?.url || 
                    null;
    
    // Determine category and type based on raw content
    const category = rawItem.category || 'objav-dna';
    const type = category === 'tyzdenny-vyber' ? 'weekly-pick' : 
                 category === 'komunita' ? 'community' : 'discovery';
    
    return {
        articleId: articleId,
        slug: slug,
        title: generatedContent.h1Title,
        metaTitle: generatedContent.metaTitle,
        metaDescription: generatedContent.metaDescription,
        perex: generatedContent.perex,
        content: generatedContent.sections,
        faq: generatedContent.faq || [],
        keywords: generatedContent.keywords || [],
        estimatedReadingTime: generatedContent.estimatedReadingTime || '5 minút',
        category: category,
        type: type,
        status: 'published',
        source: rawItem.source,
        sourceUrl: rawItem.url, // Add original source URL
        originalDate: rawItem.date,
        publishedAt: new Date().toISOString(),
        author: 'Infinite AI',
        imageUrl: imageUrl, // Add imageUrl for frontend compatibility
        images: processedImages,
        rawContentId: rawItem.contentId,
        environment: ENVIRONMENT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Image license information (if available)
        ...(typeof communityImageUrl === 'object' && communityImageUrl && {
            imageLicense: communityImageUrl.license,
            imageCreditText: communityImageUrl.creditText,
            imageCopyrightNotice: communityImageUrl.copyrightNotice,
            imageAcquireLicensePage: communityImageUrl.acquireLicensePage,
            imageSource: communityImageUrl.source,
            imagePhotographer: communityImageUrl.photographer,
            imagePhotographerUrl: communityImageUrl.photographerUrl,
            pexelsPhotoId: communityImageUrl.pexelsPhotoId
        }),
        
        // Processed images license information (for NASA APOD, ESA, etc.)
        ...(processedImages.heroImage?.license && {
            imageLicense: processedImages.heroImage.license,
            imageCreditText: processedImages.heroImage.creditText,
            imageCopyrightNotice: processedImages.heroImage.copyrightNotice,
            imageAcquireLicensePage: processedImages.heroImage.acquireLicensePage,
            imageSource: processedImages.heroImage.source,
            imagePhotographer: processedImages.heroImage.photographer,
            imagePhotographerUrl: processedImages.heroImage.photographerUrl
        }),
        
        // Community-specific fields (cleaned up - no Reddit references)
        ...(category === 'komunita' && {
            // Only store essential fields, no Reddit-specific data
            source: 'community' // Generic source instead of 'reddit'
        })
    };
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[áäčďéíĺľňóôŕšťúýž]/g, (char) => {
            const map = {
                'á': 'a', 'ä': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'í': 'i',
                'ĺ': 'l', 'ľ': 'l', 'ň': 'n', 'ó': 'o', 'ô': 'o', 'ŕ': 'r',
                'š': 's', 'ť': 't', 'ú': 'u', 'ý': 'y', 'ž': 'z'
            };
            return map[char] || char;
        })
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
}

/**
 * Store article in DynamoDB
 */
async function storeArticle(articleRecord) {
    try {
        const params = {
            TableName: ARTICLES_TABLE,
            Item: articleRecord
        };
        
        await dynamodb.send(new PutCommand(params));
        console.log('Article stored successfully:', articleRecord.articleId);
        
    } catch (error) {
        console.error('Error storing article:', error);
        throw new Error('Failed to store article');
    }
}

/**
 * Update raw content status
 */
async function updateRawContentStatus(contentId, source, status) {
    try {
        const params = {
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
        
        await dynamodb.send(new UpdateCommand(params));
        console.log(`Raw content status updated: ${contentId} -> ${status}`);
        
    } catch (error) {
        console.error('Error updating raw content status:', error);
        throw new Error('Failed to update raw content status');
    }
}

/**
 * Check if article already exists for raw content (idempotency check)
 */
async function checkExistingArticle(contentId, source) {
    try {
        console.log(`checkExistingArticle called with contentId: ${contentId}, source: ${source}`);
        
        // Try GSI first, fallback to scan if GSI is not ready
        let result;
        try {
            const params = {
                TableName: ARTICLES_TABLE,
                IndexName: 'rawContentId-source-index',
                KeyConditionExpression: 'rawContentId = :rawContentId AND #source = :source',
                ExpressionAttributeNames: {
                    '#source': 'source'
                },
                ExpressionAttributeValues: {
                    ':rawContentId': contentId,
                    ':source': source
                },
                Limit: 1
            };
            
            console.log('Querying for existing article with GSI params:', JSON.stringify(params, null, 2));
            result = await dynamodb.send(new QueryCommand(params));
            console.log(`GSI Query result: ${result.Items ? result.Items.length : 0} items found`);
            
        } catch (gsiError) {
            console.log('GSI not ready, falling back to scan:', gsiError.message);
            
            // Fallback to scan if GSI is not ready
            const scanParams = {
                TableName: ARTICLES_TABLE,
                FilterExpression: 'rawContentId = :rawContentId AND #source = :source',
                ExpressionAttributeNames: {
                    '#source': 'source'
                },
                ExpressionAttributeValues: {
                    ':rawContentId': contentId,
                    ':source': source
                },
                Limit: 1
            };
            
            console.log('Scanning for existing article with params:', JSON.stringify(scanParams, null, 2));
            result = await dynamodb.send(new ScanCommand(scanParams));
            console.log(`Scan result: ${result.Items ? result.Items.length : 0} items found`);
        }
        
        return result.Items && result.Items.length > 0 ? result.Items[0] : null;
        
    } catch (error) {
        console.error('Error checking existing article:', error);
        return null; // If check fails, allow processing to continue
    }
}

/**
 * Get ESA Hubble content with pending status for processing
 */
async function getESAHubbleContentForProcessing() {
    try {
        console.log('Getting ESA Hubble content for processing...');
        
        // Try GSI first, fallback to scan if GSI is not ready
        let result;
        try {
            // Use GSI for efficient querying by status
            const params = {
                TableName: RAW_CONTENT_TABLE,
                IndexName: 'status-index',
                KeyConditionExpression: '#status = :status',
                FilterExpression: '#source = :source',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#source': 'source'
                },
                ExpressionAttributeValues: {
                    ':status': 'pending',
                    ':source': 'esa-hubble-potw'
                }
            };
            
            console.log('DynamoDB GSI query params for ESA Hubble:', JSON.stringify(params, null, 2));
            result = await dynamodb.send(new QueryCommand(params));
            
        } catch (gsiError) {
            console.log('GSI not ready for ESA Hubble, falling back to scan:', gsiError.message);
            // Fallback to scan if GSI is not ready
            const scanParams = {
                TableName: RAW_CONTENT_TABLE,
                FilterExpression: '#status = :status AND #source = :source',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#source': 'source'
                },
                ExpressionAttributeValues: {
                    ':status': { S: 'pending' },
                    ':source': { S: 'esa-hubble-potw' }
                }
            };
            
            console.log('DynamoDB scan params for ESA Hubble:', JSON.stringify(scanParams, null, 2));
            result = await dynamodbRaw.send(new RawScanCommand(scanParams));
        }

        console.log(`DynamoDB found ${result.Items ? result.Items.length : 0} ESA Hubble items`);
        
        if (result.Items && result.Items.length > 0) {
            // Check if we used GSI (DynamoDBDocumentClient) or scan (raw DynamoDB)
            const firstItem = result.Items[0];
            if (firstItem && typeof firstItem === 'object' && !firstItem.S && !firstItem.N) {
                // DynamoDBDocumentClient already returns converted objects
                console.log(`Found ${result.Items.length} ESA Hubble items for processing (GSI)`);
                return result.Items;
            } else {
                // Raw DynamoDB format from scan - need to convert
                const items = result.Items.map(item => {
                    const converted = {};
                    for (const [key, value] of Object.entries(item)) {
                        if (value.S) converted[key] = value.S;
                        else if (value.N) converted[key] = value.N;
                        else if (value.BOOL !== undefined) converted[key] = value.BOOL;
                        else if (value.SS) converted[key] = value.SS;
                        else if (value.NS) converted[key] = value.NS;
                        else if (value.L) converted[key] = value.L.map(v => v.S || v.N || v.BOOL);
                        else if (value.M) {
                            converted[key] = {};
                            for (const [subKey, subValue] of Object.entries(value.M)) {
                                if (subValue.S) converted[key][subKey] = subValue.S;
                                else if (subValue.N) converted[key][subKey] = subValue.N;
                                else if (subValue.BOOL !== undefined) converted[key][subKey] = subValue.BOOL;
                            }
                        }
                    }
                    return converted;
                });
                console.log(`Found ${items.length} ESA Hubble items for processing (scan)`);
                return items;
            }
        }
        
        return [];
        
    } catch (error) {
        console.error('Error getting ESA Hubble content for processing:', error);
        return [];
    }
}

/**
 * Create community prompt for Reddit-based articles
 */
function createCommunityPrompt(rawItem) {
    return `Si expertný slovenský astronomický novinár. Tvoja úloha je vytvoriť zaujímavý a originálny článok o vesmíre a astronómii na základe zaujímavej témy.

**VSTUPNÉ ÚDAJE:**
- Názov témy: ${rawItem.title}
- Popis: ${rawItem.content || rawItem.description || 'Astronomická téma'}
- Dátum: ${rawItem.date || new Date().toISOString().split('T')[0]}

**Štýl a jazyk:**
- TÓN: Konverzačný, priateľský, ale profesionálny
- ŠTYL: Príbehový, zrozumiteľný
- NEPOUŽÍVAJ EMOJI v nadpisoch ani v texte
- Vysvetľuj veci jednoducho a prirodzene
- Vytváraj otázky prirodzene vložené do textu
- Buď hravý, ale stále informativný

**Požiadavky na článok:**
1. **Meta title** (max 60 znakov): SEO-optimalizovaný názov VÝLUČNE V SLOVENČINE, musí obsahovať hlavné keyword a byť zaujímavý
2. **Meta description** (max 160 znakov): Musí obsahovať hlavné keywords a byť zaujímavý pre vyhľadávače VÝLUČNE V SLOVENČINE
3. **H1 názov**: SEO-optimalizovaný hlavný názov VÝLUČNE V SLOVENČINE (bez emoji), musí obsahovať hlavné keyword
4. **Perex** (MINIMÁLNE 150 znakov): Úvodný text, ktorý zaujme čitateľa
5. **Dynamické sekcie** (3-5 sekcií, každá MINIMÁLNE 300 znakov):
   - Vytvor 3-5 sekcií s názvami, ktoré prirodzene vyplývajú z obsahu témy
   - Názvy musia byť chytľavé a zaujímavé
   - Príklady dobrých názvov podľa typu obsahu:
     * Pre objavy: "Ako to celé začalo", "Čo to znamená pre vedu", "Prekvapivé detaily"
     * Pre javy: "Ako to funguje", "Prečo je to fascinujúce", "Čo ďalej očakávať"
     * Pre misie: "Ciele misie", "Technológia za tým", "Čo sa môže stať"
   - Sekcie musia prirodzene prúdiť a rozprávať príbeh
6. **FAQ sekcia** (3-5 otázok):
   - Vytvor prirodzené otázky založené na obsahu
   - Otázky musia byť relevantné k téme
   - Odpovede stručné ale informatívne (každá MINIMÁLNE 100 znakov)
7. **Keywords** (5-8 slovenských výrazov): Vytvor relevantné keywords pre SEO

**DÔLEŽITÉ:**
- Celkový obsah MUSÍ mať aspoň 1200 znakov!
- Vysvetľuj astronomické pojmy jednoducho
- Vytváraj chytľavé názvy sekcií, ktoré budú zaujímať čitateľov
- Článok musí vyzerať ako originálny obsah, nie ako preklad alebo citácia

**Formát výstupu (JSON):**
\`\`\`json
{
  "metaTitle": "Názov pre SEO",
  "metaDescription": "Popis pre SEO",
  "h1Title": "Hlavný názov bez emoji",
  "perex": "Úvodný text...",
  "sections": [
    {
      "title": "Dynamický názov sekcie",
      "content": "Obsah sekcie..."
    },
    {
      "title": "Ďalší zaujímavý názov", 
      "content": "Obsah s citátmi..."
    }
  ],
  "faq": [
    {
      "question": "Otázka založená na obsahu",
      "answer": "Stručná ale informatívna odpoveď"
    }
  ],
  "keywords": ["kľúčové", "slová", "pre", "seo"],
  "estimatedReadingTime": "X minút"
}
\`\`\`

Vytvor zaujímavý, originálny článok, ktorý bude informatívny a zaujímavý pre čitateľov!`;
}

// Export functions for testing
module.exports = {
    handler: exports.handler,
    getOpenAIApiKey,
    getRawContentForProcessing,
    generateSlovakArticle,
    createCommunityPrompt,
    validateGeneratedContent,
    createArticleRecord,
    storeArticle,
    checkExistingArticle,
    fetchCommunityImage,
    fetchFromPexels,
    getUsedPexelsPhotoIds
};
