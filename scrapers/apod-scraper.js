const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

// Utility to log to both console and file
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(config.LOG_FILE, logMessage + '\n');
}

// Utility to delay execution
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse the archive page to extract all article links for the date range
async function parseArchivePage() {
    log('📥 Fetching APOD archive page...');
    
    try {
        const response = await axios.get(config.ARCHIVE_URL, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        const html = response.data;
        const entries = [];
        
        // Match pattern: 2025 October 01:  <a href="ap251001.html">Title</a><br>
        // Format: YYYY Month DD:  <a href="...">Title</a>
        const entryRegex = /(\d{4})\s+(\w+)\s+(\d{1,2}):\s*<a\s+href="([^"]+)">([^<]+)<\/a>/gi;
        
        let match;
        
        while ((match = entryRegex.exec(html)) !== null) {
            const year = parseInt(match[1]);
            const month = monthNameToNumber(match[2]);
            const day = parseInt(match[3]);
            const link = match[4];
            const title = match[5].trim();
            
            if (isInDateRange(year, month, day)) {
                entries.push({ year, month, day, title, link });
            }
        }
        
        log(`✅ Found ${entries.length} articles in date range`);
        return entries;
        
    } catch (error) {
        log(`❌ Error fetching archive page: ${error.message}`);
        throw error;
    }
}

// Convert month name to number (1-12)
function monthNameToNumber(monthName) {
    const months = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    };
    return months[monthName] || 1;
}

// Check if date is in configured range
function isInDateRange(year, month, day) {
    const date = new Date(year, month - 1, day);
    const startDate = new Date(config.START_YEAR, config.START_MONTH - 1, config.START_DAY);
    const endDate = new Date(config.END_YEAR, config.END_MONTH - 1, config.END_DAY);
    
    return date >= startDate && date <= endDate;
}

// Build APOD page URL from date
function buildAPODUrl(year, month, day) {
    const yearStr = year.toString().slice(-2); // Last 2 digits
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    return `${config.APOD_BASE_URL}ap${yearStr}${monthStr}${dayStr}.html`;
}

// Scrape a single APOD page
async function scrapeAPODPage(entry, retryCount = 0) {
    const { year, month, day, title: archiveTitle } = entry;
    const url = buildAPODUrl(year, month, day);
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    try {
        log(`📄 Scraping: ${dateStr} - ${archiveTitle}`);
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        const html = response.data;
        
        // Extract data
        const title = extractTitle(html, archiveTitle);
        const explanation = extractExplanation(html);
        const imageUrl = extractImageUrl(html);
        const hdUrl = extractHDUrl(html);
        const copyright = extractCopyright(html);
        const mediaType = extractMediaType(html);
        
        // Validate required fields
        if (!title || !explanation || !imageUrl) {
            log(`⚠️  Missing required fields for ${dateStr}`);
            log(`   Title: ${title ? 'OK' : 'MISSING'}`);
            log(`   Explanation: ${explanation ? explanation.substring(0, 50) + '...' : 'MISSING'}`);
            log(`   Image URL: ${imageUrl ? 'OK' : 'MISSING'}`);
            
            // Return partial data with what we have
        }
        
        // Create content ID
        const contentId = `apod-${dateStr}-${uuidv4()}`;
        
        // Build full data object
        const data = {
            contentId,
            source: config.SOURCE,
            title: title || archiveTitle,
            explanation: explanation || '',
            date: dateStr,
            url: imageUrl || '',
            status: config.DEFAULT_STATUS,
            fetchedAt: new Date().toISOString(),
            environment: config.DEFAULT_ENVIRONMENT,
            category: config.DEFAULT_CATEGORY
        };
        
        // Add optional fields
        if (hdUrl) data.hdurl = hdUrl;
        if (copyright) data.copyright = copyright;
        if (mediaType) data.mediaType = mediaType;
        
        return data;
        
    } catch (error) {
        if (retryCount < config.RETRY_ATTEMPTS) {
            const retryDelay = config.RETRY_DELAY_MS * Math.pow(2, retryCount);
            log(`⚠️  Error scraping ${dateStr}, retry ${retryCount + 1}/${config.RETRY_ATTEMPTS} in ${retryDelay}ms`);
            await delay(retryDelay);
            return scrapeAPODPage(entry, retryCount + 1);
        } else {
            log(`❌ Failed to scrape ${dateStr} after ${config.RETRY_ATTEMPTS} attempts: ${error.message}`);
            return null;
        }
    }
}

