const fs = require('fs');
const https = require('https');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

class APODArchiveScraper {
    constructor() {
        this.entries = [];
        this.processedCount = 0;
        this.errorCount = 0;
        this.startTime = Date.now();
    }

    async scrapeFullArchive() {
        console.log('🚀 Starting APOD archive scraping...');
        console.log(`📅 Year range: ${config.startYear}-${config.endYear}`);
        console.log(`📦 Batch size: ${config.batchSize}`);
        console.log(`⏱️  Delay between batches: ${config.delayMs}ms`);
        
        try {
            // 1. Parse the archive page
            console.log('\n📋 Fetching archive page...');
            const archiveHtml = await this.fetchPage(config.archiveUrl);
            const allEntries = this.parseArchivePage(archiveHtml);
            
            // 2. Filter by year range
            const filteredEntries = allEntries.filter(entry => 
                entry.year >= config.startYear && entry.year <= config.endYear
            );
            
            console.log(`📊 Found ${allEntries.length} total entries`);
            console.log(`🎯 Filtered to ${filteredEntries.length} entries (${config.startYear}-${config.endYear})`);
            
            if (filteredEntries.length === 0) {
                console.log('❌ No entries found for the specified year range');
                return;
            }
            
            // 3. Scrape individual pages in batches
            const batches = this.chunkArray(filteredEntries, config.batchSize);
            console.log(`📦 Processing ${batches.length} batches...\n`);
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} entries)`);
                
                const batchResults = await this.processBatch(batch);
                this.entries.push(...batchResults);
                this.processedCount += batchResults.length;
                
                // Progress reporting
                if ((i + 1) % Math.ceil(batches.length / 10) === 0 || i === batches.length - 1) {
                    this.reportProgress();
                }
                
                // Rate limiting
                if (i < batches.length - 1) {
                    await this.delay(config.delayMs);
                }
            }
            
            // 4. Save to JSON file
            const filename = await this.saveToJson();
            
            console.log('\n🎉 Scraping completed!');
            console.log(`✅ Successfully processed: ${this.processedCount} entries`);
            console.log(`❌ Failed: ${this.errorCount} entries`);
            console.log(`⏱️  Total time: ${this.formatDuration(Date.now() - this.startTime)}`);
            console.log(`💾 Data saved to: ${filename}`);
            
        } catch (error) {
            console.error('❌ Scraping failed:', error);
            throw error;
        }
    }

    async fetchPage(url, retries = config.maxRetries) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });
            
            request.on('error', async (error) => {
                if (retries > 0) {
                    console.log(`⚠️  Request failed, retrying... (${retries} attempts left)`);
                    await this.delay(config.retryDelayMs);
                    resolve(this.fetchPage(url, retries - 1));
                } else {
                    reject(error);
                }
            });
            
            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    parseArchivePage(html) {
        const entries = [];
        
        // Parse entries like "2025 October 01: NGC 6960: The Witchs Broom Nebula"
        const entryRegex = /(\d{4} \w+ \d{1,2}):\s*(.+?)(?=\n|$)/g;
        let match;
        
        while ((match = entryRegex.exec(html)) !== null) {
            const [, dateStr, title] = match;
            const date = this.parseDateString(dateStr);
            // Convert YYYY-MM-DD to YYMMDD format for NASA URLs
            const year2Digit = date.substring(2, 4);
            const monthDay = date.substring(5, 10).replace('-', '');
            const apodUrl = `https://apod.nasa.gov/apod/ap${year2Digit}${monthDay}.html`;
            
