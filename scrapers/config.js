/**
 * Configuration for APOD Archive Scraper
 */

module.exports = {
    // Scraping configuration
    batchSize: 50,                    // Number of entries to process in parallel
    delayMs: 2000,                    // Delay between batches (rate limiting)
    
    // Year range filter
    startYear: 2020,                  // Start year for scraping
    endYear: 2025,                    // End year for scraping
    
    // URLs
    archiveUrl: 'https://apod.nasa.gov/apod/archivepixFull.html',
    
    // Output configuration
    outputDir: __dirname,             // Directory for output files
    outputPrefix: 'apod-archive',     // Prefix for output files
    
    // Data structure configuration
    environment: 'dev',               // Environment for DynamoDB
    source: 'apod',                   // Source identifier
    
    // Retry configuration
    maxRetries: 3,                    // Maximum retry attempts for failed requests
    retryDelayMs: 5000,               // Delay between retries
    
    // Progress reporting
    progressInterval: 100,            // Report progress every N entries
};
