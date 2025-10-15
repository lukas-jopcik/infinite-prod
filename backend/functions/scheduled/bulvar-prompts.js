/**
 * Slovak Bulvár AI Prompts for Space.com Content Generation
 * These prompts create engaging, pop-sci style articles in Slovak language
 */

/**
 * Main bulvár article generation prompt
 */
const BULVAR_ARTICLE_PROMPT = `
Úloha: Vytvor bulvárny, ale faktický článok v slovenčine zo správy NASA/Space.com. Cieľ je zaujať moderného čitateľa kombináciou vedeckých faktov s mediálnym príbehom.

Vstupy:
- Pôvodný titulok (EN): {{src_title}}
- Krátky opis (EN): {{src_description}}
- Téma/kategória: {{category}}
- Doplňujúce body (EN): {{bullets}}

ŠTRUKTÚRA:

1. NADPIS (H1) – bulvárny, ale faktický
   - Cieľ: vyvolať zvedavosť a emóciu
   - Môže obsahovať otázku alebo prekvapivý prvok
   - Vyhýbaj sa prehnaným výmyslom – zostať dôveryhodný
   - Dĺžka: do 90 znakov
   - Príklady štýlu:
     * "NASA v šoku. Na Marse objavili útvar, ktorý vyzerá ako živý"
     * "Teleskop Webb zachytil planétu, ktorá nemala existovať"
     * "Slnko odpálilo najväčší výbuch v histórii"
     * "Našli planétu, kde prší sklo – a vedci tvrdia, že to dáva zmysel"

2. PEREX (2-3 vety)
   - Stručne vysvetli, čo sa reálne stalo
   - Slúži ako protiváha k bulvárnemu nadpisu
   - Začni opisom, prekvapením alebo otázkou

3. TELO ČLÁNKU (5-7 odsekov):
   
   Sekcia 1 – Čo NASA zistila (2-3 odseky)
   - Popíš hlavné fakty: čo, kde, kedy, ako
   - Jednoduchý jazyk, krátke vety
   - Uveď názvy misií, dátumy, hlavné ciele
   
   Sekcia 2 – Prečo je to dôležité (2 odseky)
   - Vysvetli význam objavu
   - Zjednoduš dopady na vedu/ľudstvo
   - Čo sa môžeme dozvedieť, čo to mení
   
   Sekcia 3 – Kontext/zaujímavosť (1-2 odseky)
   - Širší kontext: prepojenie s inými misiami (Webb, Artemis, ISS, SpaceX)
   - Pridaj zaujímavosť alebo metaforu
   - Pomôž čitateľovi predstaviť si situáciu

4. PODNADPISY (H2) – 3-4 kusy
   - Stručné, výstižné, bez otáznikov
   - Príklady: "Čo NASA zistila", "Prečo je to prelomové", "Čo nás čaká ďalej"

5. CTA ZÁVER (1-2 vety)
   - Zhrň hlavnú myšlienku
   - Ukonči otázkou alebo pozvánkou k diskusii
   - Príklady:
     * "Ak sa výsledky potvrdia, pôjde o jeden z najväčších objavov v histórii NASA. Myslíte si, že Mars kedysi hostil život?"
     * "Vedci tvrdia, že sme len na začiatku. Čo podľa vás objaví NASA nabudúce?"

ŠTÝL A TÓN:
- Jazyk: Slovenčina, moderný, pútavý
- Tón: Popularizačný, zrozumiteľný, svižný
- Nadpis: Bulvárny, emocionálny, ale pravdivý
- Tempo: Krátke vety, čisté odstavce, rytmus
- Emojis: NEPOUŽÍVAŤ
- Vkladaj kurzívu pre termíny typu "perihelion", "solar wind" s krátkym vysvetlením
- ZAKÁZANÉ: Nepoužívaj české slová (napr. "vesmír" namiesto "vesmir", "díky" namiesto "vďaka")
- ZAKÁZANÉ: Nepoužívaj slangové výrazy ani hovorové skratky
- Použi formálnu, ale prístupnú slovenčinu

DÔLEŽITÉ:
- Zachovaj faktickú presnosť
- Nevymýšľaj tvrdenia mimo vstupu
- Buď dramatický, ale nie nepravdivý
- Vytvor príbeh, nie suchú správu

Vráť JSON:
{
  "headline": "...",
  "perex": "...",
  "body": ["odsek1", "odsek2", "odsek3", "odsek4", "odsek5"],
  "subheads": ["Čo NASA zistila", "Prečo je to prelomové", "Čo nás čaká"],
  "cta": "..."
}
`;

