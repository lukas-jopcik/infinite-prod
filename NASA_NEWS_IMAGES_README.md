# NASA News Images System

This system ensures that all NASA news articles have proper images by improving RSS extraction, adding fallback mechanisms, and providing tools to fix existing articles.

## Problem Solved

The original system had issues where NASA news articles from RSS feeds would be processed without images, resulting in articles in the `vesmirne-novinky` section that had no hero images.

## Solution Components

### 1. Enhanced RSS Image Extraction (`nasa-news-fetcher.js`)

**Improvements made:**
- Added support for `media:content` RSS field
- Added support for `enclosure` tags
- Enhanced HTML parsing with multiple patterns
- Added OpenGraph and Twitter card meta tag support
- Added NASA.gov domain image link extraction
- Improved credit extraction patterns
- **CRITICAL: Added image validation filter** - items without images are now filtered out during RSS fetch

**Key changes:**
```javascript
// Before: Only looked for <img> tags
const imgMatch = htmlContent.match(/<img[^>]+src="([^"]+)"[^>]*>/i);

// After: Multiple extraction methods with priority
// 1. RSS media:content field
// 2. RSS enclosure field  
// 3. HTML img tags (multiple patterns)
// 4. OpenGraph meta tags
// 5. Twitter card meta tags
// 6. NASA.gov domain links

// NEW: Image validation filter in shouldProcessItem()
const hasImage = checkIfItemHasImage(item);
if (!hasImage) {
    console.log(`Skipping item without image: ${item.title}`);
    return false;
}
```

### 2. NASA Image API Fallback (`nasa-news-image-fallback.js`)

**Features:**
- Intelligent query generation from article titles and descriptions
- NASA Image API integration using existing `nasa-image-utils.js`
- Automatic image download and S3 upload
- Credit extraction and metadata handling

**Query generation logic:**
- Extracts key terms from title and description
- Filters out common words (nasa, news, release, etc.)
- Identifies space-related terms (mars, moon, galaxy, etc.)
- Detects mission names (james webb, hubble, perseverance, etc.)

### 3. AI Content Generator Integration (`ai-content-generator.js`)

**Integration:**
- Added fallback check in `processImages()` function
- Automatically triggers NASA Image API search when no image found
- Seamlessly integrates with existing image processing pipeline

**Flow:**
```javascript
if (!imageUrl && needsImageFallback(rawItem)) {
    const fallbackImage = await getNASAImageForNews(rawItem);
    if (fallbackImage) {
        imageUrl = fallbackImage.url;
    }
}
```

### 4. Diagnostic and Fix Tools

#### Check Script (`check-nasa-news-images.js`)
- Scans both `InfiniteRawContent-dev` and `InfiniteArticles-dev` tables
- Identifies articles without images
- Generates detailed JSON report
- Provides statistics and recommendations

**Usage:**
```bash
node scripts/check-nasa-news-images.js
```

#### Fix Script (`fix-nasa-news-images.js`)
- Loads report from check script
- Attempts to find images for articles without them
- Updates raw content with new image URLs
- Re-processes articles through AI content generator
- Supports dry-run mode and specific content ID targeting

**Usage:**
```bash
# Dry run to see what would be fixed
node scripts/fix-nasa-news-images.js --dry-run

# Fix all articles without images
node scripts/fix-nasa-news-images.js

# Fix specific article
node scripts/fix-nasa-news-images.js --content-id=nasa-news-12345
```

#### Test Script (`test-nasa-news-system.js`)
- Tests all components of the system
- Validates module loading and integration
- Provides comprehensive system health check

**Usage:**
```bash
node scripts/test-nasa-news-system.js
```

## File Structure

```
scripts/
├── check-nasa-news-images.js      # Diagnostic tool
├── fix-nasa-news-images.js        # Fix tool
└── test-nasa-news-system.js       # Test suite

backend/functions/scheduled/
├── nasa-news-fetcher.js           # Enhanced RSS extraction
├── nasa-news-image-fallback.js    # NASA Image API fallback
└── ai-content-generator.js        # Integrated fallback
```

## Workflow

### For New Articles
1. NASA RSS fetcher runs with enhanced extraction
2. **NEW: Items without images are filtered out during RSS fetch**
3. If image found in RSS, article is processed normally
4. If no image found in RSS (shouldn't happen now), fallback mechanism searches NASA Image API
5. Article is processed with image (either from RSS or fallback)

### For Existing Articles
1. Run check script to identify articles without images
2. Run fix script to attempt to find and add images
3. Verify results with check script

## Configuration

### Environment Variables
- `AWS_REGION`: AWS region (default: eu-central-1)
- `ENVIRONMENT`: Environment (default: dev)
- `DYNAMODB_RAW_CONTENT_TABLE`: Raw content table name
- `DYNAMODB_ARTICLES_TABLE`: Articles table name

### Dependencies
- AWS SDK v3
- NASA Image API access (via existing `nasa-image-utils.js`)
- OpenAI API (for content generation)

## Expected Results

### Before Fix
- Some NASA news articles had no images
- Articles appeared in `vesmirne-novinky` section without hero images
- Poor user experience and SEO impact

### After Fix
- **All new NASA news articles will have images (filtered at RSS level)**
- Existing articles without images can be fixed
- System is resilient to missing images in RSS feeds
- **No more articles without images will be fetched from RSS**
- Better user experience and SEO

## Monitoring

### Reports Generated
- `nasa-news-images-report.json`: Current state analysis
- `nasa-news-images-fix-results.json`: Fix operation results

### Key Metrics
- Percentage of articles with images
- Number of fallback images used
- Success rate of fix operations

## Troubleshooting

### Common Issues

1. **No images found in fallback**
   - Check NASA Image API connectivity
   - Verify search queries are generating properly
   - Check if article content is sufficient for query generation

2. **Fix script fails**
   - Ensure AWS credentials are configured
   - Check DynamoDB table permissions
   - Verify Lambda function exists and is accessible

3. **RSS extraction not working**
   - Check if NASA RSS feed structure has changed
   - Verify regex patterns are still valid
   - Test with sample RSS data

### Debug Mode
All scripts support verbose logging. Check console output for detailed information about what's happening during processing.

## Future Enhancements

1. **Caching**: Cache NASA Image API results to avoid repeated searches
2. **Image Quality**: Implement image quality scoring to select best images
3. **Batch Processing**: Process multiple articles in parallel for better performance
4. **Monitoring**: Add CloudWatch metrics for system health monitoring
5. **Fallback Sources**: Add additional image sources beyond NASA Image API

## Support

For issues or questions about this system:
1. Check the generated reports for detailed error information
2. Run the test script to validate system health
3. Review console logs for specific error messages
4. Ensure all dependencies and AWS permissions are properly configured
