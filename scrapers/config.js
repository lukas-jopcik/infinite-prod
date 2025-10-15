module.exports = {
    // Scraping configuration
    RATE_LIMIT_MS: 500, // 500ms between requests
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 2000, // Initial retry delay (exponential backoff)
    
    // Date range for scraping
    START_YEAR: 2024,
    START_MONTH: 1,
    START_DAY: 1,
    END_YEAR: 2025,
    END_MONTH: 10,
    END_DAY: 12, // Current date
    
    // URLs
    ARCHIVE_URL: 'https://apod.nasa.gov/apod/archivepixFull.html',
    APOD_BASE_URL: 'https://apod.nasa.gov/apod/',
    
    // Output files
    OUTPUT_FILE: 'apod-archive-data.json',
    PROGRESS_FILE: 'progress.json',
    LOG_FILE: 'scraper.log',
    
    // Progress save interval
    PROGRESS_SAVE_INTERVAL: 10, // Save progress every 10 articles
    
    // Data format
    DEFAULT_CATEGORY: 'objav-dna',
    DEFAULT_STATUS: 'raw',
    DEFAULT_ENVIRONMENT: 'dev',
    SOURCE: 'apod'
};

