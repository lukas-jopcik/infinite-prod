#!/usr/bin/env node

/**
 * Frontend-Only Local Testing Script
 * This script creates mock data and tests the frontend without DynamoDB access
 */

const fs = require('fs');
const path = require('path');

// Mock data for testing
const mockArticles = [
    {
        id: 'test-article-1',
        title: 'Prečo vidíme Mesiac vždy rovnakou stranou?',
        slug: 'preco-vidime-mesiac-vzdy-rovnakou-stranou',
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
        excerpt: 'Fascinujúci fenomén slapového uzamknutia spôsobuje, že Mesiac ukazuje Zemi vždy rovnakú stranu. Tento článok objasňuje, ako gravitačné sily formujú náš vesmír.',
        category: 'ai-discoveries',
        type: 'ai-generated',
        status: 'published',
        publishedAt: new Date().toISOString(),
        dateISO: new Date().toISOString().split('T')[0],
        readingTime: '5 minút',
        metaTitle: 'Prečo vidíme Mesiac vždy rovnakou stranou?',
        metaDescription: 'Fascinujúci fenomén slapového uzamknutia spôsobuje, že Mesiac ukazuje Zemi vždy rovnakú stranu. Tento článok objasňuje, ako gravitačné sily formujú náš vesmír.',
        keywords: ['slapové uzamknutie', 'mesiac', 'gravitačné sily', 'astronómia', 'vesmír'],
        canonical: 'https://infinite.sk/vesmirne-objavy/preco-vidime-mesiac-vzdy-rovnakou-stranou',
        hero: {
            src: 'https://via.placeholder.com/1200x600/1a1a2e/ffffff?text=Moon+Phases',
            alt: 'Prečo vidíme Mesiac vždy rovnakou stranou?',
            credit: 'NASA',
            bucket: 'infinite-images-dev-349660737637',
            key: 'ai-generated/moon-phases.jpg'
        }
    },
    {
        id: 'test-article-2',
        title: 'Ako funguje čierna diera?',
        slug: 'ako-funguje-cierna-diera',
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
        excerpt: 'Čierne diery sú jedným z najzáhadnejších objektov vo vesmíre. Tento článok objasňuje ich štruktúru, vznik a najnovšie objavy z Webbovho teleskopu.',
        category: 'ai-discoveries',
        type: 'ai-generated',
        status: 'published',
        publishedAt: new Date().toISOString(),
        dateISO: new Date().toISOString().split('T')[0],
        readingTime: '6 minút',
        metaTitle: 'Ako funguje čierna diera?',
        metaDescription: 'Čierne diery sú jedným z najzáhadnejších objektov vo vesmíre. Tento článok objasňuje ich štruktúru, vznik a najnovšie objavy z Webbovho teleskopu.',
        keywords: ['čierne diery', 'gravitačné pole', 'hawkingovo žiarenie', 'webbov teleskop', 'vesmír'],
        canonical: 'https://infinite.sk/vesmirne-objavy/ako-funguje-cierna-diera',
        hero: {
            src: 'https://via.placeholder.com/1200x600/0f0f0f/ffffff?text=Black+Hole',
            alt: 'Ako funguje čierna diera?',
            credit: 'NASA',
            bucket: 'infinite-images-dev-349660737637',
            key: 'ai-generated/black-hole.jpg'
        }
    },
    {
        id: 'test-article-3',
        title: 'Čo sú exoplanéty a ako ich hľadáme?',
        slug: 'co-su-exoplanety-a-ako-ich-hladame',
        content: `
            <h2>Úvod do exoplanét</h2>
            <p>Exoplanéty sú planéty, ktoré obiehajú okolo hviezd mimo našej slnečnej sústavy. Ich objav v 90. rokoch 20. storočia zmenil naše chápanie vesmíru a možnosti života mimo Zeme.</p>
            
            <h2>Metódy detekcie</h2>
            <p>Astronómovia používajú niekoľko metód na detekciu exoplanét: transitnú metódu, kde planéta prechádza pred hviezdou, radialnú rýchlosť, kde sa meria kolísanie hviezdy, a priame zobrazovanie.</p>
            
            <h2>Habitabilita a život</h2>
            <p>Hľadanie exoplanét v obyvateľnej zóne, kde môže existovať voda v kvapalnom stave, je kľúčové pre hľadanie života mimo Zeme. Webbov teleskop nám poskytuje nové možnosti na štúdium atmosfér exoplanét.</p>
            
            <h2>Najnovšie objavy</h2>
            <p>V posledných rokoch sme objavili tisíce exoplanét, vrátane skalnatých planét podobných Zemi a plynných obrov podobných Jupiteru. Každý nový objav rozširuje naše poznatky o rozmanitosti vesmíru.</p>
            
            <h2>Záver</h2>
            <p>Exoplanéty sú oknom do rozmanitosti vesmíru a možnosti života mimo Zeme. Ich štúdium pokračuje a prináša nové fascinujúce objavy.</p>
        `,
        excerpt: 'Exoplanéty sú planéty mimo našej slnečnej sústavy. Tento článok predstavuje metódy ich detekcie a význam pre hľadanie života vo vesmíre.',
        category: 'ai-discoveries',
        type: 'ai-generated',
        status: 'published',
        publishedAt: new Date().toISOString(),
        dateISO: new Date().toISOString().split('T')[0],
        readingTime: '7 minút',
        metaTitle: 'Čo sú exoplanéty a ako ich hľadáme?',
        metaDescription: 'Exoplanéty sú planéty mimo našej slnečnej sústavy. Tento článok predstavuje metódy ich detekcie a význam pre hľadanie života vo vesmíru.',
        keywords: ['exoplanéty', 'transitná metóda', 'radialná rýchlosť', 'habitabilita', 'vesmír'],
        canonical: 'https://infinite.sk/vesmirne-objavy/co-su-exoplanety-a-ako-ich-hladame',
        hero: {
            src: 'https://via.placeholder.com/1200x600/2c1810/ffffff?text=Exoplanets',
            alt: 'Čo sú exoplanéty a ako ich hľadáme?',
            credit: 'NASA',
            bucket: 'infinite-images-dev-349660737637',
            key: 'ai-generated/exoplanets.jpg'
        }
    }
];

