#!/bin/bash

# Deploy AI Content Generator Lambda Function for Infinite v1.0
# This script packages and deploys the AI content generator function

set -e

echo "🚀 Deploying AI Content Generator Lambda function for Infinite v1.0..."

# Configuration
REGION="eu-central-1"
ENVIRONMENT="dev"
FUNCTION_NAME="infinite-ai-content-generator-${ENVIRONMENT}"
FUNCTION_DIR="/Users/jopcik/Desktop/infinite-clean/backend/functions/scheduled"

echo "📋 Deploying function: ${FUNCTION_NAME}"
echo "📁 Function directory: ${FUNCTION_DIR}"

# Navigate to function directory
cd ${FUNCTION_DIR}

# Create deployment package
echo "📦 Creating deployment package..."
zip -r ai-content-generator.zip ai-content-generator.js package.json node_modules/ -x "*.test.js" "*.spec.js"

# Deploy to Lambda
echo "🚀 Deploying to Lambda..."
aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --zip-file fileb://ai-content-generator.zip \
    --region ${REGION}

# Update environment variables
echo "🔧 Updating environment variables..."
cat > /tmp/ai-content-generator-env.json << EOF
{
    "Variables": {
        "ENVIRONMENT": "${ENVIRONMENT}",
        "REGION": "${REGION}",
        "DYNAMODB_RAW_CONTENT_TABLE": "InfiniteRawContent-${ENVIRONMENT}",
        "DYNAMODB_ARTICLES_TABLE": "InfiniteArticles-${ENVIRONMENT}",
        "S3_IMAGES_BUCKET": "infinite-images-${ENVIRONMENT}-349660737637",
        "OPENAI_SECRET_ARN": "arn:aws:secretsmanager:${REGION}:349660737637:secret:infinite/openai-api-key"
    }
}
EOF

aws lambda update-function-configuration \
    --function-name ${FUNCTION_NAME} \
    --environment file:///tmp/ai-content-generator-env.json \
    --region ${REGION}

# Clean up
echo "🧹 Cleaning up..."
rm -f ai-content-generator.zip
rm -f /tmp/ai-content-generator-env.json

echo "✅ AI Content Generator deployed successfully!"
echo ""
echo "📋 Function details:"
echo "  📛 Name: ${FUNCTION_NAME}"
echo "  🌍 Region: ${REGION}"
echo "  📁 Runtime: Node.js 20.x"
echo "  💾 Memory: 512MB"
echo "  ⏱️  Timeout: 300s"
echo ""
echo "📝 Next steps:"
echo "  1. Test the function manually"
echo "  2. Set up EventBridge scheduled rule"
echo "  3. Configure CloudWatch monitoring"
echo "  4. Test end-to-end content generation"
