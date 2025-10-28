#!/bin/bash

# Test AI Discoveries Pipeline - End-to-End Testing
# This script tests the complete AI discoveries pipeline

set -e

# Configuration
ENVIRONMENT="dev"
REGION="eu-central-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Testing AI Discoveries Pipeline${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Function names
IDEA_GENERATOR_FUNCTION="ai-idea-generator"
DISCOVERIES_GENERATOR_FUNCTION="ai-discoveries-generator"

# Table names
RAW_CONTENT_TABLE="InfiniteRawContent-$ENVIRONMENT"
ARTICLES_TABLE="InfiniteArticles-$ENVIRONMENT"

echo -e "${BLUE}📋 Test Plan:${NC}"
echo "  1. Test AI Idea Generator Lambda"
echo "  2. Verify ideas stored in DynamoDB"
echo "  3. Test AI Discoveries Generator Lambda"
echo "  4. Verify articles created in DynamoDB"
echo "  5. Check S3 image uploads"
echo "  6. Validate data quality"
echo ""

# 1. Test AI Idea Generator
echo -e "${YELLOW}🧪 Step 1: Testing AI Idea Generator...${NC}"

echo "Invoking AI Idea Generator Lambda..."
aws lambda invoke \
    --function-name $IDEA_GENERATOR_FUNCTION \
    --payload '{}' \
    --region $REGION \
    --output text \
    idea-generator-response.json > /dev/null

if [ -f idea-generator-response.json ]; then
    echo -e "${GREEN}✅ AI Idea Generator executed${NC}"
    echo "Response:"
    cat idea-generator-response.json | jq '.' 2>/dev/null || cat idea-generator-response.json
    echo ""
    rm -f idea-generator-response.json
else
    echo -e "${RED}❌ AI Idea Generator test failed${NC}"
    exit 1
fi

# 2. Check DynamoDB for new ideas
echo -e "${YELLOW}🔍 Step 2: Checking DynamoDB for new ideas...${NC}"

echo "Scanning InfiniteRawContent table for AI-generated ideas..."
aws dynamodb scan \
    --table-name $RAW_CONTENT_TABLE \
    --filter-expression "#source = :source" \
    --expression-attribute-names '{"#source": "source"}' \
    --expression-attribute-values '{":source": {"S": "ai-generated-ideas"}}' \
    --region $REGION \
    --query 'Items[0:5].{contentId:contentId.S,title:title.S,status:status.S,createdAt:createdAt.S}' \
    --output table

IDEA_COUNT=$(aws dynamodb scan \
    --table-name $RAW_CONTENT_TABLE \
    --filter-expression "#source = :source AND #status = :status" \
    --expression-attribute-names '{"#source": "source", "#status": "status"}' \
    --expression-attribute-values '{":source": {"S": "ai-generated-ideas"}, ":status": {"S": "raw"}}' \
    --region $REGION \
    --select COUNT \
    --query 'Count' \
    --output text)

echo "Raw ideas available for processing: $IDEA_COUNT"