// Extract title from HTML
function extractTitle(html, fallbackTitle) {
    // Try <title> tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
        let title = titleMatch[1]
            .replace(/APOD:\s*/i, '')
            .replace(/\s*\(\d{4}\s+\w+\s+\d+\)/, '')
            .trim();
        
        // Remove date prefix by splitting on dash and taking the part after
        // Format: "2025 October 1 – Title" or "2025 October 1 - Title"
        const dashSplit = title.split(/\s+[–\-—]\s+/);
        if (dashSplit.length > 1) {
            title = dashSplit.slice(1).join(' – ').trim();
        }
        
        if (title) return title;
    }
    
    // Try <b> tag near the center
    const centerMatch = html.match(/<center>[\s\S]*?<b>([^<]+)<\/b>/i);
    if (centerMatch) {
        let title = centerMatch[1].trim();
        // Remove date prefix by splitting on dash
        const dashSplit = title.split(/\s+[–\-—]\s+/);
        if (dashSplit.length > 1) {
            title = dashSplit.slice(1).join(' – ').trim();
        }
        return title;
    }
    
    return fallbackTitle;
}

// Extract explanation from HTML
function extractExplanation(html) {
    // Look for "Explanation:" section
    const explanationMatch = html.match(/Explanation:\s*<\/b>\s*([\s\S]*?)(?:<p>|<center>|<br><br>|$)/i);
    
    if (explanationMatch) {
        let explanation = explanationMatch[1]
            .replace(/<[^>]+>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        return explanation;
    }
    
    return null;
}

// Extract main image URL from HTML
function extractImageUrl(html) {
    // Pattern 1: <a href="image.jpg"><img ...></a>
    const imgLinkMatch = html.match(/<a\s+href="([^"]+\.(jpg|jpeg|png|gif|webp))"/i);
    if (imgLinkMatch) {
        let url = imgLinkMatch[1];
        if (!url.startsWith('http')) {
            url = config.APOD_BASE_URL + url.replace(/^\.\.\//, '');
        }
        return url;
    }
    
    // Pattern 2: <img src="image.jpg">
    const imgSrcMatch = html.match(/<img[^>]+src="([^"]+\.(jpg|jpeg|png|gif|webp))"/i);
    if (imgSrcMatch) {
        let url = imgSrcMatch[1];
        if (!url.startsWith('http')) {
            url = config.APOD_BASE_URL + url.replace(/^\.\.\//, '');
        }
        return url;
    }
    
    return null;
}

// Extract HD image URL from HTML
function extractHDUrl(html) {
    // Look for links with "higher resolution" or similar text
    const hdMatch = html.match(/<a\s+href="([^"]+\.(jpg|jpeg|png|gif|webp))"[^>]*>.*?(higher|resolution|hd|large)/i);
    if (hdMatch) {
        let url = hdMatch[1];
        if (!url.startsWith('http')) {
            url = config.APOD_BASE_URL + url.replace(/^\.\.\//, '');
        }
        return url;
    }
    
    return null;
}

// Extract copyright/credit from HTML
function extractCopyright(html) {
    // Pattern 1: Image Credit & Copyright: </b> ... until </center>
    // This captures multiple names, & symbols, and <a> tags
    // Also handles cases where Copyright is a link: Image Credit & <a>Copyright</a>:
    let match = html.match(/Image\s+Credit\s*&[\s\S]*?Copyright[\s\S]*?:\s*<\/b>\s*([\s\S]*?)<\/center>/i);
    if (match) {
        // Clean up the extracted text: remove tags, decode HTML entities, normalize whitespace
        let credit = match[1]
            .replace(/<a[^>]*>/gi, '') // Remove opening <a> tags
            .replace(/<\/a>/gi, '') // Remove closing </a> tags
            .replace(/<i>/gi, '') // Remove <i> tags
            .replace(/<\/i>/gi, '') // Remove </i> tags
            .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
            .replace(/&nbsp;/g, ' ') // Decode &nbsp;
            .replace(/&amp;/g, '&') // Decode &amp;
            .replace(/&lt;/g, '<') // Decode &lt;
            .replace(/&gt;/g, '>') // Decode &gt;
            .replace(/&quot;/g, '"') // Decode &quot;
            .replace(/&#39;/g, "'") // Decode &#39;
            .replace(/&aacute;/g, 'á') // Decode á
            .replace(/&eacute;/g, 'é') // Decode é
            .replace(/&iacute;/g, 'í') // Decode í
            .replace(/&oacute;/g, 'ó') // Decode ó
            .replace(/&uacute;/g, 'ú') // Decode ú
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        if (credit && credit.length > 0) return credit;
    }
    
    // Pattern 2: Image Credit: </b> ... until </center>
    match = html.match(/Image\s+Credit:\s*<\/b>\s*([\s\S]*?)<\/center>/i);
    if (match) {
        let credit = match[1]
            .replace(/<a[^>]*>/gi, '')
            .replace(/<\/a>/gi, '')
            .replace(/<i>/gi, '')
            .replace(/<\/i>/gi, '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&aacute;/g, 'á')
            .replace(/&eacute;/g, 'é')
            .replace(/&iacute;/g, 'í')
            .replace(/&oacute;/g, 'ó')
            .replace(/&uacute;/g, 'ú')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (credit && credit.length > 0) return credit;
    }
    
    // Pattern 3: Copyright: </b> ... until </center>
    match = html.match(/Copyright:\s*<\/b>\s*([\s\S]*?)<\/center>/i);
    if (match) {
        let credit = match[1]
            .replace(/<a[^>]*>/gi, '')
            .replace(/<\/a>/gi, '')
            .replace(/<i>/gi, '')
            .replace(/<\/i>/gi, '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&aacute;/g, 'á')
            .replace(/&eacute;/g, 'é')
            .replace(/&iacute;/g, 'í')
            .replace(/&oacute;/g, 'ó')
            .replace(/&uacute;/g, 'ú')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (credit && credit.length > 0) return credit;
    }
    
    return null;
}

// Extract media type (image or video)
function extractMediaType(html) {
    // Check for video embeds
    if (html.match(/<iframe|<embed|youtube\.com|vimeo\.com/i)) {
        return 'video';
    }
    return 'image';
}

// Save progress to file
function saveProgress(scrapedData, currentIndex) {
    const progress = {
        lastProcessedIndex: currentIndex,
        totalProcessed: scrapedData.length,
        lastSavedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(config.PROGRESS_FILE, JSON.stringify(progress, null, 2));
    fs.writeFileSync(config.OUTPUT_FILE, JSON.stringify(scrapedData, null, 2));
}

// Load progress from file
function loadProgress() {
    try {
        if (fs.existsSync(config.PROGRESS_FILE) && fs.existsSync(config.OUTPUT_FILE)) {
            const progress = JSON.parse(fs.readFileSync(config.PROGRESS_FILE, 'utf8'));
            const data = JSON.parse(fs.readFileSync(config.OUTPUT_FILE, 'utf8'));
            
            log(`📂 Resuming from progress: ${progress.totalProcessed} articles already scraped`);
            return { progress, data };
        }
    } catch (error) {
        log(`⚠️  Could not load progress: ${error.message}`);
    }
    
    return { progress: { lastProcessedIndex: -1 }, data: [] };
}

// Main scraping function
async function main() {
    const isTestMode = process.argv.includes('--test');
    
    log('🚀 APOD Archive Scraper Started');
    log(`📅 Date range: ${config.START_YEAR}-${config.START_MONTH}-${config.START_DAY} to ${config.END_YEAR}-${config.END_MONTH}-${config.END_DAY}`);
    log(`⏱️  Rate limit: ${config.RATE_LIMIT_MS}ms between requests`);
    
    if (isTestMode) {
        log('🧪 TEST MODE: Will scrape only 10 articles');
    }
    
    try {
        // Parse archive page to get all entries
        const entries = await parseArchivePage();
        
        if (entries.length === 0) {
            log('❌ No entries found in date range');
            return;
        }
        
        // Load existing progress
        const { progress, data: scrapedData } = loadProgress();
        const startIndex = progress.lastProcessedIndex + 1;
        
        // Limit to 10 articles in test mode
        const entriesToProcess = isTestMode ? entries.slice(0, 10) : entries;
        
        log(`📊 Total articles to process: ${entriesToProcess.length}`);
        log(`📍 Starting from index: ${startIndex}`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // Process each entry
        for (let i = startIndex; i < entriesToProcess.length; i++) {
            const entry = entriesToProcess[i];
            
            // Scrape the page
            const data = await scrapeAPODPage(entry);
            
            if (data) {
                scrapedData.push(data);
                successCount++;
                log(`✅ Success [${i + 1}/${entriesToProcess.length}]`);
            } else {
                errorCount++;
                log(`❌ Failed [${i + 1}/${entriesToProcess.length}]`);
            }
            
            // Save progress periodically
            if ((i + 1) % config.PROGRESS_SAVE_INTERVAL === 0) {
                saveProgress(scrapedData, i);
                log(`💾 Progress saved: ${scrapedData.length} articles`);
            }
            
            // Rate limiting
            if (i < entriesToProcess.length - 1) {
                await delay(config.RATE_LIMIT_MS);
            }
        }
        
        // Final save
        saveProgress(scrapedData, entriesToProcess.length - 1);
        
        // Statistics
        log('\n📊 SCRAPING COMPLETE!');
        log('='.repeat(50));
        log(`✅ Successfully scraped: ${successCount}`);
        log(`❌ Failed: ${errorCount}`);
        log(`📁 Total articles in file: ${scrapedData.length}`);
        log(`💾 Saved to: ${config.OUTPUT_FILE}`);
        
        // Show sample
        if (scrapedData.length > 0) {
            log('\n📋 Sample articles:');
            scrapedData.slice(0, 3).forEach((article, index) => {
                log(`   ${index + 1}. ${article.date}: ${article.title}`);
            });
        }
        
    } catch (error) {
        log(`❌ Fatal error: ${error.message}`);
        log(error.stack);
        process.exit(1);
    }
}

// Run the scraper
if (require.main === module) {
    main().catch(error => {
        log(`❌ Unhandled error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main, scrapeAPODPage, parseArchivePage };

