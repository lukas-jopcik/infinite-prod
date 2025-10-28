#!/usr/bin/env node

/**
 * Local Testing Script for AI-Generated Space Articles
 * This script simulates the Lambda functions locally for testing
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const ENVIRONMENT = 'dev';
const REGION = 'eu-central-1';
const RAW_CONTENT_TABLE = `InfiniteRawContent-${ENVIRONMENT}`;
const ARTICLES_TABLE = `InfiniteArticles-${ENVIRONMENT}`;

// Initialize DynamoDB client
const dynamodbClient = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

// Mock OpenAI API key (replace with real key for testing)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

/**
 * Mock NASA image data for testing
 */
const mockImages = [
    {
        id: 'test-image-1',
        title: 'Webb Telescope Deep Field',
        description: 'A stunning deep field image from the James Webb Space Telescope showing distant galaxies',
        imageUrl: 'https://via.placeholder.com/800x600/1a1a2e/ffffff?text=Webb+Telescope+Deep+Field',
        owner: 'NASA/Webb Telescope',
        license: 'public-domain',
        source: 'nasa-webb-flickr',
        s3Key: 'ai-generated/test-image-1.jpg',
        s3Url: 'https://via.placeholder.com/800x600/1a1a2e/ffffff?text=Webb+Telescope+Deep+Field',
        bucket: 'infinite-images-dev-349660737637',
        uploadedAt: new Date().toISOString()
    },
    {
        id: 'test-image-2',
        title: 'Earth from Space',
        description: 'Beautiful view of Earth from the International Space Station',
        imageUrl: 'https://via.placeholder.com/800x600/0f4c75/ffffff?text=Earth+from+Space',
        owner: 'NASA Earth Observatory',
        license: 'public-domain',
        source: 'nasa-earth-observatory',
        s3Key: 'ai-generated/test-image-2.jpg',
        s3Url: 'https://via.placeholder.com/800x600/0f4c75/ffffff?text=Earth+from+Space',
        bucket: 'infinite-images-dev-349660737637',
        uploadedAt: new Date().toISOString()
    }
];

/**
 * Generate mock article idea (simulates OpenAI response)
 */
function generateMockIdea(imageData) {
    const ideas = [
        {
            title: "Prečo vidíme Mesiac vždy rovnakou stranou?",
            ideaSummary: "Tento článok by preskúmal fascinujúci fenomén slapového uzamknutia, ktorý spôsobuje, že Mesiac ukazuje Zemi vždy rovnakú stranu. Vysvetlil by gravitačné sily a ich vplyv na rotáciu Mesiaca.",
            keyTopics: ["Slapové uzamknutie", "Gravitačné sily", "Rotácia Mesiaca", "Fázy Mesiaca"],
            targetAudience: "general public"
        },
        {
            title: "Ako funguje čierna diera?",
            ideaSummary: "Článok by objasnil základy čiernych dier, ich vznik, štruktúru a vplyv na okolité vesmírne objekty. Pokryl by aj najnovšie objavy z Webbovho teleskopu.",
            keyTopics: ["Čierne diery", "Gravitačné pole", "Hawkingovo žiarenie", "Webbov teleskop"],
            targetAudience: "general public"
        },
        {
            title: "Čo sú exoplanéty a ako ich hľadáme?",
            ideaSummary: "Tento článok by predstavil exoplanéty - planéty mimo našej slnečnej sústavy. Vysvetlil by metódy ich detekcie a význam pre hľadanie života vo vesmíre.",
            keyTopics: ["Exoplanéty", "Transitná metóda", "Radialná rýchlosť", "Habitabilita"],
            targetAudience: "general public"
        }
    ];
    
    return ideas[Math.floor(Math.random() * ideas.length)];
}

/**
 * Generate mock Slovak article (simulates OpenAI response)
 */