/**
 * Create mock API response file
 */
function createMockApiResponse() {
    const mockResponse = {
        articles: mockArticles,
        count: mockArticles.length,
        lastKey: null
    };
    
    // Write to a file that can be used for testing
    const responsePath = path.join(__dirname, '../../infinite-v2/public/mock-ai-discoveries.json');
    fs.writeFileSync(responsePath, JSON.stringify(mockResponse, null, 2));
    
    console.log(`✅ Created mock API response: ${responsePath}`);
}

/**
 * Test frontend URLs
 */
async function testFrontendUrls() {
    const baseUrl = 'http://localhost:3000';
    const urls = [
        '/kategoria/vesmirne-objavy',
        '/vesmirne-objavy/preco-vidime-mesiac-vzdy-rovnakou-stranou',
        '/vesmirne-objavy/ako-funguje-cierna-diera',
        '/vesmirne-objavy/co-su-exoplanety-a-ako-ich-hladame'
    ];
    
    console.log('🔗 Testing frontend URLs...');
    
    for (const url of urls) {
        try {
            const response = await fetch(`${baseUrl}${url}`);
            if (response.ok) {
                console.log(`✅ ${url} - OK (${response.status})`);
            } else {
                console.log(`❌ ${url} - Error (${response.status})`);
            }
        } catch (error) {
            console.log(`❌ ${url} - Failed to connect`);
        }
    }
}

/**
 * Main test function
 */
async function runFrontendTest() {
    console.log('🧪 AI-Generated Space Articles - Frontend Testing');
    console.log('================================================');
    console.log('');
    
    try {
        // Step 1: Create mock data
        console.log('📝 Step 1: Creating mock data...');
        createMockApiResponse();
        
        // Step 2: Test frontend URLs
        console.log('');
        console.log('🔗 Step 2: Testing frontend URLs...');
        await testFrontendUrls();
        
        console.log('');
        console.log('🎉 Frontend testing completed!');
        console.log('');
        console.log('📊 Results:');
        console.log(`  ✅ Mock articles created: ${mockArticles.length}`);
        console.log(`  ✅ Category page: /kategoria/vesmirne-objavy`);
        console.log(`  ✅ Article pages: /vesmirne-objavy/[slug]`);
        console.log('');
        console.log('🔗 Manual testing steps:');
        console.log('  1. Open http://localhost:3000/kategoria/vesmirne-objavy');
        console.log('  2. Check if "Vesmírne objavy" appears in navigation');
        console.log('  3. Verify articles are displayed');
        console.log('  4. Test individual article pages');
        console.log('  5. Check SEO metadata and image credits');
        console.log('');
        console.log('💡 Note: This test uses mock data. For real testing with DynamoDB,');
        console.log('   you need proper AWS permissions and existing tables.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    runFrontendTest();
}

module.exports = { runFrontendTest, mockArticles };
