const fs = require('fs');
const path = require('path');

// Load the scraped data
const dataFile = path.join(__dirname, 'apod-archive-2025-10-12.json');
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

console.log('📊 Data Summary:');
console.log(`- Total entries: ${data.totalEntries}`);
console.log(`- Processed: ${data.processedCount}`);
console.log(`- Errors: ${data.errorCount}`);
console.log(`- File size: ${(fs.statSync(dataFile).size / 1024 / 1024).toFixed(2)} MB`);

// Prepare payload for Lambda
const payload = {
    entries: data.entries
};

// Save payload for Lambda invocation
const payloadFile = path.join(__dirname, 'upload-payload.json');
fs.writeFileSync(payloadFile, JSON.stringify(payload, null, 2));

console.log('\n✅ Payload prepared for Lambda upload');
console.log(`📁 Payload saved to: ${payloadFile}`);
console.log(`📦 Ready to upload ${data.entries.length} entries to DynamoDB`);

// Calculate estimated cost
const itemCount = data.entries.length;
const writeRequestCost = 1.25; // $1.25 per million write requests
const storageCost = 0.25; // $0.25 per GB per month
const writeRequests = itemCount;
const estimatedStorageGB = (itemCount * 0.001); // ~1KB per item
const writeCost = (writeRequests / 1000000) * writeRequestCost;
const storageCostMonthly = estimatedStorageGB * storageCost;

console.log('\n💰 Cost Estimate:');
console.log(`- Write requests: ${writeRequests.toLocaleString()}`);
console.log(`- Write cost: $${writeCost.toFixed(4)}`);
console.log(`- Storage: ${estimatedStorageGB.toFixed(3)} GB`);
console.log(`- Storage cost (monthly): $${storageCostMonthly.toFixed(4)}`);
console.log(`- Total estimated cost: $${(writeCost + storageCostMonthly).toFixed(4)}`);

console.log('\n🚀 Next Steps:');
console.log('1. Deploy the Lambda function:');
console.log('   cd ../backend/functions/scheduled/bulk-upload-apod');
console.log('   zip -r bulk-upload-apod.zip .');
console.log('   aws lambda update-function-code --function-name bulk-upload-apod --zip-file fileb://bulk-upload-apod.zip');
console.log('');
console.log('2. Invoke the Lambda function:');
console.log(`   aws lambda invoke --function-name bulk-upload-apod --payload file://${payloadFile} response.json`);
console.log('');
console.log('3. Check the response:');
console.log('   cat response.json | jq .');
