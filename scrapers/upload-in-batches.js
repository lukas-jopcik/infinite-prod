const fs = require('fs');
const path = require('path');

// Load the scraped data
const dataFile = path.join(__dirname, 'apod-archive-2025-10-12.json');
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('📊 Data Summary:');
console.log(`- Total entries: ${data.totalEntries}`);
console.log(`- Processed: ${data.processedCount}`);
console.log(`- Errors: ${data.errorCount}`);

// Split into batches of 100 entries each (to stay under Lambda payload limit)
const batchSize = 100;
const batches = [];
for (let i = 0; i < data.entries.length; i += batchSize) {
    batches.push(data.entries.slice(i, i + batchSize));
}

console.log(`\n📦 Split into ${batches.length} batches of ${batchSize} entries each`);

// Create batch files
batches.forEach((batch, index) => {
    const batchFile = path.join(__dirname, `batch-${index + 1}.json`);
    const payload = { entries: batch };
    fs.writeFileSync(batchFile, JSON.stringify(payload, null, 2));
    console.log(`✅ Created batch-${index + 1}.json (${batch.length} entries)`);
});

console.log('\n🚀 Upload Commands:');
batches.forEach((batch, index) => {
    console.log(`aws lambda invoke --function-name bulk-upload-apod --payload file://batch-${index + 1}.json response-${index + 1}.json`);
});

console.log('\n💰 Cost Estimate:');
const itemCount = data.entries.length;
const writeRequestCost = 1.25; // $1.25 per million write requests
const storageCost = 0.25; // $0.25 per GB per month
const writeRequests = itemCount;
const estimatedStorageGB = (itemCount * 0.001); // ~1KB per item
const writeCost = (writeRequests / 1000000) * writeRequestCost;
const storageCostMonthly = estimatedStorageGB * storageCost;

console.log(`- Write requests: ${writeRequests.toLocaleString()}`);
console.log(`- Write cost: $${writeCost.toFixed(4)}`);
console.log(`- Storage: ${estimatedStorageGB.toFixed(3)} GB`);
console.log(`- Storage cost (monthly): $${storageCostMonthly.toFixed(4)}`);
console.log(`- Total estimated cost: $${(writeCost + storageCostMonthly).toFixed(4)}`);

console.log('\n📋 Next Steps:');
console.log('1. Run the upload commands above one by one');
console.log('2. Check each response file for success/failure');
console.log('3. Monitor CloudWatch logs for detailed progress');
console.log('4. Verify data in DynamoDB after completion');