/**
 * SEO metadata generation prompt
 */
const SEO_METADATA_PROMPT = `
Úloha: Z textu článku vráť SEO metadá a kľúčové slová pre slovenské publikum.

Vstup:
- Headline: {{headline}}
- Perex: {{perex}}
- Telo: {{body_text}}

Požiadavky:
- metaTitle ≤ 60 znakov, obsahuj kľúčovú frázu.
- metaDescription 140–160 znakov, zrozumiteľná, bez clickbait výkričníkov.
- keywords: 8–12 fráz (2–3 slová), malé písmená, bez diakritiky aj s diakritikou (mix), bez duplicit.
- slug: kebab-case zo skráteného titulku (SK s diakritikou odstránenou).

Vráť JSON:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": ["..."],
  "slug": "..."
}
`;

/**
 * Generate the complete bulvár article prompt with data
 * @param {Object} articleData - Space.com article data
 * @returns {string} Formatted prompt
 */
function generateBulvarArticlePrompt(articleData) {
    const {
        title = '',
        description = '',
        category = 'news',
        contentHtml = '',
        author = ''
    } = articleData;
    
    // Extract additional bullets from content if available
    const bullets = extractBulletPoints(contentHtml);
    
    return BULVAR_ARTICLE_PROMPT
        .replace('{{src_title}}', title)
        .replace('{{src_description}}', description)
        .replace('{{category}}', category)
        .replace('{{bullets}}', bullets.join('\n- '))
        .replace('{{author}}', author);
}

/**
 * Generate the SEO metadata prompt with data
 * @param {Object} generatedContent - Generated article content
 * @returns {string} Formatted prompt
 */
function generateSEOMetadataPrompt(generatedContent) {
    const {
        headline = '',
        perex = '',
        body = []
    } = generatedContent;
    
    const bodyText = Array.isArray(body) ? body.join(' ') : body;
    
    return SEO_METADATA_PROMPT
        .replace('{{headline}}', headline)
        .replace('{{perex}}', perex)
        .replace('{{body_text}}', bodyText);
}

/**
 * Extract bullet points from HTML content
 * @param {string} htmlContent - HTML content to parse
 * @returns {Array<string>} Array of bullet points
 */
function extractBulletPoints(htmlContent) {
    if (!htmlContent) return [];
    
    try {
        const bullets = [];
        
        // Look for list items
        const listItemMatches = htmlContent.match(/<li[^>]*>(.*?)<\/li>/gi);
        if (listItemMatches) {
            listItemMatches.forEach(match => {
                const text = match.replace(/<[^>]*>/g, '').trim();
                if (text && text.length > 10) {
                    bullets.push(text);
                }
            });
        }
        
        // Look for paragraphs that might be bullet points
        const paragraphMatches = htmlContent.match(/<p[^>]*>(.*?)<\/p>/gi);
        if (paragraphMatches) {
            paragraphMatches.forEach(match => {
                const text = match.replace(/<[^>]*>/g, '').trim();
                // Check if it looks like a bullet point
                if (text && (text.startsWith('•') || text.startsWith('-') || text.startsWith('*'))) {
                    bullets.push(text);
                }
            });
        }
        
        return bullets.slice(0, 5); // Limit to 5 bullets
    } catch (error) {
        console.error('Error extracting bullet points:', error.message);
        return [];
    }
}

