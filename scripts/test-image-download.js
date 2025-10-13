#!/usr/bin/env node

const axios = require('axios');

async function testImageDownload() {
    const url = 'https://cdn.esahubble.org/archives/images/screen/potw2528a.jpg';
    
    console.log('🔍 Testing image download...');
    console.log(`URL: ${url}\n`);
    
    try {
        console.log('📥 Downloading with same settings as ai-content-generator...');
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Infinite-Astronomy-Bot/1.0'
            }
        });
        
        console.log(`✅ Download successful`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers['content-type']}`);
        console.log(`   Content-Length: ${response.headers['content-length']}`);
        console.log(`   Data length: ${response.data.length} bytes`);
        
        // Check if it's actually an image
        const buffer = Buffer.from(response.data);
        const firstBytes = buffer.slice(0, 10);
        console.log(`   First 10 bytes: ${Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        
        // JPEG files start with FF D8 FF
        if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF) {
            console.log('   ✅ Valid JPEG file detected');
        } else {
            console.log('   ❌ Not a valid JPEG file');
            
            // Check if it's HTML
            const text = buffer.toString('utf8', 0, 200);
            if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                console.log('   ❌ Downloaded content is HTML, not an image');
                console.log(`   First 200 chars: ${text.substring(0, 200)}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Download failed:', error.message);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Headers:`, error.response.headers);
        }
    }
}

// Run test
if (require.main === module) {
    testImageDownload();
}

module.exports = { testImageDownload };