if [ "$IDEA_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Ideas found in DynamoDB${NC}"
else
    echo -e "${YELLOW}⚠️  No raw ideas found. This is normal if all ideas have been processed.${NC}"
fi

# 3. Test AI Discoveries Generator
echo -e "${YELLOW}🧪 Step 3: Testing AI Discoveries Generator...${NC}"

echo "Invoking AI Discoveries Generator Lambda..."
aws lambda invoke \
    --function-name $DISCOVERIES_GENERATOR_FUNCTION \
    --payload '{}' \
    --region $REGION \
    --output text \
    discoveries-generator-response.json > /dev/null

if [ -f discoveries-generator-response.json ]; then
    echo -e "${GREEN}✅ AI Discoveries Generator executed${NC}"
    echo "Response:"
    cat discoveries-generator-response.json | jq '.' 2>/dev/null || cat discoveries-generator-response.json
    echo ""
    rm -f discoveries-generator-response.json
else
    echo -e "${RED}❌ AI Discoveries Generator test failed${NC}"
    exit 1
fi

# 4. Check DynamoDB for new articles
echo -e "${YELLOW}🔍 Step 4: Checking DynamoDB for new articles...${NC}"

echo "Scanning InfiniteArticles table for AI-generated articles..."
aws dynamodb scan \
    --table-name $ARTICLES_TABLE \
    --filter-expression "#category = :category" \
    --expression-attribute-names '{"#category": "category"}' \
    --expression-attribute-values '{":category": {"S": "ai-discoveries"}}' \
    --region $REGION \
    --query 'Items[0:3].{id:id.S,title:title.S,slug:slug.S,category:category.S,type:type.S,publishedAt:publishedAt.S}' \
    --output table

ARTICLE_COUNT=$(aws dynamodb scan \
    --table-name $ARTICLES_TABLE \
    --filter-expression "#category = :category" \
    --expression-attribute-names '{"#category": "category"}' \
    --expression-attribute-values '{":category": {"S": "ai-discoveries"}}' \
    --region $REGION \
    --select COUNT \
    --query 'Count' \
    --output text)

echo "AI-generated articles in database: $ARTICLE_COUNT"

if [ "$ARTICLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Articles found in DynamoDB${NC}"
else
    echo -e "${YELLOW}⚠️  No AI-generated articles found yet.${NC}"
fi

# 5. Check S3 for uploaded images
echo -e "${YELLOW}🔍 Step 5: Checking S3 for uploaded images...${NC}"

S3_BUCKET="infinite-images-$ENVIRONMENT-349660737637"
echo "Checking S3 bucket: $S3_BUCKET"

aws s3 ls s3://$S3_BUCKET/ai-generated/ --region $REGION --recursive | head -10

IMAGE_COUNT=$(aws s3 ls s3://$S3_BUCKET/ai-generated/ --region $REGION --recursive | wc -l)
echo "Images in ai-generated folder: $IMAGE_COUNT"

if [ "$IMAGE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Images found in S3${NC}"
else
    echo -e "${YELLOW}⚠️  No images found in S3 yet.${NC}"
fi

# 6. Data Quality Check
echo -e "${YELLOW}🔍 Step 6: Data Quality Check...${NC}"

echo "Checking for processed ideas..."
PROCESSED_COUNT=$(aws dynamodb scan \
    --table-name $RAW_CONTENT_TABLE \
    --filter-expression "#source = :source AND #status = :status" \
    --expression-attribute-names '{"#source": "source", "#status": "status"}' \
    --expression-attribute-values '{":source": {"S": "ai-generated-ideas"}, ":status": {"S": "processed"}}' \
    --region $REGION \
    --select COUNT \
    --query 'Count' \
    --output text)

echo "Processed ideas: $PROCESSED_COUNT"

# 7. Summary
echo ""
echo -e "${GREEN}🎉 AI Discoveries Pipeline Test Summary${NC}"
echo ""
echo -e "${YELLOW}📊 Results:${NC}"
echo "  ✅ AI Idea Generator: Working"
echo "  ✅ AI Discoveries Generator: Working"
echo "  📝 Raw ideas in queue: $IDEA_COUNT"
echo "  📄 AI-generated articles: $ARTICLE_COUNT"
echo "  🖼️  Images uploaded: $IMAGE_COUNT"
echo "  ✅ Processed ideas: $PROCESSED_COUNT"
echo ""

if [ "$ARTICLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}🎯 Pipeline is working! Articles are being generated.${NC}"
    echo ""
    echo -e "${YELLOW}🔗 Next steps:${NC}"
    echo "  1. Check frontend at /kategoria/vesmirne-objavy"
    echo "  2. Monitor CloudWatch logs for scheduled executions"
    echo "  3. Verify article URLs work correctly"
    echo "  4. Check SEO metadata and image credits"
else
    echo -e "${YELLOW}⚠️  Pipeline is set up but no articles generated yet.${NC}"
    echo "This could be normal if:"
    echo "  - No raw ideas were available for processing"
    echo "  - Ideas are being generated but not yet processed"
    echo "  - There was an error in the content generation"
    echo ""
    echo -e "${YELLOW}🔗 Troubleshooting:${NC}"
    echo "  1. Check CloudWatch logs for errors"
    echo "  2. Verify OpenAI API key is working"
    echo "  3. Check DynamoDB permissions"
    echo "  4. Run the test again in a few minutes"
fi

echo ""
echo -e "${BLUE}📝 Test completed at $(date)${NC}"