/**
 * Validate generated bulvár content
 * @param {Object} content - Generated content to validate
 * @returns {Object} Validation result
 */
function validateBulvarContent(content) {
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!content.headline || content.headline.length < 10) {
        errors.push('Headline is missing or too short');
    }
    
    if (!content.perex || content.perex.length < 20) {
        errors.push('Perex is missing or too short');
    }
    
    if (!content.body || !Array.isArray(content.body) || content.body.length < 3) {
        errors.push('Body must have at least 3 paragraphs');
    }
    
    if (!content.cta || content.cta.length < 10) {
        errors.push('CTA is missing or too short');
    }
    
    // Check headline length
    if (content.headline && content.headline.length > 100) {
        warnings.push('Headline is quite long');
    }
    
    // Check perex length
    if (content.perex && content.perex.length > 300) {
        warnings.push('Perex is quite long');
    }
    
    // Check for Slovak diacritics
    const hasDiacritics = /[áäčďéíĺľňóôŕšťúýž]/i.test(content.headline + content.perex);
    if (!hasDiacritics) {
        warnings.push('Content might be missing Slovak diacritics');
    }
    
    // Check for clickbait indicators
    const clickbaitWords = ['šokujúce', 'neuveriteľné', 'prelomové', 'revolučné', 'senzácia'];
    const hasClickbait = clickbaitWords.some(word => 
        content.headline.toLowerCase().includes(word)
    );
    if (hasClickbait) {
        warnings.push('Content might be too clickbait-y');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
    };
}

/**
 * Validate SEO metadata
 * @param {Object} seoData - SEO metadata to validate
 * @returns {Object} Validation result
 */
function validateSEOMetadata(seoData) {
    const errors = [];
    const warnings = [];
    
    // Check meta title length
    if (!seoData.metaTitle || seoData.metaTitle.length > 60) {
        errors.push('Meta title must be ≤ 60 characters');
    }
    
    // Check meta description length
    if (!seoData.metaDescription || seoData.metaDescription.length < 140 || seoData.metaDescription.length > 160) {
        errors.push('Meta description must be 140-160 characters');
    }
    
    // Check keywords
    if (!seoData.keywords || !Array.isArray(seoData.keywords) || seoData.keywords.length < 5) {
        errors.push('Must have at least 5 keywords');
    }
    
    // Check slug format
    if (!seoData.slug || !/^[a-z0-9-]+$/.test(seoData.slug)) {
        errors.push('Slug must be kebab-case format');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}

/**
 * Get default CTA text
 * @returns {string} Default CTA
 */
function getDefaultCTA() {
    return "Sleduj naše vesmírne novinky každý deň. 🌌";
}

/**
 * Get default subheads if none provided
 * @param {string} topic - Article topic
 * @returns {Array<string>} Default subheads
 */
function getDefaultSubheads(topic) {
    const subheadMap = {
        'comet': ['Čo je to za kometu?', 'Prečo je to zaujímavé?', 'Kedy ju môžete vidieť?'],
        'spacex': ['Čo je nové?', 'Prečo je to dôležité?', 'Čo nás čaká?'],
        'telescope': ['Čo pozoruje?', 'Aké sú výsledky?', 'Čo to znamená?'],
        'planet': ['O akú planétu ide?', 'Čo sa zistilo?', 'Prečo je to dôležité?'],
        'default': ['Čo sa stalo?', 'Prečo je to zaujímavé?', 'Čo sledovať ďalej?']
    };
    
    const topicKey = Object.keys(subheadMap).find(key => 
        topic.toLowerCase().includes(key)
    ) || 'default';
    
    return subheadMap[topicKey];
}

module.exports = {
    generateBulvarArticlePrompt,
    generateSEOMetadataPrompt,
    extractBulletPoints,
    validateBulvarContent,
    validateSEOMetadata,
    getDefaultCTA,
    getDefaultSubheads,
    BULVAR_ARTICLE_PROMPT,
    SEO_METADATA_PROMPT
};
