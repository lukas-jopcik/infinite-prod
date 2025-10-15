const axios = require('axios');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Initialize S3 client
const s3 = new S3Client({ region: process.env.REGION || 'eu-central-1' });

// Configuration
const NASA_IMAGE_API_BASE = 'https://images-api.nasa.gov';
const S3_BUCKET = process.env.S3_IMAGES_BUCKET || 'infinite-images-dev-349660737637';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd2ydyf9w4v170.cloudfront.net';

// NASA centers and credits we accept (safe usage)
const ACCEPTED_NASA_CREDITS = [
    'NASA/GSFC',
    'NASA/JPL',
    'NASA/JPL-Caltech',
    'NASA/STScI',
    'NASA/ESA',
    'NASA/ESA/STScI',
    'NASA/ESA/Hubble',
    'NASA/ESA/Webb',
    'NASA/ESA/James Webb',
    'NASA/ESA/Hubble Space Telescope',
    'NASA/ESA/James Webb Space Telescope',
    'NASA/Goddard',
    'NASA/Ames',
    'NASA/JSC',
    'NASA/KSC',
    'NASA/MSFC',
    'NASA/LaRC',
    'NASA/GRC',
    'NASA/ARC',
    'NASA/DFRC',
    'NASA/WFF',
    'NASA/WSTF',
    'NASA/White Sands',
    'NASA/Johnson',
    'NASA/Kennedy',
    'NASA/Marshall',
    'NASA/Langley',
    'NASA/Glenn',
    'NASA/Armstrong',
    'NASA/Wallops',
    'NASA/White Sands Test Facility'
];

/**
 * Search NASA Image API for images related to a query
 * @param {string} query - Search query (e.g., "comet lemmon", "solar wind")
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of NASA image items
 */
async function searchNASAImages(query, limit = 20) {
    try {
        console.log(`Searching NASA Image API for: "${query}"`);
        
        const response = await axios.get(`${NASA_IMAGE_API_BASE}/search`, {
            params: {
                q: query,
                media_type: 'image',
                page_size: limit
            },
            timeout: 10000
        });

        if (!response.data || !response.data.collection || !response.data.collection.items) {
            console.log('No items found in NASA API response');
            return [];
        }

        const items = response.data.collection.items;
        console.log(`Found ${items.length} items from NASA API`);
        
        return items;
    } catch (error) {
        console.error('Error searching NASA Image API:', error.message);
        throw new Error(`NASA API search failed: ${error.message}`);
    }
}

/**
 * Filter NASA images to only include those with NASA credits
 * @param {Array} items - Array of NASA image items
 * @returns {Array} Filtered array with only NASA-credited images
 */
function filterNASACredits(items) {
    if (!items || !Array.isArray(items)) {
        return [];
    }

    const filtered = items.filter(item => {
        // Check if item has data array
        if (!item.data || !Array.isArray(item.data) || item.data.length === 0) {
            return false;
        }

        const metadata = item.data[0];
        const center = metadata.center || '';
        const photographer = metadata.photographer || '';
        const secondaryCreator = metadata.secondary_creator || '';
        
        // Combine all credit fields
        const allCredits = [center, photographer, secondaryCreator]
            .filter(Boolean)
            .join(' ')
            .toUpperCase();

        // Check if any accepted NASA credit is present
        const hasValidCredit = ACCEPTED_NASA_CREDITS.some(credit => 
            allCredits.includes(credit.toUpperCase())
        );

        if (hasValidCredit) {
            console.log(`✓ Accepted NASA image: ${metadata.title} (${center})`);
            return true;
        } else {
            console.log(`✗ Rejected non-NASA image: ${metadata.title} (${center})`);
            return false;
        }
    });

    console.log(`Filtered ${items.length} items to ${filtered.length} NASA-credited images`);
    return filtered;
}

/**
 * Get the best image URL from a NASA item (largest JPG/PNG)
 * @param {Object} item - NASA image item
 * @returns {Promise<string|null>} Best image URL or null
 */
async function getBestImageUrl(item) {
    try {
        if (!item.href) {
            console.log('No href found in NASA item');
            return null;
        }

        // Get asset files
        const response = await axios.get(item.href, { timeout: 10000 });
        const links = response.data;

        if (!Array.isArray(links)) {
            console.log('No links found in NASA asset response');
            return null;
        }

        // Filter for image files and sort by size (largest first)
        const imageLinks = links
            .filter(link => {
                const url = link.toLowerCase();
                return url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png');
            })
            .sort((a, b) => {
                // Try to extract size from URL for sorting
                const aSize = extractSizeFromUrl(a);
                const bSize = extractSizeFromUrl(b);
                return bSize - aSize;
            });

        if (imageLinks.length === 0) {
            console.log('No image files found in NASA asset');
            return null;
        }

        const bestUrl = imageLinks[0];
        console.log(`Selected best image URL: ${bestUrl}`);
        return bestUrl;
    } catch (error) {
        console.error('Error getting best image URL:', error.message);
        return null;
    }
}

