# Image API Setup Guide

This guide explains how to set up the Pexels API key to enable automatic image fetching for community articles.

## Overview

The AI content generator can automatically fetch relevant images for community articles from:
- **Pexels** (high-quality stock photos)

## Step 1: Get Pexels API Key

1. Go to [Pexels API](https://www.pexels.com/api/)
2. Click "Get Started" or "Sign Up"
3. Create a free account
4. Go to your dashboard
5. Copy your API key (starts with something like `563492ad6f91700001000001...`)

**Pexels API Limits:**
- Free tier: 200 requests per hour
- No attribution required for API usage
- High-quality stock photos

## Step 2: Add to AWS Secrets Manager

### Option A: Using AWS CLI

```bash
# Create the secret with Pexels API key
aws secretsmanager create-secret \
  --name "infinite-image-api-keys-dev" \
  --description "API key for Pexels image fetching" \
  --secret-string '{
    "PEXELS_API_KEY": "your-pexels-api-key-here"
  }' \
  --region eu-central-1
```

### Option B: Using AWS Console

1. Go to AWS Secrets Manager in the AWS Console
2. Click "Store a new secret"
3. Select "Other type of secret"
4. Add the following key-value pair:
   - `PEXELS_API_KEY`: `your-pexels-api-key-here`
5. Name the secret: `infinite-image-api-keys-dev`
6. Click "Store"

## Step 3: Update Lambda Environment Variables

Add the following environment variable to your `infinite-ai-content-generator-dev` Lambda function:

```bash
# Using AWS CLI
aws lambda update-function-configuration \
  --function-name infinite-ai-content-generator-dev \
  --environment Variables='{
    "PEXELS_API_KEY": "your-pexels-api-key-here"
  }' \
  --region eu-central-1
```

Or add it manually in the AWS Lambda Console:
1. Go to your Lambda function
2. Click "Configuration" tab
3. Click "Environment variables"
4. Add the PEXELS_API_KEY variable

## Step 4: Test the Setup

To test if the image fetching is working:

1. Reset a community article status to 'raw' in DynamoDB:
```bash
aws dynamodb update-item \
  --table-name InfiniteRawContent-dev \
  --key '{
    "contentId": {"S": "your-content-id"},
    "source": {"S": "reddit-space"}
  }' \
  --update-expression "SET #status = :status" \
  --expression-attribute-names '{"#status": "status"}' \
  --expression-attribute-values '{":status": {"S": "raw"}}' \
  --region eu-central-1
```

2. Invoke the AI content generator:
```bash
aws lambda invoke \
  --function-name infinite-ai-content-generator-dev \
  --payload '{"contentId": "your-content-id", "source": "reddit-space"}' \
  --region eu-central-1 \
  response.json
```

3. Check the response and logs for image fetching success

## Troubleshooting

### Common Issues

1. **"No image API keys available"**
   - Check that environment variables are set correctly
   - Verify the variable names match exactly

2. **"Error fetching from Pexels"**
   - Check API key validity
   - Verify API rate limits haven't been exceeded
   - Check network connectivity from Lambda

3. **"No suitable image found"**
   - The search query might be too specific
   - Try with different keywords in the article title
   - Check if Pexels is returning results for your search terms

### API Rate Limits

- **Pexels**: 200 requests/hour (free tier)

For production use, consider upgrading to paid tiers if you need higher limits.

### Image Storage

Images are automatically:
1. Downloaded from Pexels API
2. Uploaded to S3 bucket: `infinite-images-dev-349660737637`
3. Stored in folder: `images/community/`
4. Named with timestamp: `pexels-1234567890.jpg`

## Security Notes

- Never commit API keys to version control
- Use AWS Secrets Manager for production
- Rotate API keys regularly
- Monitor API usage to avoid unexpected charges

## Cost Considerations

- **Pexels**: Free tier should be sufficient for most use cases
- **S3 Storage**: Minimal cost for image storage
- **Lambda**: Additional execution time for image processing

## Support

If you encounter issues:
1. Check CloudWatch logs for the Lambda function
2. Verify API keys are working with direct API calls
3. Check S3 bucket permissions
4. Review network connectivity from Lambda to Pexels API
