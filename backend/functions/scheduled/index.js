const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const crypto = require('crypto');
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
            // Get raw content items that need processing (APOD content with status: "raw")
            const apodItems = await getRawContentForProcessing();
            
            // Also get ESA Hubble content with pending status
            const esaHubbleItems = await getESAHubbleContentForProcessing();
            
            // Combine both types of content
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
        
        let processedCount = 0;
        let errorCount = 0;
        const results = [];
        
            // Process each raw content item
            for (const rawItem of rawContentItems) {
                try {
                    console.log(`Processing raw content: ${rawItem.contentId}`);
                    
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
                
                // Create article record
                const articleRecord = createArticleRecord(rawItem, generatedArticle, processedImages);
                
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
 * Get raw content items that need processing - Sequential processing (1 article at a time)
 */
async function getRawContentForProcessing() {
    try {
        console.log('Getting raw content for processing (sequential mode)...');
        
        // Scan for RAW articles with IMAGE type only (exclude 'processing' and 'processed')
            const scanParams = {
                TableName: RAW_CONTENT_TABLE,
            FilterExpression: '#status = :rawStatus AND mediaType = :imageType',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                ':rawStatus': 'raw',
                ':imageType': 'image'
                }
            };
            
            console.log('DynamoDB scan params:', JSON.stringify(scanParams, null, 2));
        const result = await dynamodb.send(new ScanCommand(scanParams));
        
        console.log(`DynamoDB found ${result.Items ? result.Items.length : 0} raw image articles`);
        
        if (!result.Items || result.Items.length === 0) {
            console.log('No raw content found for processing');
            return [];
        }
        
        // Sort by date descending (newest first)
        const sortedItems = result.Items.sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        // Try to claim articles until we find one that's not already claimed
        for (const item of sortedItems) {
            console.log(`Attempting to claim: ${item.date} - ${item.title}`);
            const claimed = await claimRawContentForProcessing(item.contentId, item.source);
            
            if (claimed) {
                console.log(`✅ Successfully claimed article for processing`);
                return [item];
            } else {
                console.log(`⚠️  Article already claimed, trying next one...`);
            }
        }
        
        console.log('No unclaimed articles found');
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
        
        const requestBody = {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "Si expertný astronóm a skvelý slovenský spisovateľ. Tvoja úloha je vytvoriť zaujímavý, vedecky presný a ľahko zrozumiteľný článok o astronómii v slovenčine."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 6000,
            temperature: 0.7,
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
    const isNASANews = rawItem.category === 'news' && rawItem.source === 'nasa-news';
    
    if (isWeeklyPick) {
        return createWeeklyPickPrompt(rawItem);
    } else if (isNASANews) {
        return createNASANewsPrompt(rawItem);
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

function createNASANewsPrompt(rawItem) {
    return `
🚨 KRITICKÉ UPOZORNENIE: TENTO ČLÁNOK MUSÍ MAŤ MINIMÁLNE 1200 ZNAKOV CELKOVO! 🚨
🚨 AK ČLÁNOK NEBUDE DOSTATOČNE DLHÝ, BUDE ZAMIETNUTÝ! 🚨

**VSTUPNÉ DÁTA NASA:**
- Názov: ${rawItem.title || 'NASA správa'}
- Dátum: ${rawItem.date || new Date().toISOString().split('T')[0]}
- Popis: ${rawItem.explanation || rawItem.description || 'NASA správa o vesmírnom objave'}
- Zdroj: ${rawItem.url || 'NASA'}

**Požiadavky na článok (VESMÍRNE NOVINKY - BULVÁRNY ŠTÝL):**
1. **Meta title** (MAXIMÁLNE 60 ZNAKOV!): Bulvárny, dramatický, ale pravdivý názov VÝLUČNE V SLOVENČINE
   - Formát: "[Krátky dramatický opis] – Vesmírne novinky [deň. mesiac, rok]"
   - KRITICKÉ: NEPOUŽÍVAJ "NASA" na začiatku meta title! Buď kreatívny!
   - Príklady: "Mars šokuje vedcov! – Vesmírne novinky 7.10.2025", "Prelomový objav! – Vesmírne novinky 7.10.2025"
   - KRITICKÉ: Meta title MUSÍ byť kratší ako 60 znakov! Počítaj každý znak!
2. **Meta description** (max 160 znakov): Krátky, pútavý popis článku VÝLUČNE V SLOVENČINE
3. **H1 názov**: Bulvárny hlavný názov VÝLUČNE V SLOVENČINE (60-90 znakov)
   - Formát: "[Dramatický, ale pravdivý nadpis]"
   - KRITICKÉ: NEPOUŽÍVAJ "NASA" na začiatku nadpisu! Buď kreatívny!
   - Príklady: "Mars odhaľuje nové tajomstvá", "Vesmírny objav šokuje vedcov", "Prelomový nález na Marse"
4. **Podnadpis (H2)**: 1-2 vety, ktoré vysvetlia, čo sa v skutočnosti stalo
5. **Úvodný odstavec** (MINIMÁLNE 100 znakov): 2-3 vety, ktoré zaujmú hneď na začiatku
6. **4 H2 sekcií** s podrobným obsahom (každá sekcia MINIMÁLNE 200 znakov):
   - **Čo NASA zistila** (MINIMÁLNE 200 znakov) - hlavné fakty, jednoduchý jazyk
   - **Čo to znamená pre vedu** (MINIMÁLNE 200 znakov) - dôležitosť, metafory pre jasnosť
   - **Zaujímavosti a širší kontext** (MINIMÁLNE 200 znakov) - prepojenia na iné misie
   - **Reakcie alebo zhrnutie** (MINIMÁLNE 200 znakov) - citácie ak sú dostupné, silný záver
7. **Záver** (MINIMÁLNE 100 znakov): Otázka alebo úvaha, ktorá čitateľa zapojí
8. **FAQ sekcia** s 3 otázkami a odpoveďami (každá odpoveď MINIMÁLNE 100 znakov)

**Štýl a jazyk (BULVÁRNY, ALE FAKTICKÝ):**
- Používaj správnu slovenčinu s diakritikou
- Píš pre širokú verejnosť (nie pre odborníkov)
- Vysvetľuj zložité pojmy jednoducho
- Používaj aktívny rod
- Vedecky presné, ale zrozumiteľné
- **TÓN: Bulvárny, dramatický, ale fakticky presný**
- **ŠTYL: Krátke vety, jasné myšlienky, rytmus**
- **KRITICKÉ: Všetky názvy, nadpisy a titulky MUSÍ byť VÝLUČNE V SLOVENČINE - žiadne anglické slová!**
- **KRITICKÉ: Nepoužívaj anglické slová ako "image", "credit", "amazing", "incredible" atď.**
- **KRITICKÉ: Prekladaj všetky anglické termíny do slovenčiny**
- **KRITICKÉ: Bulvárny nadpis musí byť dramatický, ale NESMIE klamať!**
- **KRITICKÉ: NEPOUŽÍVAJ "NASA" na začiatku nadpisov! Buď kreatívny s rôznymi začiatkami!**

🚨 FINÁLNE UPOZORNENIE: PÍŠ BULVÁRNY, ALE FAKTICKY PRESNÝ ČLÁNOK! 🚨
🚨 CELKOVÝ obsah MUSÍ mať aspoň 1200 znakov, inak bude článok zamietnutý! 🚨

**Formát výstupu:**
Vráť obsah v JSON formáte (MUSÍ byť platný JSON!):
{
  "metaTitle": "Mars šokuje vedcov! – Vesmírne novinky 7.10.2025",
  "metaDescription": "Prelomový objav na Marse môže zmeniť naše chápanie vesmíru. Čítajte viac o tejto senzácii!",
  "h1Title": "Mars odhaľuje nové tajomstvá, ktoré šokujú vedcov",
  "perex": "NASA oznámila prelomový objav, ktorý šokoval celý vedecký svet. Na Marse našli niečo, čo nikto neočakával.",
  "sections": [
    {"title": "Čo NASA zistila", "content": "NASA objavila na Marse..."},
    {"title": "Čo to znamená pre vedu", "content": "Tento objav môže zmeniť..."},
    {"title": "Zaujímavosti a širší kontext", "content": "Toto nie je prvý raz..."},
    {"title": "Reakcie alebo zhrnutie", "content": "Vedci sú v šoku..."}
  ],
  "faq": [
    {"question": "Čo presne NASA objavila?", "answer": "NASA objavila..."},
    {"question": "Prečo je to dôležité?", "answer": "Tento objav je dôležitý..."},
    {"question": "Čo to znamená pre budúcnosť?", "answer": "Pre budúcnosť to znamená..."}
  ],
  "keywords": ["NASA", "Mars", "objav", "vesmír", "veda", "šok"],
  "estimatedReadingTime": "5 minút"
}

🚨 KRITICKÉ: Meta title MUSÍ byť kratší ako 60 znakov a MUSÍ byť v JSON formáte!

**PAMATUJ SI:** Celkový obsah MUSÍ mať aspoň 1200 znakov, inak bude článok zamietnutý!
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
        
        // Validate required fields
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
    const isNASANews = category === 'news';
    
    // Check required fields
    if (!generatedContent.metaTitle) {
        errors.push('Meta title is missing');
    } else if (generatedContent.metaTitle.length > 60) {
        errors.push(`Meta title is too long (max 60 characters, got ${generatedContent.metaTitle.length}): "${generatedContent.metaTitle}"`);
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
    } else if (isNASANews) {
        // NASA news should have exactly 4 sections
        if (!generatedContent.sections || generatedContent.sections.length !== 4) {
            errors.push('NASA news must have exactly 4 sections');
        }
    } else {
        // Daily discoveries should have exactly 5 sections
        if (!generatedContent.sections || generatedContent.sections.length !== 5) {
            errors.push('Daily discoveries must have exactly 5 sections');
        }
    }
    
    if (!generatedContent.faq || generatedContent.faq.length < 3) {
        errors.push('Must have at least 3 FAQ items');
    }
    
    // Check content quality
    const totalContentLength = generatedContent.perex.length + 
        generatedContent.sections.reduce((sum, section) => sum + section.content.length, 0);
    
    // Different minimum lengths for different content types
    const minLength = isWeeklyPick ? 1500 : (isNASANews ? 1200 : 2000);
    if (totalContentLength < minLength) {
        errors.push(`Total content length is too short (min ${minLength} characters, got ${totalContentLength})`);
    }
    
    // Check individual section lengths
    if (generatedContent.sections) {
        const minSectionLength = isNASANews ? 200 : 300;
        generatedContent.sections.forEach((section, index) => {
            if (section.content.length < minSectionLength) {
                errors.push(`Section ${index + 1} is too short (min ${minSectionLength} characters, got ${section.content.length})`);
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
        
        // Get the main image URL - prioritize imageUrl over url for ESA content
        const imageUrl = rawItem.imageUrl || rawItem.media_url || rawItem.url;
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
                        height: config.height
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
        
        const buffer = Buffer.from(response.data);
        
        // Validate that we got an actual image, not HTML
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.startsWith('image/')) {
            console.error(`Invalid content type: ${contentType}. Expected image/*`);
            return null;
        }
        
        // Check for HTML content by looking for common HTML markers
        const firstBytes = buffer.slice(0, 200);
        const text = firstBytes.toString('utf8').toLowerCase();
        if (text.includes('<html') || text.includes('<!doctype') || text.includes('<head>')) {
            console.error('Downloaded content appears to be HTML, not an image');
            return null;
        }
        
        // Validate JPEG/PNG headers
        const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
        const isWebP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
        
        if (!isJPEG && !isPNG && !isWebP) {
            console.warn('Downloaded content may not be a valid image format');
        }
        
        console.log(`Successfully downloaded image: ${buffer.length} bytes, content-type: ${contentType}`);
        return buffer;
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
    const source = rawItem.source === 'apod' ? 'APOD / NASA' : 'ESA / Hubble';
    
    return `${title} - ${source}`;
}

/**
 * Create article record for DynamoDB
 */
function createArticleRecord(rawItem, generatedContent, processedImages) {
    const articleId = crypto.randomUUID();
    const slug = generateSlug(generatedContent.h1Title);
    
    // Set the main image URL for frontend compatibility
    const imageUrl = processedImages.heroImage?.url || processedImages.cardImage?.url || processedImages.ogImage?.url || null;
    
    // Determine category and type based on raw content
    const category = rawItem.category || 'objav-dna';
    let type = 'discovery';
    if (category === 'tyzdenny-vyber') {
        type = 'weekly-pick';
    } else if (category === 'news') {
        type = 'news';
    }
    
    return {
        articleId: articleId,
        slug: slug,
        title: generatedContent.h1Title,
        metaTitle: generatedContent.metaTitle,
        metaDescription: generatedContent.metaDescription,
        perex: generatedContent.perex,
        content: generatedContent.sections,
        faq: generatedContent.faq,
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
        updatedAt: new Date().toISOString()
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
 * Atomically claim a raw content item for processing (prevents race conditions)
 * Returns true if successfully claimed, false if already claimed by another process
 */
async function claimRawContentForProcessing(contentId, source) {
    try {
        const params = {
            TableName: RAW_CONTENT_TABLE,
            Key: {
                contentId: contentId,
                source: source
            },
            UpdateExpression: 'SET #status = :processing, updatedAt = :updatedAt',
            ConditionExpression: '#status = :raw',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':raw': 'raw',
                ':processing': 'processing',
                ':updatedAt': new Date().toISOString()
            }
        };
        
        await dynamodb.send(new UpdateCommand(params));
        console.log(`✅ Successfully claimed ${contentId} for processing`);
        return true;
        
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.log(`⚠️  Article ${contentId} already claimed by another process`);
            return false;
        }
        console.error('Error claiming raw content:', error);
        throw error;
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
            result = await dynamodbRaw.send(new ScanCommand(scanParams));
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

// Export functions for testing
module.exports = {
    handler: exports.handler,
    getOpenAIApiKey,
    getRawContentForProcessing,
    generateSlovakArticle,
    validateGeneratedContent,
    createArticleRecord,
    storeArticle
};
