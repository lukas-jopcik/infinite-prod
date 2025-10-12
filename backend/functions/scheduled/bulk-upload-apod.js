const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS services
const dynamodbClient = new DynamoDBClient({ region: process.env.REGION || 'eu-central-1' });
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

// Configuration
const REGION = process.env.REGION || 'eu-central-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const RAW_CONTENT_TABLE = process.env.DYNAMODB_RAW_CONTENT_TABLE || 'InfiniteRawContent-dev';

/**
 * Main Lambda handler for bulk APOD data upload
 */
exports.handler = async (event) => {
    console.log('Bulk Upload Lambda invoked:', JSON.stringify(event, null, 2));
    
    try {
        // Validate input
        if (!event.entries || !Array.isArray(event.entries)) {
            throw new Error('Invalid input: entries array is required');
        }
        
        const entries = event.entries;
        console.log(`📤 Starting bulk upload of ${entries.length} entries`);
        
        // Validate data structure
        const validationResult = validateEntries(entries);
        if (!validationResult.valid) {
            throw new Error(`Data validation failed: ${validationResult.errors.join(', ')}`);
        }
        
        // Process in batches of 25 (DynamoDB limit)
        const batches = chunkArray(entries, 25);
        let uploaded = 0;
        let failed = 0;
        
        console.log(`📦 Processing ${batches.length} batches...`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);
            
            try {
                await uploadBatch(batch);
                uploaded += batch.length;
                console.log(`✅ Batch ${i + 1} uploaded successfully`);
            } catch (error) {
                console.error(`❌ Batch ${i + 1} failed:`, error.message);
                failed += batch.length;
                
                // Continue with next batch instead of failing completely
                continue;
            }
        }
        
        const result = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Bulk upload completed',
                totalEntries: entries.length,
                uploaded: uploaded,
                failed: failed,
                successRate: `${((uploaded / entries.length) * 100).toFixed(2)}%`,
                estimatedCost: calculateCostEstimate(uploaded),
                environment: ENVIRONMENT,
                table: RAW_CONTENT_TABLE
            })
        };
        
        console.log('✅ Bulk upload completed:', result.body);
        return result;
        
    } catch (error) {
        console.error('❌ Bulk upload failed:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Bulk upload failed',
                message: error.message,
                stack: error.stack
            })
        };
    }
};

/**
 * Validate entries data structure
 */
function validateEntries(entries) {
    const errors = [];
    const requiredFields = ['contentId', 'source', 'date', 'title', 'explanation'];
    
    entries.forEach((entry, index) => {
        requiredFields.forEach(field => {
            if (!entry[field]) {
                errors.push(`Entry ${index}: missing required field '${field}'`);
            }
        });
        
        // Validate date format
        if (entry.date && !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
            errors.push(`Entry ${index}: invalid date format '${entry.date}' (expected YYYY-MM-DD)`);
        }
        
        // Validate source
        if (entry.source && entry.source !== 'apod') {
            errors.push(`Entry ${index}: invalid source '${entry.source}' (expected 'apod')`);
        }
    });
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Upload a batch of entries to DynamoDB
 */
async function uploadBatch(batch) {
    // Prepare items for DynamoDB
    const items = batch.map(entry => ({
        // Ensure all required fields are present and properly formatted
        contentId: entry.contentId,
        source: entry.source || 'apod',
        date: entry.date,
        title: entry.title,
        explanation: entry.explanation,
        url: entry.url || null,
        hdurl: entry.hdurl || null,
        mediaType: entry.mediaType || 'image',
        serviceVersion: entry.serviceVersion || 'v1',
        copyright: entry.copyright || null,
        thumbnailUrl: entry.thumbnailUrl || null,
        rawData: entry.rawData || {},
        fetchedAt: entry.fetchedAt || new Date().toISOString(),
        status: entry.status || 'raw',
        environment: entry.environment || ENVIRONMENT
    }));
    
    const params = {
        RequestItems: {
            [RAW_CONTENT_TABLE]: items.map(item => ({
                PutRequest: { Item: item }
            }))
        }
    };
    
    try {
        await dynamodb.send(new BatchWriteCommand(params));
        console.log(`✅ Successfully uploaded ${items.length} items to ${RAW_CONTENT_TABLE}`);
    } catch (error) {
        console.error('❌ BatchWriteCommand failed:', error);
        throw error;
    }
}

/**
 * Split array into chunks
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Calculate cost estimate for DynamoDB operations
 */
function calculateCostEstimate(itemCount) {
    // DynamoDB pricing (as of 2024)
    const writeRequestCost = 1.25; // $1.25 per million write requests
    const storageCost = 0.25; // $0.25 per GB per month
    
    const writeRequests = itemCount;
    const estimatedStorageGB = (itemCount * 0.001); // ~1KB per item
    
    const writeCost = (writeRequests / 1000000) * writeRequestCost;
    const storageCostMonthly = estimatedStorageGB * storageCost;
    
    return {
        writeRequests: writeRequests,
        writeCost: `$${writeCost.toFixed(4)}`,
        estimatedStorageGB: estimatedStorageGB.toFixed(3),
        storageCostMonthly: `$${storageCostMonthly.toFixed(4)}`,
        totalCost: `$${(writeCost + storageCostMonthly).toFixed(4)}`
    };
}

// Export functions for testing
module.exports = {
    handler: exports.handler,
    validateEntries,
    uploadBatch,
    chunkArray,
    calculateCostEstimate
};