function generateMockSlovakArticle(ideaData) {
    const articles = [
        {
            title: "Prečo vidíme Mesiac vždy rovnakou stranou?",
            content: `
                <h2>Úvod do slapového uzamknutia</h2>
                <p>Ak ste si niekedy všimli, že Mesiac má vždy rovnakú tvár, nie je to náhoda. Tento fascinujúci astronomický fenomén sa nazýva slapové uzamknutie a je výsledkom komplexnej interakcie gravitačných síl medzi Zemou a Mesiacom.</p>
                
                <h2>Ako funguje slapové uzamknutie</h2>
                <p>Slapové uzamknutie vzniká v dôsledku rozdielnych gravitačných síl pôsobiacich na rôzne časti Mesiaca. Blízka strana Mesiaca je príťahovaná silnejšie ako vzdialená strana, čo spôsobuje deformáciu tvaru Mesiaca.</p>
                
                <h2>Historický vývoj</h2>
                <p>Pred miliardami rokov sa Mesiac otáčal rýchlejšie. Postupne sa však jeho rotácia spomalila vďaka gravitačnému vplyvu Zeme, až sa nakoniec ustálila v súčasnom stave.</p>
                
                <h2>Dôsledky pre pozorovanie</h2>
                <p>Vďaka slapovému uzamknutiu vidíme z Zeme vždy iba 59% povrchu Mesiaca. Zvyšných 41% zostáva navždy skrytých pred našimi očami.</p>
                
                <h2>Záver</h2>
                <p>Slapové uzamknutie je úžasným príkladom toho, ako gravitačné sily formujú náš vesmír. Tento fenomén nám pomáha lepšie pochopiť dynamiku planetárnych systémov.</p>
            `,
            excerpt: "Fascinujúci fenomén slapového uzamknutia spôsobuje, že Mesiac ukazuje Zemi vždy rovnakú stranu. Tento článok objasňuje, ako gravitačné sily formujú náš vesmír.",
            keywords: ["slapové uzamknutie", "mesiac", "gravitačné sily", "astronómia", "vesmír"],
            readingTime: "5 minút"
        },
        {
            title: "Ako funguje čierna diera?",
            content: `
                <h2>Čo sú čierne diery</h2>
                <p>Čierne diery sú jedným z najzáhadnejších objektov vo vesmíre. Vznikajú, keď sa masívna hviezda zrúti pod vlastnou gravitáciou do nekonečne malého bodu nazývaného singularita.</p>
                
                <h2>Štruktúra čiernej diery</h2>
                <p>Čierna diera má tri hlavné časti: horizont udalostí, kde sa časopriestor ohýba tak silno, že ani svetlo nemôže uniknúť, ergosféru a samotnú singularitu.</p>
                
                <h2>Hawkingovo žiarenie</h2>
                <p>Stephen Hawking teoreticky predpovedal, že čierne diery nie sú úplne čierne - vyžarujú malé množstvo energie nazývanej Hawkingovo žiarenie.</p>
                
                <h2>Najnovšie objavy</h2>
                <p>Webbov teleskop nám poskytol nové pohľady na čierne diery a ich vplyv na okolité galaxie. Tieto objavy nám pomáhajú lepšie pochopiť vývoj vesmíru.</p>
                
                <h2>Záver</h2>
                <p>Čierne diery sú kľúčom k pochopeniu najzákladnejších zákonov fyziky a vývoju vesmíru. Ich štúdium pokračuje a prináša nové fascinujúce objavy.</p>
            `,
            excerpt: "Čierne diery sú jedným z najzáhadnejších objektov vo vesmíre. Tento článok objasňuje ich štruktúru, vznik a najnovšie objavy z Webbovho teleskopu.",
            keywords: ["čierne diery", "gravitačné pole", "hawkingovo žiarenie", "webbov teleskop", "vesmír"],
            readingTime: "6 minút"
        }
    ];
    
    return articles[Math.floor(Math.random() * articles.length)];
}

/**
 * Store idea in DynamoDB
 */
