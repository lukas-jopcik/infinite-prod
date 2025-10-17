/**
 * NASA News Image Fallback Module
 * 
 * This module provides fallback image retrieval for NASA news articles
 * when RSS feed doesn't contain images. It searches NASA Image API
 * based on article title and description.
 */

const { processNASAImages } = require('./nasa-image-utils');
const axios = require('axios');

/**
 * Generate search queries for NASA Image API based on article content
 * @param {Object} articleData - Article data with title and description
 * @returns {Array} Array of search query strings
 */
function generateSearchQueries(articleData) {
    const queries = [];
    const title = articleData.title || '';
    const description = articleData.description || articleData.explanation || '';
    
    // Extract key terms from title
    const titleWords = title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !['nasa', 'news', 'release', 'announces', 'reports', 'discovers'].includes(word));
    
    // Extract key terms from description
    const descWords = description.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !['nasa', 'news', 'release', 'announces', 'reports', 'discovers', 'mission', 'spacecraft'].includes(word));
    
    // Query 1: Main topic from title (first 2-3 words)
    if (titleWords.length >= 2) {
        queries.push(titleWords.slice(0, 3).join(' '));
    }
    
    // Query 2: Full title without common words
    if (titleWords.length > 0) {
        queries.push(titleWords.join(' '));
    }
    
    // Query 3: Key terms from description
    if (descWords.length >= 2) {
        queries.push(descWords.slice(0, 3).join(' '));
    }
    
    // Query 4: Specific space-related terms
    const spaceTerms = ['mars', 'moon', 'earth', 'sun', 'galaxy', 'planet', 'asteroid', 'comet', 'telescope', 'satellite', 'rover', 'probe'];
    const foundSpaceTerms = [...titleWords, ...descWords].filter(word => spaceTerms.includes(word));
    if (foundSpaceTerms.length > 0) {
        queries.push(foundSpaceTerms.slice(0, 2).join(' '));
    }
    
    // Query 5: Mission names (if any)
    const missionPattern = /(james webb|hubble|perseverance|curiosity|voyager|cassini|juno|insight|artemis|apollo)/i;
    const missionMatch = (title + ' ' + description).match(missionPattern);
    if (missionMatch) {
        queries.push(missionMatch[1]);
    }
    
    // Remove duplicates and limit to 5 queries
    return [...new Set(queries)].slice(0, 5);
}

/**
 * Get NASA image for news article using fallback search
 * @param {Object} articleData - Article data
 * @returns {Promise<Object|null>} Image data or null if not found
 */
async function getNASAImageForNews(articleData) {
    try {
        console.log('🔍 Searching NASA Image API for news article:', articleData.title);
        
        // Generate search queries
        const queries = generateSearchQueries(articleData);
        console.log('Generated search queries:', queries);
        
        if (queries.length === 0) {
            console.log('No search queries generated');
            return null;
        }
        
        // Try each query until we find a suitable image
        for (const query of queries) {
            try {
                console.log(`Searching with query: "${query}"`);
                
                // Search for images using NASA Image API
                const images = await processNASAImages(query, 3);
                
                if (images.length > 0) {
                    // Select the best image (first one is usually most relevant)
                    const selectedImage = images[0];
                    
                    console.log(`✅ Found NASA image: ${selectedImage.metadata.title}`);
                    
                    return {
                        url: selectedImage.s3.url,
                        alt: selectedImage.metadata.alt,
                        credit: selectedImage.metadata.credit,
                        nasaId: selectedImage.nasaId,
                        title: selectedImage.metadata.title,
                        source: 'nasa-image-api-fallback',
                        searchQuery: query
                    };
                }
                
            } catch (queryError) {
                console.error(`Error searching with query "${query}":`, queryError.message);
                // Continue with next query
            }
        }
        
        console.log('❌ No suitable NASA images found for any query');
        return null;
        
    } catch (error) {
        console.error('Error in NASA image fallback:', error.message);
        return null;
    }
}

/**
 * Get multiple NASA images for news article (hero + inline)
 * @param {Object} articleData - Article data
 * @returns {Promise<Object>} Object with hero and inline images
 */
async function getMultipleNASAImagesForNews(articleData) {
    try {
        console.log('🔍 Searching NASA Image API for multiple images:', articleData.title);
        
        const queries = generateSearchQueries(articleData);
        console.log('Generated search queries:', queries);
        
        const result = {
            hero: null,
            inline: null,
            queries: queries
        };
        
        if (queries.length === 0) {
            return result;
        }
        
        // Try each query until we get enough images
        for (const query of queries) {
            try {
                console.log(`Searching with query: "${query}"`);
                const images = await processNASAImages(query, 3);
                
                if (images.length > 0 && !result.hero) {
                    result.hero = {
                        url: images[0].s3.url,
                        alt: images[0].metadata.alt,
                        credit: images[0].metadata.credit,
                        nasaId: images[0].nasaId,
                        title: images[0].metadata.title,
                        source: 'nasa-image-api-fallback',
                        searchQuery: query
                    };
                    console.log(`✅ Selected hero image: ${images[0].metadata.title}`);
                }
                
                if (images.length > 1 && !result.inline) {
                    result.inline = {
                        url: images[1].s3.url,
                        alt: images[1].metadata.alt,
                        credit: images[1].metadata.credit,
                        nasaId: images[1].nasaId,
                        title: images[1].metadata.title,
                        source: 'nasa-image-api-fallback',
                        searchQuery: query
                    };
                    console.log(`✅ Selected inline image: ${images[1].metadata.title}`);
                }
                
                // If we have both images, we're done
                if (result.hero && result.inline) {
                    break;
                }
                
            } catch (queryError) {
                console.error(`Error searching with query "${query}":`, queryError.message);
                // Continue with next query
            }
        }
        
        console.log(`NASA image fallback completed: ${result.hero ? 'hero' : 'no hero'}, ${result.inline ? 'inline' : 'no inline'}`);
        return result;
        
    } catch (error) {
        console.error('Error in multiple NASA image fallback:', error.message);
        return { hero: null, inline: null, queries: [] };
    }
}

/**
 * Check if an article needs image fallback
 * @param {Object} rawItem - Raw content item
 * @returns {boolean} True if fallback is needed
 */
function needsImageFallback(rawItem) {
    if (rawItem.source !== 'nasa-news') {
        return false;
    }
    
    const imageUrl = rawItem.imageUrl;
    if (!imageUrl || imageUrl === '' || imageUrl === 'None') {
        return true;
    }
    
    return false;
}

module.exports = {
    getNASAImageForNews,
    getMultipleNASAImagesForNews,
    generateSearchQueries,
    needsImageFallback
};
