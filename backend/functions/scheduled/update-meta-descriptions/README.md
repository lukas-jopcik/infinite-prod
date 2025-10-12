# Meta Descriptions Update Script

This Lambda function updates existing articles in the database with improved meta descriptions for better SEO.

## What it does

1. **Scans all articles** in the DynamoDB table
2. **Identifies articles** that need meta description improvements:
   - Articles with no meta description
   - Articles with meta descriptions that are too short (< 50 characters)
   - Articles with meta descriptions that are too long (> 160 characters)
   - Articles with generic meta descriptions
3. **Generates better meta descriptions** using the same logic as the frontend:
   - Uses existing `metaDescription` if good
   - Falls back to `perex` if available
   - Falls back to first section content
   - Uses category-specific defaults as final fallback
4. **Updates the articles** in the database

## Files

- `index.js` - Main Lambda function code
- `package.json` - Node.js dependencies
- `README.md` - This documentation

## Deployment

### Deploy to AWS Lambda

```bash
# From the scheduled directory
./deploy-meta-descriptions-update.sh
```

### Run locally for testing

```bash
# From the scheduled directory
./run-meta-descriptions-update.sh
```

### Run on AWS Lambda

```bash
# Invoke the function
aws lambda invoke --function-name update-meta-descriptions --payload '{}' response.json

# Check the response
cat response.json
```

## Configuration

The script uses these environment variables:
- `ENVIRONMENT` - Set to 'dev' for development environment

## Safety Features

- **Batch processing** - Processes articles in small batches to avoid throttling
- **Error handling** - Continues processing even if individual articles fail
- **Logging** - Detailed logs of what's being updated
- **Validation** - Only updates articles that actually need improvements

## Expected Results

After running this script, you should see:
- All articles have proper meta descriptions (50-160 characters)
- Meta descriptions are more descriptive and SEO-friendly
- Better search engine visibility for your articles

## Monitoring

Check the CloudWatch logs for the Lambda function to see:
- How many articles were processed
- Which articles were updated
- Any errors that occurred

Log group: `/aws/lambda/update-meta-descriptions`
