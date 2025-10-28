const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const REGION = process.env.REGION || 'eu-central-1';
const S3_IMAGES_BUCKET = process.env.S3_IMAGES_BUCKET || 'infinite-images-dev-349660737637';
const FLICKR_API_KEY_ARN = process.env.FLICKR_API_KEY_ARN;
const NASA_WEBB_FLICKR_USER = process.env.NASA_WEBB_FLICKR_USER || 'nasawebbtelescope';

// Initialize AWS clients
const s3Client = new S3Client({ region: REGION });
const secretsManager = new SecretsManagerClient({ region: REGION });

/**
 * Get Flickr API key from AWS Secrets Manager
 */
async function getFlickrApiKey() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: FLICKR_API_KEY_ARN
        });
        const result = await secretsManager.send(command);
        return JSON.parse(result.SecretString).api_key;
    } catch (error) {
        console.error('Error getting Flickr API key:', error);
        throw new Error('Failed to get Flickr API key');
    }
}

/**
 * Fetch recent images from NASA Webb Telescope Flickr account
 */
async function fetchWebbTelescopeImages(limit = 10) {
    try {
        const apiKey = await getFlickrApiKey();
        const url = `https://api.flickr.com/services/rest/?method=flickr.people.getPhotos&api_key=${apiKey}&user_id=${NASA_WEBB_FLICKR_USER}&per_page=${limit}&format=json&nojsoncallback=1&extras=url_l,url_o,description,title,owner_name,license`;
        
        console.log('Fetching Webb Telescope images from Flickr...');
        const response = await axios.get(url);
        
        if (response.data.stat !== 'ok') {
            throw new Error(`Flickr API error: ${response.data.message}`);
        }
        
        const photos = response.data.photos.photo;
        console.log(`Found ${photos.length} Webb Telescope images`);
        
        const images = [];
        for (const photo of photos) {
            try {
                // Skip if no large image available
                if (!photo.url_l && !photo.url_o) {
                    console.log(`Skipping photo ${photo.id} - no large image available`);
                    continue;
                }
                
                const imageUrl = photo.url_o || photo.url_l;
                const imageData = {
                    id: photo.id,
                    title: photo.title,
                    description: photo.description._content || '',
                    imageUrl: imageUrl,
                    owner: photo.ownername,
                    license: photo.license,
                    flickrUrl: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`,
                    source: 'nasa-webb-flickr'
                };
                
                images.push(imageData);
            } catch (error) {
                console.error(`Error processing photo ${photo.id}:`, error);
                continue;
            }
        }
        
        return images;
    } catch (error) {
        console.error('Error fetching Webb Telescope images:', error);
        throw error;
    }
}

/**
 * Fetch recent images from NASA Earth Observatory
 */
async function fetchEarthObservatoryImages(limit = 10) {
    try {
        console.log('Fetching Earth Observatory images...');
        
        // Fetch the main page to get recent images
        const response = await axios.get('https://earthobservatory.nasa.gov/', {
            timeout: 10000
        });
        
        // Parse HTML to extract image information
        const html = response.data;
        const images = [];
        
        // Look for image patterns in the HTML
        const imageRegex = /<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi;
        let match;
        let count = 0;
        
        while ((match = imageRegex.exec(html)) !== null && count < limit) {
            const imageUrl = match[1];
            const altText = match[2];
            
            // Skip small images, icons, and non-NASA images
            if (imageUrl.includes('nasa.gov') && 
                !imageUrl.includes('icon') && 
                !imageUrl.includes('logo') &&
                (imageUrl.includes('_large') || imageUrl.includes('_medium'))) {
                
                const imageData = {
                    id: `eo_${crypto.randomUUID()}`,
                    title: altText || 'Earth Observatory Image',
                    description: altText || 'Image from NASA Earth Observatory',
                    imageUrl: imageUrl.startsWith('http') ? imageUrl : `https://earthobservatory.nasa.gov${imageUrl}`,
                    owner: 'NASA Earth Observatory',
                    license: 'public-domain',
                    source: 'nasa-earth-observatory'
                };
                
                images.push(imageData);
                count++;
            }
        }
        
        console.log(`Found ${images.length} Earth Observatory images`);
        return images;
    } catch (error) {
        console.error('Error fetching Earth Observatory images:', error);
        // Return empty array instead of throwing to allow fallback
        return [];
    }
}

