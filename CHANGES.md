# AI Generator - Sequential Processing Implementation

## Changes Summary

### 1. AI Content Generator - Sequential Mode
**File:** `backend/functions/scheduled/ai-content-generator-working.js`

**Changes:**
- Modified `getRawContentForProcessing()` function to return only 1 article at a time
- Added filter for `mediaType='image'` (excludes video articles)
- Implemented date-based sorting (descending) to process newest first
- Removed GSI fallback complexity, simplified to direct scan

**Logic:**
```javascript
async function getRawContentForProcessing() {
    // 1. Scan for RAW + IMAGE articles only
    // 2. Sort by date (newest first)
    // 3. Return ONLY the first article
    // Result: Sequential processing without duplicates
}
```

**Impact:**
- ✅ No duplicates: Each invoke processes exactly 1 article
- ✅ Predictable behavior: Always starts from newest unprocessed
- ✅ Cost control: OpenAI API called only once per invoke
- ✅ Video filter: Automatically skips video entries

### 2. Upload Script
**File:** `scrapers/upload-to-dynamodb.js` (NEW)

**Features:**
- Bulk upload from `apod-archive-data.json` to DynamoDB
- Batch processing: 25 items per batch (DynamoDB limit)
- Rate limiting: 1s delay between batches
- Error handling: Continues on partial failures
- Progress reporting: Real-time upload stats

**Usage:**
```bash
cd scrapers
npm run upload
```

### 3. Package Configuration
**File:** `scrapers/package.json`

**Added:**
- `@aws-sdk/client-dynamodb: ^3.450.0`
- `@aws-sdk/lib-dynamodb: ^3.450.0`
- Script: `"upload": "node upload-to-dynamodb.js"`

### 4. Deployment Guide
**File:** `scrapers/DEPLOYMENT-GUIDE.md` (NEW)

**Contains:**
- Step-by-step deployment instructions
- Testing procedures (3-step validation)
- Monitoring commands
- Troubleshooting guide
- Cost estimates (~$32.61 for 640 articles)

## Testing Plan

### Phase 1: Upload (Ready)
```bash
cd scrapers
npm run upload
# Expected: 640 articles uploaded in ~30s
```

### Phase 2: Sequential Test (Pending)
```bash
# Test 1: Should process 2025-10-01
aws lambda invoke --function-name infinite-ai-content-generator-dev response1.json

# Test 2: Should process 2025-09-30
aws lambda invoke --function-name infinite-ai-content-generator-dev response2.json

# Test 3: Should process 2025-09-29
aws lambda invoke --function-name infinite-ai-content-generator-dev response3.json
```

### Phase 3: Validation
- Check RAW status: 'processed'
- Verify AI article exists
- Confirm images uploaded to S3
- Validate SEO metadata

## Rollout Strategy

### Option A: EventBridge (Recommended)
- Schedule: Every 5 minutes
- Duration: ~53 hours for 640 articles
- Safe: Automatic retry on failures

### Option B: Manual Batch
- Run 10 invokes manually
- Monitor progress
- Adjust timing based on performance

## Rollback Plan

If issues occur:
1. Disable EventBridge rule
2. Check CloudWatch logs
3. Reset RAW status if needed:
```bash
aws dynamodb update-item \
  --table-name InfiniteRawContent-dev \
  --key '{"contentId":{"S":"xxx"},"source":{"S":"apod"}}' \
  --update-expression "SET #status = :status" \
  --expression-attribute-names '{"#status":"status"}' \
  --expression-attribute-values '{":status":{"S":"raw"}}'
```

## Success Criteria

- ✅ 640 RAW articles uploaded to DynamoDB
- ✅ AI generator processes 1 article per invoke
- ✅ No duplicate AI articles created
- ✅ Images correctly processed and stored in S3
- ✅ Copyright information preserved in metadata
- ✅ Sequential processing validated (3 tests)

## Next Steps

1. **Now:** Upload scraped data to DynamoDB
2. **Then:** Run 3 sequential tests
3. **Finally:** Enable automatic processing

---
**Implementation Date:** 2025-10-12
**Status:** Ready for Testing
