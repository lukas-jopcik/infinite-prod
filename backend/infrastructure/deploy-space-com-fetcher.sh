#!/bin/bash

# Deploy Space.com RSS Fetcher Lambda Function
# This script deploys the Space.com RSS fetcher and content generator Lambda functions

set -e

# Configuration
FUNCTION_NAME_FETCHER="space-com-fetcher"
FUNCTION_NAME_GENERATOR="space-com-content-generator"
REGION="eu-central-1"
ENVIRONMENT="dev"
ROLE_NAME="InfiniteLambdaExecutionRole-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Space.com Pipeline Lambda Functions${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Get the Lambda execution role ARN
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null || echo "")
if [ -z "$ROLE_ARN" ]; then
    echo -e "${RED}❌ Lambda execution role '$ROLE_NAME' not found.${NC}"
    echo "Please create the role first or update the ROLE_NAME variable."
    exit 1
fi

echo -e "${YELLOW}📦 Creating deployment packages...${NC}"

# Create deployment directory
DEPLOY_DIR="deployment-packages"
mkdir -p $DEPLOY_DIR

# Deploy Space.com RSS Fetcher
echo -e "${YELLOW}📡 Deploying Space.com RSS Fetcher...${NC}"

# Create package for fetcher
cd backend/functions/scheduled
zip -r ../../../$DEPLOY_DIR/space-com-fetcher.zip space-com-fetcher.js
cd ../../../

# Deploy fetcher function
aws lambda create-function \
    --function-name $FUNCTION_NAME_FETCHER \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler space-com-fetcher.handler \
    --zip-file fileb://$DEPLOY_DIR/space-com-fetcher.zip \
    --description "Space.com RSS feed fetcher - fetches and stores raw content" \
    --timeout 300 \
    --memory-size 512 \
    --environment Variables="{
        ENVIRONMENT=$ENVIRONMENT,
        AWS_REGION=$REGION,
        DYNAMODB_RAW_CONTENT_TABLE=InfiniteRawContent-$ENVIRONMENT
    }" \
    --region $REGION \
    2>/dev/null || {
    echo -e "${YELLOW}⚠️  Function exists, updating...${NC}"
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME_FETCHER \
        --zip-file fileb://$DEPLOY_DIR/space-com-fetcher.zip \
        --region $REGION
    
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME_FETCHER \
        --timeout 300 \
        --memory-size 512 \
        --environment Variables="{
            ENVIRONMENT=$ENVIRONMENT,
            AWS_REGION=$REGION,
            DYNAMODB_RAW_CONTENT_TABLE=InfiniteRawContent-$ENVIRONMENT
        }" \
        --region $REGION
}

echo -e "${GREEN}✅ Space.com RSS Fetcher deployed successfully${NC}"

# Deploy Space.com Content Generator
echo -e "${YELLOW}🤖 Deploying Space.com Content Generator...${NC}"

# Create package for generator (includes utils)
cd backend/functions/scheduled
zip -r ../../../$DEPLOY_DIR/space-com-content-generator.zip \
    space-com-content-generator.js \
    ../utils/nasa-image-utils.js \
    ../utils/nasa-image-service.js \
    ../utils/bulvar-prompts.js
cd ../../../

# Deploy generator function
aws lambda create-function \
    --function-name $FUNCTION_NAME_GENERATOR \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler space-com-content-generator.handler \
    --zip-file fileb://$DEPLOY_DIR/space-com-content-generator.zip \
    --description "Space.com content generator - generates Slovak bulvár articles with NASA images" \
    --timeout 900 \
    --memory-size 1024 \
    --environment Variables="{
        ENVIRONMENT=$ENVIRONMENT,
        REGION=$REGION,
        DYNAMODB_RAW_CONTENT_TABLE=InfiniteRawContent-$ENVIRONMENT,
        DYNAMODB_ARTICLES_TABLE=InfiniteArticles-$ENVIRONMENT,
        S3_IMAGES_BUCKET=infinite-images-$ENVIRONMENT-349660737637,
        CLOUDFRONT_DOMAIN=d2ydyf9w4v170.cloudfront.net,
        OPENAI_SECRET_ARN=arn:aws:secretsmanager:$REGION:349660737637:secret:openai-api-key
    }" \
    --region $REGION \
    2>/dev/null || {
    echo -e "${YELLOW}⚠️  Function exists, updating...${NC}"
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME_GENERATOR \
        --zip-file fileb://$DEPLOY_DIR/space-com-content-generator.zip \
        --region $REGION
    
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME_GENERATOR \
        --timeout 900 \
        --memory-size 1024 \
        --environment Variables="{
            ENVIRONMENT=$ENVIRONMENT,
            REGION=$REGION,
            DYNAMODB_RAW_CONTENT_TABLE=InfiniteRawContent-$ENVIRONMENT,
            DYNAMODB_ARTICLES_TABLE=InfiniteArticles-$ENVIRONMENT,
            S3_IMAGES_BUCKET=infinite-images-$ENVIRONMENT-349660737637,
            CLOUDFRONT_DOMAIN=d2ydyf9w4v170.cloudfront.net,
            OPENAI_SECRET_ARN=arn:aws:secretsmanager:$REGION:349660737637:secret:openai-api-key
        }" \
        --region $REGION
}

echo -e "${GREEN}✅ Space.com Content Generator deployed successfully${NC}"

# Test the functions
echo -e "${YELLOW}🧪 Testing deployed functions...${NC}"

# Test fetcher
echo "Testing Space.com RSS Fetcher..."
FETCHER_RESULT=$(aws lambda invoke \
    --function-name $FUNCTION_NAME_FETCHER \
    --payload '{}' \
    --region $REGION \
    /tmp/fetcher-result.json 2>/dev/null && cat /tmp/fetcher-result.json)

if echo "$FETCHER_RESULT" | grep -q "statusCode.*200"; then
    echo -e "${GREEN}✅ RSS Fetcher test successful${NC}"
else
    echo -e "${RED}❌ RSS Fetcher test failed${NC}"
    echo "Result: $FETCHER_RESULT"
fi

# Test generator
echo "Testing Space.com Content Generator..."
GENERATOR_RESULT=$(aws lambda invoke \
    --function-name $FUNCTION_NAME_GENERATOR \
    --payload '{}' \
    --region $REGION \
    /tmp/generator-result.json 2>/dev/null && cat /tmp/generator-result.json)

if echo "$GENERATOR_RESULT" | grep -q "statusCode.*200"; then
    echo -e "${GREEN}✅ Content Generator test successful${NC}"
else
    echo -e "${RED}❌ Content Generator test failed${NC}"
    echo "Result: $GENERATOR_RESULT"
fi

# Cleanup
rm -f /tmp/fetcher-result.json /tmp/generator-result.json
rm -rf $DEPLOY_DIR

echo ""
echo -e "${GREEN}🎉 Space.com Pipeline deployment completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Run setup-space-com-schedule.sh to set up EventBridge scheduling"
echo "2. Test the pipeline with real Space.com RSS data"
echo "3. Monitor CloudWatch logs for any issues"
echo ""
echo "Functions deployed:"
echo "- $FUNCTION_NAME_FETCHER (RSS fetcher)"
echo "- $FUNCTION_NAME_GENERATOR (Content generator)"