/**
 * Download image and upload to S3 with proper metadata
 */
async function downloadAndUploadToS3(imageData) {
    try {
        console.log(`Downloading image: ${imageData.title}`);
        
        // Download image
        const imageResponse = await axios.get(imageData.imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Infinite-Space-Bot/1.0)'
            }
        });
        
        // Generate S3 key
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${imageData.id}_${timestamp}.jpg`;
        const s3Key = `ai-generated/${filename}`;
        
        // Upload to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: S3_IMAGES_BUCKET,
            Key: s3Key,
            Body: imageResponse.data,
            ContentType: 'image/jpeg',
            Metadata: {
                'original-title': imageData.title,
                'original-description': imageData.description,
                'source': imageData.source,
                'owner': imageData.owner,
                'license': imageData.license,
                'original-url': imageData.imageUrl,
                'flickr-url': imageData.flickrUrl || '',
                'upload-date': new Date().toISOString()
            }
        });
        
        await s3Client.send(uploadCommand);
        
        // Generate CloudFront URL
        const cloudfrontUrl = `https://d2ydyf9w4v170.cloudfront.net/${s3Key}`;
        
        console.log(`Uploaded image to S3: ${s3Key}`);
        
        return {
            ...imageData,
            s3Key: s3Key,
            s3Url: cloudfrontUrl,
            bucket: S3_IMAGES_BUCKET,
            uploadedAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`Error downloading/uploading image ${imageData.id}:`, error);
        throw error;
    }
}

/**
 * Extract and normalize image metadata
 */
function extractImageMetadata(imageData) {
    return {
        id: imageData.id,
        title: imageData.title,
        description: imageData.description,
        imageUrl: imageData.s3Url,
        imageBucket: imageData.bucket,
        imageKey: imageData.s3Key,
        imageCredit: imageData.owner,
        imageLicense: imageData.license,
        imageNasaId: imageData.id,
        originalUrl: imageData.imageUrl,
        flickrUrl: imageData.flickrUrl || '',
        source: imageData.source,
        uploadedAt: imageData.uploadedAt
    };
}

/**
 * Main function to fetch images from all NASA sources
 */
async function fetchNASASpaceImages(totalLimit = 10) {
    try {
        console.log(`Fetching ${totalLimit} NASA space images...`);
        
        const images = [];
        
        // Try Webb Telescope Flickr first (higher quality)
        try {
            const webbImages = await fetchWebbTelescopeImages(Math.ceil(totalLimit * 0.7));
            images.push(...webbImages);
        } catch (error) {
            console.warn('Failed to fetch Webb Telescope images:', error.message);
        }
        
        // Fill remaining with Earth Observatory images
        const remaining = totalLimit - images.length;
        if (remaining > 0) {
            try {
                const eoImages = await fetchEarthObservatoryImages(remaining);
                images.push(...eoImages);
            } catch (error) {
                console.warn('Failed to fetch Earth Observatory images:', error.message);
            }
        }
        
        console.log(`Total images found: ${images.length}`);
        
        // Download and upload images to S3
        const processedImages = [];
        for (const imageData of images) {
            try {
                const uploadedImage = await downloadAndUploadToS3(imageData);
                const metadata = extractImageMetadata(uploadedImage);
                processedImages.push(metadata);
            } catch (error) {
                console.error(`Failed to process image ${imageData.id}:`, error);
                continue;
            }
        }
        
        console.log(`Successfully processed ${processedImages.length} images`);
        return processedImages;
        
    } catch (error) {
        console.error('Error fetching NASA space images:', error);
        throw error;
    }
}

module.exports = {
    fetchWebbTelescopeImages,
    fetchEarthObservatoryImages,
    downloadAndUploadToS3,
    extractImageMetadata,
    fetchNASASpaceImages
};