/**
 * Extract size from NASA image URL (rough estimation)
 * @param {string} url - Image URL
 * @returns {number} Estimated size
 */
function extractSizeFromUrl(url) {
    // NASA URLs often contain size indicators
    if (url.includes('orig') || url.includes('original')) return 1000;
    if (url.includes('large')) return 800;
    if (url.includes('medium')) return 600;
    if (url.includes('small')) return 400;
    if (url.includes('thumb')) return 200;
    return 500; // default
}

/**
 * Download image from NASA and upload to S3
 * @param {string} imageUrl - NASA image URL
 * @param {string} nasaId - NASA item ID
 * @returns {Promise<Object>} S3 upload result with CloudFront URL
 */
async function downloadAndUploadToS3(imageUrl, nasaId) {
    try {
        const s3Key = `nasa-api/${nasaId}.jpg`;
        
        // Check if already exists in S3
        try {
            await s3.send(new HeadObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key
            }));
            console.log(`Image already exists in S3: ${s3Key}`);
        return {
            bucket: S3_BUCKET,
            key: s3Key,
            url: `https://${S3_BUCKET}.s3.eu-central-1.amazonaws.com/${s3Key}`,
            cached: true
        };
        } catch (error) {
            // File doesn't exist, proceed with download
        }

        console.log(`Downloading image from NASA: ${imageUrl}`);
        
        // Download image
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: 50 * 1024 * 1024 // 50MB limit
        });

        // Determine content type
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        // Upload to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: response.data,
            ContentType: contentType,
            Metadata: {
                'original-url': imageUrl,
                'nasa-id': nasaId,
                'cached-at': new Date().toISOString(),
                'source': 'nasa-api'
            }
        });

        await s3.send(uploadCommand);
        console.log(`Uploaded image to S3: ${s3Key}`);

        return {
            bucket: S3_BUCKET,
            key: s3Key,
            url: `https://${S3_BUCKET}.s3.eu-central-1.amazonaws.com/${s3Key}`,
            contentType: contentType,
            cached: false
        };
    } catch (error) {
        console.error('Error downloading/uploading image:', error.message);
        throw new Error(`Image processing failed: ${error.message}`);
    }
}

/**
 * Generate image metadata from NASA item
 * @param {Object} item - NASA image item
 * @returns {Object} Image metadata
 */
function generateImageMetadata(item) {
    if (!item.data || !Array.isArray(item.data) || item.data.length === 0) {
        return {
            title: 'NASA Image',
            credit: 'Image credit: NASA',
            alt: 'NASA space image'
        };
    }

    const metadata = item.data[0];
    const center = metadata.center || 'NASA';
    const photographer = metadata.photographer || '';
    const title = metadata.title || 'NASA Image';
    
    // Create credit string
    let credit = `Image credit: ${center}`;
    if (photographer && photographer !== center) {
        credit += `/${photographer}`;
    }

    // Create alt text
    const alt = title.length > 100 ? title.substring(0, 100) + '...' : title;

    return {
        title: title,
        credit: credit,
        alt: alt,
        description: metadata.description || '',
        dateCreated: metadata.date_created || '',
        keywords: metadata.keywords || []
    };
}

/**
 * Process NASA images for a given query
 * @param {string} query - Search query
 * @param {number} maxImages - Maximum number of images to process
 * @returns {Promise<Array>} Array of processed image objects
 */
async function processNASAImages(query, maxImages = 2) {
    try {
        console.log(`Processing NASA images for query: "${query}"`);
        
        // Search NASA API
        const items = await searchNASAImages(query, 20);
        
        // Filter for NASA credits only
        const nasaItems = filterNASACredits(items);
        
        if (nasaItems.length === 0) {
            console.log('No NASA-credited images found');
            return [];
        }

        const processedImages = [];
        
        // Process up to maxImages
        for (let i = 0; i < Math.min(nasaItems.length, maxImages); i++) {
            const item = nasaItems[i];
            const nasaId = item.data[0].nasa_id;
            
            try {
                // Get best image URL
                const imageUrl = await getBestImageUrl(item);
                if (!imageUrl) {
                    console.log(`No image URL found for NASA ID: ${nasaId}`);
                    continue;
                }

                // Download and upload to S3
                const s3Result = await downloadAndUploadToS3(imageUrl, nasaId);
                
                // Generate metadata
                const metadata = generateImageMetadata(item);
                
                processedImages.push({
                    nasaId: nasaId,
                    s3: s3Result,
                    metadata: metadata,
                    originalUrl: imageUrl
                });
                
                console.log(`✓ Processed NASA image: ${metadata.title}`);
            } catch (error) {
                console.error(`Error processing NASA image ${nasaId}:`, error.message);
                // Continue with next image
            }
        }

        console.log(`Successfully processed ${processedImages.length} NASA images`);
        return processedImages;
    } catch (error) {
        console.error('Error processing NASA images:', error.message);
        throw error;
    }
}

module.exports = {
    searchNASAImages,
    filterNASACredits,
    getBestImageUrl,
    downloadAndUploadToS3,
    generateImageMetadata,
    processNASAImages
};