async function storeIdea(ideaData, imageData) {
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
            aiPrompt: 'Mock prompt for testing',
            createdAt: now.toISOString(),
            dateISO: dateISO,
            // Image data
            imageUrl: imageData.s3Url,
            imageBucket: imageData.bucket,
            imageKey: imageData.s3Key,
            imageCredit: imageData.owner,
            imageLicense: imageData.license,
            imageNasaId: imageData.id,
            originalUrl: imageData.imageUrl,
            uploadedAt: imageData.uploadedAt
        };
        
        const params = {
            TableName: RAW_CONTENT_TABLE,
            Item: item
        };
        
        await dynamodb.send(new PutCommand(params));
        console.log(`✅ Stored idea: ${ideaData.title}`);
        
        return contentId;
        
    } catch (error) {
        console.error('❌ Error storing idea:', error);
        throw error;
    }
}

/**
 * Store article in DynamoDB
 */
async function storeArticle(ideaData, articleData, contentId) {
    try {
        const articleId = uuidv4();
        const now = new Date();
        const dateISO = now.toISOString().split('T')[0];
        
        // Generate slug from title
        const slug = articleData.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        
        const article = {
            id: articleId,
            rawContentId: contentId,
            title: articleData.title,
            slug: slug,
            content: articleData.content,
            excerpt: articleData.excerpt,
            category: 'ai-discoveries',
            type: 'ai-generated',
            status: 'published',
            publishedAt: now.toISOString(),
            dateISO: dateISO,
            readingTime: articleData.readingTime,
            // SEO metadata
            metaTitle: articleData.title.length > 60 ? articleData.title.substring(0, 57) + '...' : articleData.title,
            metaDescription: articleData.excerpt.length > 155 ? articleData.excerpt.substring(0, 152) + '...' : articleData.excerpt,
            keywords: articleData.keywords,
            canonical: `https://infinite.sk/vesmirne-objavy/${slug}`,
            // Hero image
            hero: {
                src: 'https://via.placeholder.com/1200x600/1a1a2e/ffffff?text=Space+Image',
                alt: articleData.title,
                credit: 'NASA',
                bucket: 'infinite-images-dev-349660737637',
                key: 'ai-generated/hero-image.jpg'
            },
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
        console.log(`✅ Stored article: ${articleData.title}`);
        
        return articleId;
        
    } catch (error) {
        console.error('❌ Error storing article:', error);
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
                contentId: contentId
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
        console.log(`✅ Updated idea status to processed: ${contentId}`);
        
    } catch (error) {
        console.error('❌ Error updating idea status:', error);
        throw error;
    }
}

/**
 * Main test function
 */
async function runLocalTest() {
    console.log('🧪 Starting Local AI-Generated Space Articles Test');
    console.log('================================================');
    console.log('');
    
    try {
        // Step 1: Generate and store ideas
        console.log('📝 Step 1: Generating mock ideas...');
        const contentIds = [];
        
        for (const imageData of mockImages) {
            const ideaData = generateMockIdea(imageData);
            const contentId = await storeIdea(ideaData, imageData);
            contentIds.push(contentId);
        }
        
        console.log(`✅ Generated ${contentIds.length} ideas`);
        console.log('');
        
        // Step 2: Process ideas into articles
        console.log('📄 Step 2: Processing ideas into articles...');
        
        for (const contentId of contentIds) {
            // Get the idea data (simplified - in real Lambda we'd query DynamoDB)
            const ideaData = generateMockIdea(mockImages[0]);
            const articleData = generateMockSlovakArticle(ideaData);
            
            const articleId = await storeArticle(ideaData, articleData, contentId);
            await updateIdeaStatus(contentId);
            
            console.log(`✅ Processed idea ${contentId} → article ${articleId}`);
        }
        
        console.log('');
        console.log('🎉 Local test completed successfully!');
        console.log('');
        console.log('📊 Results:');
        console.log(`  ✅ Ideas generated: ${contentIds.length}`);
        console.log(`  ✅ Articles created: ${contentIds.length}`);
        console.log(`  ✅ Ideas processed: ${contentIds.length}`);
        console.log('');
        console.log('🔗 Next steps:');
        console.log('  1. Check frontend at http://localhost:3000/kategoria/vesmirne-objavy');
        console.log('  2. Verify articles appear in the category page');
        console.log('  3. Check individual article pages');
        console.log('  4. Test navigation and SEO metadata');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    runLocalTest();
}

module.exports = { runLocalTest };
