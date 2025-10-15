const { processNASAImages } = require('./nasa-image-utils');

/**
 * NASA Image Service - Main service for fetching and caching NASA images
 * This service provides a clean interface for the Space.com content generator
 */

/**
 * Get NASA images for a Space.com article
 * @param {Object} articleData - Space.com article data
 * @returns {Promise<Object>} Object with hero and inline images
 */
async function getNASAImagesForArticle(articleData) {
    try {
        console.log('Getting NASA images for article:', articleData.title);
        
        // Generate search queries based on article content
        const queries = generateSearchQueries(articleData);
        console.log('Generated search queries:', queries);
        
        const result = {
            hero: null,
            inline: null,
            inline2: null,
            queries: queries
        };

        // Try each query until we get enough images
        for (const query of queries) {
            try {
                console.log(`Searching NASA API with query: "${query}"`);
                const images = await processNASAImages(query, 3);
                
                if (images.length > 0 && !result.hero) {
                    result.hero = {
                        src: images[0].s3.url,
                        alt: images[0].metadata.alt,
                        credit: images[0].metadata.credit,
                        nasaId: images[0].nasaId,
                        title: images[0].metadata.title
                    };
                    console.log(`✓ Selected hero image: ${images[0].metadata.title}`);
                }
                
                if (images.length > 1 && !result.inline) {
                    result.inline = {
                        src: images[1].s3.url,
                        alt: images[1].metadata.alt,
                        credit: images[1].metadata.credit,
                        nasaId: images[1].nasaId,
                        title: images[1].metadata.title
                    };
                    console.log(`✓ Selected inline image: ${images[1].metadata.title}`);
                }
                
                if (images.length > 2 && !result.inline2) {
                    result.inline2 = {
                        src: images[2].s3.url,
                        alt: images[2].metadata.alt,
                        credit: images[2].metadata.credit,
                        nasaId: images[2].nasaId,
                        title: images[2].metadata.title
                    };
                    console.log(`✓ Selected second inline image: ${images[2].metadata.title}`);
                }
                
                // If we have all three images, we're done
                if (result.hero && result.inline && result.inline2) {
                    break;
                }
            } catch (error) {
                console.error(`Error processing query "${query}":`, error.message);
                // Continue with next query
            }
        }

        // If we only got one image, use it as hero
        if (result.hero && !result.inline) {
            console.log('Only one image found, using as hero only');
        }

        console.log(`NASA image service result: hero=${!!result.hero}, inline=${!!result.inline}, inline2=${!!result.inline2}`);
        return result;
    } catch (error) {
        console.error('Error in NASA image service:', error.message);
        return {
            hero: null,
            inline: null,
            inline2: null,
            error: error.message
        };
    }
}

/**
 * Generate search queries based on article content
 * @param {Object} articleData - Space.com article data
 * @returns {Array<string>} Array of search queries
 */
function generateSearchQueries(articleData) {
    const queries = [];
    
    // Extract key terms from title and description
    const title = articleData.title || '';
    const description = articleData.description || '';
    const content = `${title} ${description}`.toLowerCase();
    
    // Common space terms mapping
    const termMappings = {
        // Comets
        'comet': ['comet', 'comet tail', 'solar wind comet'],
        'lemmon': ['comet lemmon', 'comet tail', 'solar wind'],
        
        // Stars and galaxies
        'star': ['star', 'stellar', 'galaxy'],
        'galaxy': ['galaxy', 'galactic', 'nebula'],
        'nebula': ['nebula', 'star formation', 'stellar nursery'],
        
        // Planets
        'mars': ['mars', 'red planet', 'martian'],
        'jupiter': ['jupiter', 'gas giant', 'jovian'],
        'saturn': ['saturn', 'rings', 'titan'],
        'moon': ['moon', 'lunar', 'satellite'],
        
        // Spacecraft and missions
        'spacex': ['spacex', 'starship', 'falcon', 'spacecraft'],
        'starship': ['starship', 'spacex', 'rocket'],
        'telescope': ['telescope', 'hubble', 'webb', 'james webb'],
        'hubble': ['hubble', 'space telescope', 'astronomy'],
        'webb': ['james webb', 'webb telescope', 'infrared'],
        
        // Space phenomena
        'solar wind': ['solar wind', 'sun', 'solar activity'],
        'aurora': ['aurora', 'northern lights', 'magnetic field'],
        'black hole': ['black hole', 'event horizon', 'gravity'],
        'supernova': ['supernova', 'star explosion', 'stellar death'],
        
        // General space terms
        'space': ['space', 'astronomy', 'cosmos'],
        'astronomy': ['astronomy', 'telescope', 'observation'],
        'cosmos': ['cosmos', 'universe', 'space']
    };
    
    // Find matching terms and generate queries
    for (const [term, queryTerms] of Object.entries(termMappings)) {
        if (content.includes(term)) {
            queries.push(...queryTerms);
        }
    }
    
    // Add specific queries based on content analysis
    if (content.includes('comet') && content.includes('tail')) {
        queries.push('comet tail solar wind');
    }
    
    if (content.includes('spacex') || content.includes('starship')) {
        queries.push('spacex launch rocket');
    }
    
    if (content.includes('telescope') || content.includes('hubble') || content.includes('webb')) {
        queries.push('space telescope astronomy');
    }
    
    // Remove duplicates and limit to 5 queries
    const uniqueQueries = [...new Set(queries)].slice(0, 5);
    
    // If no specific terms found, use general space queries
    if (uniqueQueries.length === 0) {
        uniqueQueries.push('space astronomy', 'universe cosmos', 'astronomy telescope');
    }
    
    return uniqueQueries;
}

/**
 * Get fallback NASA images when specific queries fail
 * @returns {Promise<Object>} Fallback images
 */
async function getFallbackNASAImages() {
    try {
        console.log('Getting fallback NASA images');
        
        const fallbackQueries = [
            'hubble space telescope',
            'james webb space telescope',
            'astronomy space',
            'universe cosmos',
            'space exploration'
        ];
        
        for (const query of fallbackQueries) {
            try {
                const images = await processNASAImages(query, 1);
                if (images.length > 0) {
                    return {
                        hero: {
                            src: images[0].s3.url,
                            alt: images[0].metadata.alt,
                            credit: images[0].metadata.credit,
                            nasaId: images[0].nasaId,
                            title: images[0].metadata.title
                        },
                        inline: null
                    };
                }
            } catch (error) {
                console.error(`Fallback query "${query}" failed:`, error.message);
            }
        }
        
        return { hero: null, inline: null };
    } catch (error) {
        console.error('Error getting fallback NASA images:', error.message);
        return { hero: null, inline: null };
    }
}

/**
 * Validate NASA image data
 * @param {Object} imageData - Image data to validate
 * @returns {boolean} True if valid
 */
function validateNASAImageData(imageData) {
    if (!imageData) return false;
    
    const required = ['src', 'alt', 'credit'];
    return required.every(field => imageData[field] && typeof imageData[field] === 'string');
}

module.exports = {
    getNASAImagesForArticle,
    generateSearchQueries,
    getFallbackNASAImages,
    validateNASAImageData
};
