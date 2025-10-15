/**
 * Slovak Bulvár AI Prompts for Space.com Content Generation
 * These prompts create engaging, pop-sci style articles in Slovak language
 */

/**
 * Main bulvár article generation prompt
 */
const BULVAR_ARTICLE_PROMPT = `
Úloha: Na základe nasledujúcich vstupov vytvor moderný, zvedavosť-budivý článok v slovenčine (štýl: "pop-sci bulvár", nie lacný clickbait). Použi fakty len z poskytnutého vstupu.

Vstupy:
- Pôvodný titulok (EN): {{src_title}}
- Krátky opis (EN): {{src_description}}
- Téma/kategória: {{category}}
- Doplňujúce body (EN, voliteľné): {{bullets}}
- Kontext: "Článok je denné vesmírne novinky, pre mladé publikum, IG/TikTok friendly."

Požiadavky na výstup:
1) Titulok (H1): 7–12 slov, výrazný, bez emodži, slovenský pravopis.
2) Perex (2 vety): strhujúce, ale faktické; žiadne prehnané sľuby.
3) Telo článku: 5–7 odsekov, každý 2–4 vety. Logická gradácia: (a) „čo sa stalo", (b) prečo je to zaujímavé, (c) stručný background, (d) čo sledovať ďalej. Vyhni sa technickému balastu.
4) Medzititulky (H2): 2–3 kusy, stručné, bez otáznikov.
5) CTA záver: 1 veta, neutrálna výzva k sledovaniu noviniek.
6) Zachovaj neutrálne tvrdenia, nepoužívaj senzácie bez podkladu (napr. mimozemšťania ap.).
7) Jazyk: moderný, prirodzený, bez archaizmov. Vety skôr kratšie.
8) Vkladaj (kurzíva) pre termíny typu „perihelion", „solar wind" pri prvom výskyte s krátkym vysvetlením v zátvorke.
9) Nevymýšľaj nové tvrdé fakty mimo vstupu.

Vráť JSON:
{
  "headline": "...",
  "perex": "...",
  "body": ["odsek1", "odsek2", "..."],
  "subheads": ["...", "..."],
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