            entries.push({
                date: date,
                title: title.trim(),
                url: apodUrl,
                year: parseInt(date.split('-')[0])
            });
        }
        
        return entries;
    }

    parseDateString(dateStr) {
        const months = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        };
        
        const parts = dateStr.split(' ');
        const year = parts[0];
        const month = months[parts[1]];
        const day = parts[2].padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    async processBatch(batch) {
        const promises = batch.map(entry => this.scrapeAPODPage(entry));
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    }

    async scrapeAPODPage(entry, retries = config.maxRetries) {
        try {
            const html = await this.fetchPage(entry.url, retries);
            
            // Extract data to match your existing structure
            const imageUrl = this.extractImageUrl(html);
            const hdUrl = this.extractHDUrl(html);
            const explanation = this.extractExplanation(html);
            const copyright = this.extractCopyright(html);
            const mediaType = this.extractMediaType(html);
            
            // Create data structure that matches your existing APOD fetcher
            const processedData = {
                // Primary key structure (matches your DynamoDB schema)
                contentId: `apod-${entry.date}-${uuidv4()}`,
                source: config.source,
                date: entry.date,
                
                // Content data (matches your existing structure)
                title: entry.title,
                explanation: explanation,
                url: imageUrl || null,
                hdurl: hdUrl || null,
                mediaType: mediaType || 'image',
                serviceVersion: 'v1',
                copyright: copyright || null,
                thumbnailUrl: null, // Not available from scraping
                
                // Raw data (matches your existing structure)
                rawData: {
                    date: entry.date,
                    title: entry.title,
                    explanation: explanation,
                    url: imageUrl,
                    hdurl: hdUrl,
                    media_type: mediaType,
                    service_version: 'v1',
                    copyright: copyright,
                    thumbnail_url: null
                },
                
                // Metadata (matches your existing structure)
                fetchedAt: new Date().toISOString(),
                status: 'raw',
                environment: config.environment
            };
            
            return processedData;
            
        } catch (error) {
            this.errorCount++;
            console.error(`❌ Failed to scrape ${entry.url}: ${error.message}`);
            return null;
        }
    }

    extractImageUrl(html) {
        // Look for the main image - try multiple patterns
        let match;
        
        // Pattern 1: <a href="image/..."
        match = html.match(/<a href="(image\/[^"]+\.jpg)"/);
        if (match) {
            return `https://apod.nasa.gov/apod/${match[1]}`;
        }
        
        // Pattern 2: <img src="image/..."
        match = html.match(/<img[^>]+src="(image\/[^"]+\.jpg)"/);
        if (match) {
            return `https://apod.nasa.gov/apod/${match[1]}`;
        }
        
        // Pattern 3: Direct image links
        match = html.match(/<a href="(https?:\/\/[^"]+\.jpg)"/);
        if (match) {
            return match[1];
        }
        
        return null;
    }

    extractHDUrl(html) {
        // Look for HD version - usually in links or text
        const hdMatch = html.match(/<a href="(image\/[^"]+\.jpg)".*?HD/i);
        if (hdMatch) {
            return `https://apod.nasa.gov/apod/${hdMatch[1]}`;
        }
        
        // Sometimes HD is mentioned in text
        const hdTextMatch = html.match(/HD.*?<a href="(image\/[^"]+\.jpg)"/i);
        if (hdTextMatch) {
            return `https://apod.nasa.gov/apod/${hdTextMatch[1]}`;
        }
        
        return null;
    }

    extractExplanation(html) {
        // Extract the explanation text between <p> tags
        const explanationMatch = html.match(/<p[^>]*>(.*?)<\/p>/s);
        if (explanationMatch) {
            return explanationMatch[1]
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/\s+/g, ' ')    // Normalize whitespace
                .trim();
        }
        
        return null;
    }

    extractCopyright(html) {
        // Look for copyright information
        const copyrightMatch = html.match(/Copyright[^<]*<[^>]*>([^<]+)<\/[^>]*>/i);
        if (copyrightMatch) {
            return copyrightMatch[1].trim();
        }
        
        // Alternative pattern
        const altCopyrightMatch = html.match(/Image Credit[^<]*<[^>]*>([^<]+)<\/[^>]*>/i);
        if (altCopyrightMatch) {
            return altCopyrightMatch[1].trim();
        }
        
        return null;
    }

    extractMediaType(html) {
        // Check if it's a video
        if (html.includes('<video') || html.includes('youtube.com') || html.includes('vimeo.com')) {
            return 'video';
        }
        
        return 'image';
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    async saveToJson() {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${config.outputPrefix}-${timestamp}.json`;
        const filepath = path.join(config.outputDir, filename);
        
        const data = {
            scrapedAt: new Date().toISOString(),
            totalEntries: this.entries.length,
            processedCount: this.processedCount,
            errorCount: this.errorCount,
            duration: Date.now() - this.startTime,
            config: {
                startYear: config.startYear,
                endYear: config.endYear,
                batchSize: config.batchSize,
                delayMs: config.delayMs
            },
            entries: this.entries
        };
        
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`💾 Data saved to ${filename}`);
        
        return filename;
    }

    reportProgress() {
        const elapsed = Date.now() - this.startTime;
        const rate = this.processedCount / (elapsed / 1000);
        const eta = this.entries.length > 0 ? 
            ((this.entries.length - this.processedCount) / rate) : 0;
        
        console.log(`📊 Progress: ${this.processedCount}/${this.entries.length} entries`);
        console.log(`⚡ Rate: ${rate.toFixed(2)} entries/sec`);
        console.log(`⏱️  ETA: ${this.formatDuration(eta * 1000)}`);
        console.log(`❌ Errors: ${this.errorCount}\n`);
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the scraper
if (require.main === module) {
    const scraper = new APODArchiveScraper();
    scraper.scrapeFullArchive()
        .then(() => {
            console.log('\n✅ Scraping completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Scraping failed:', error);
            process.exit(1);
        });
}

module.exports = APODArchiveScraper;
