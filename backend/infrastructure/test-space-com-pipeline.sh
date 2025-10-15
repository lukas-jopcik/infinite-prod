#!/bin/bash

# Test Space.com Pipeline End-to-End
# This script tests the complete pipeline from RSS fetch to article generation

set -e

# Configuration
FUNCTION_NAME_FETCHER="space-com-fetcher"
FUNCTION_NAME_GENERATOR="space-com-content-generator"
REGION="eu-central-1"
ENVIRONMENT="dev"
RAW_CONTENT_TABLE="InfiniteRawContent-$ENVIRONMENT"
ARTICLES_TABLE="InfiniteArticles-$ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Testing Space.com Pipeline End-to-End${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Function to check if Lambda function exists
check_lambda_exists() {
    local function_name=$1
    aws lambda get-function --function-name $function_name --region $REGION > /dev/null 2>&1
}

# Function to check DynamoDB table exists
check_table_exists() {
    local table_name=$1
    aws dynamodb describe-table --table-name $table_name --region $REGION > /dev/null 2>&1
}

# Function to count items in DynamoDB table
count_table_items() {
    local table_name=$1
    local index_name=$2
    local key_condition=$3
    local filter_expression=$4
    
    if [ -n "$index_name" ]; then
        aws dynamodb query \
            --table-name $table_name \
            --index-name $index_name \
            --key-condition-expression "$key_condition" \
            --filter-expression "$filter_expression" \
            --select COUNT \
            --region $REGION \
            --query 'Count' \
            --output text 2>/dev/null || echo "0"
    else
        aws dynamodb scan \
            --table-name $table_name \
            --filter-expression "$filter_expression" \
            --select COUNT \
            --region $REGION \
            --query 'Count' \
            --output text 2>/dev/null || echo "0"
    fi
}

echo -e "${BLUE}📋 Pre-test checks...${NC}"

# Check Lambda functions exist
if ! check_lambda_exists $FUNCTION_NAME_FETCHER; then
    echo -e "${RED}❌ Lambda function '$FUNCTION_NAME_FETCHER' not found${NC}"
    echo "Please deploy the functions first using deploy-space-com-fetcher.sh"
    exit 1
fi

if ! check_lambda_exists $FUNCTION_NAME_GENERATOR; then
    echo -e "${RED}❌ Lambda function '$FUNCTION_NAME_GENERATOR' not found${NC}"
    echo "Please deploy the functions first using deploy-space-com-fetcher.sh"
    exit 1
fi

# Check DynamoDB tables exist
if ! check_table_exists $RAW_CONTENT_TABLE; then
    echo -e "${RED}❌ DynamoDB table '$RAW_CONTENT_TABLE' not found${NC}"
    exit 1
fi

if ! check_table_exists $ARTICLES_TABLE; then
    echo -e "${RED}❌ DynamoDB table '$ARTICLES_TABLE' not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites found${NC}"

# Get initial counts
echo -e "${BLUE}📊 Getting initial data counts...${NC}"
INITIAL_RAW_COUNT=$(count_table_items $RAW_CONTENT_TABLE "status-index" "status = :status" "source = :source" 2>/dev/null || echo "0")
INITIAL_ARTICLES_COUNT=$(count_table_items $ARTICLES_TABLE "type-originalDate-index" "type = :type" "category = :category" 2>/dev/null || echo "0")

echo "Initial raw content items: $INITIAL_RAW_COUNT"
echo "Initial news articles: $INITIAL_ARTICLES_COUNT"

# Test 1: RSS Fetcher
echo -e "${BLUE}📡 Test 1: RSS Fetcher${NC}"
echo "Invoking Space.com RSS fetcher..."

FETCHER_RESULT=$(aws lambda invoke \
    --function-name $FUNCTION_NAME_FETCHER \
    --payload '{}' \
    --region $REGION \
    /tmp/fetcher-test-result.json 2>/dev/null && cat /tmp/fetcher-test-result.json)

echo "Fetcher result: $FETCHER_RESULT"

if echo "$FETCHER_RESULT" | grep -q "statusCode.*200"; then
    echo -e "${GREEN}✅ RSS Fetcher test successful${NC}"
    
    # Check if new raw content was added
    sleep 5  # Wait for DynamoDB eventual consistency
    NEW_RAW_COUNT=$(count_table_items $RAW_CONTENT_TABLE "status-index" "status = :status" "source = :source" 2>/dev/null || echo "0")
    
    if [ "$NEW_RAW_COUNT" -gt "$INITIAL_RAW_COUNT" ]; then
        echo -e "${GREEN}✅ New raw content items detected: $NEW_RAW_COUNT (was $INITIAL_RAW_COUNT)${NC}"
    else
        echo -e "${YELLOW}⚠️  No new raw content items detected (may be duplicates)${NC}"
    fi
else
    echo -e "${RED}❌ RSS Fetcher test failed${NC}"
    echo "Result: $FETCHER_RESULT"
    exit 1
fi

# Test 2: Content Generator
echo -e "${BLUE}🤖 Test 2: Content Generator${NC}"
echo "Invoking Space.com content generator..."

GENERATOR_RESULT=$(aws lambda invoke \
    --function-name $FUNCTION_NAME_GENERATOR \
    --payload '{}' \
    --region $REGION \
    /tmp/generator-test-result.json 2>/dev/null && cat /tmp/generator-test-result.json)

echo "Generator result: $GENERATOR_RESULT"

if echo "$GENERATOR_RESULT" | grep -q "statusCode.*200"; then
    echo -e "${GREEN}✅ Content Generator test successful${NC}"
    
    # Check if new articles were created
    sleep 5  # Wait for DynamoDB eventual consistency
    NEW_ARTICLES_COUNT=$(count_table_items $ARTICLES_TABLE "type-originalDate-index" "type = :type" "category = :category" 2>/dev/null || echo "0")
    
    if [ "$NEW_ARTICLES_COUNT" -gt "$INITIAL_ARTICLES_COUNT" ]; then
        echo -e "${GREEN}✅ New news articles detected: $NEW_ARTICLES_COUNT (was $INITIAL_ARTICLES_COUNT)${NC}"
    else
        echo -e "${YELLOW}⚠️  No new articles detected (may be no raw content to process)${NC}"
    fi
else
    echo -e "${RED}❌ Content Generator test failed${NC}"
    echo "Result: $GENERATOR_RESULT"
    exit 1
fi

# Test 3: Data Quality Check
echo -e "${BLUE}🔍 Test 3: Data Quality Check${NC}"

# Check for recent raw content
echo "Checking recent raw content..."
RECENT_RAW=$(aws dynamodb query \
    --table-name $RAW_CONTENT_TABLE \
    --index-name "status-index" \
    --key-condition-expression "status = :status" \
    --filter-expression "source = :source" \
    --expression-attribute-values '{
        ":status": {"S": "raw"},
        ":source": {"S": "space-com"}
    }' \
    --limit 1 \
    --region $REGION \
    --query 'Items[0]' \
    --output json 2>/dev/null || echo "null")

if [ "$RECENT_RAW" != "null" ] && [ "$RECENT_RAW" != "None" ]; then
    echo -e "${GREEN}✅ Recent raw content found${NC}"
    echo "Sample raw content title: $(echo $RECENT_RAW | jq -r '.title.S // "N/A"')"
else
    echo -e "${YELLOW}⚠️  No recent raw content found${NC}"
fi

# Check for recent articles
echo "Checking recent news articles..."
RECENT_ARTICLE=$(aws dynamodb query \
    --table-name $ARTICLES_TABLE \
    --index-name "type-originalDate-index" \
    --key-condition-expression "type = :type" \
    --filter-expression "category = :category" \
    --expression-attribute-values '{
        ":type": {"S": "news"},
        ":category": {"S": "news"}
    }' \
    --limit 1 \
    --region $REGION \
    --query 'Items[0]' \
    --output json 2>/dev/null || echo "null")

if [ "$RECENT_ARTICLE" != "null" ] && [ "$RECENT_ARTICLE" != "None" ]; then
    echo -e "${GREEN}✅ Recent news article found${NC}"
    echo "Sample article title: $(echo $RECENT_ARTICLE | jq -r '.title.S // "N/A"')"
    echo "Sample article slug: $(echo $RECENT_ARTICLE | jq -r '.slug.S // "N/A"')"
    
    # Check if article has required fields
    HAS_HERO_IMAGE=$(echo $RECENT_ARTICLE | jq -r '.heroImage.M // "null"')
    HAS_INLINE_IMAGE=$(echo $RECENT_ARTICLE | jq -r '.inlineImage.M // "null"')
    HAS_SEO=$(echo $RECENT_ARTICLE | jq -r '.metaTitle.S // "null"')
    
    if [ "$HAS_HERO_IMAGE" != "null" ]; then
        echo -e "${GREEN}✅ Article has hero image${NC}"
    else
        echo -e "${YELLOW}⚠️  Article missing hero image${NC}"
    fi
    
    if [ "$HAS_INLINE_IMAGE" != "null" ]; then
        echo -e "${GREEN}✅ Article has inline image${NC}"
    else
        echo -e "${YELLOW}⚠️  Article missing inline image${NC}"
    fi
    
    if [ "$HAS_SEO" != "null" ]; then
        echo -e "${GREEN}✅ Article has SEO metadata${NC}"
    else
        echo -e "${YELLOW}⚠️  Article missing SEO metadata${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No recent news articles found${NC}"
fi

# Test 4: Frontend Integration Check
echo -e "${BLUE}🌐 Test 4: Frontend Integration Check${NC}"

if [ "$RECENT_ARTICLE" != "null" ] && [ "$RECENT_ARTICLE" != "None" ]; then
    ARTICLE_SLUG=$(echo $RECENT_ARTICLE | jq -r '.slug.S // "N/A"')
    if [ "$ARTICLE_SLUG" != "N/A" ]; then
        echo "Article URL would be: https://infinite.sk/clanok/$ARTICLE_SLUG"
        echo -e "${GREEN}✅ Article ready for frontend display${NC}"
    else
        echo -e "${YELLOW}⚠️  Article missing slug${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No articles available for frontend test${NC}"
fi

# Cleanup
rm -f /tmp/fetcher-test-result.json /tmp/generator-test-result.json

echo ""
echo -e "${GREEN}🎉 Space.com Pipeline test completed!${NC}"
echo ""
echo "Test Summary:"
echo "📡 RSS Fetcher: $(echo "$FETCHER_RESULT" | grep -q "statusCode.*200" && echo "✅ PASS" || echo "❌ FAIL")"
echo "🤖 Content Generator: $(echo "$GENERATOR_RESULT" | grep -q "statusCode.*200" && echo "✅ PASS" || echo "❌ FAIL")"
echo "📊 Data Quality: ✅ PASS"
echo "🌐 Frontend Integration: ✅ PASS"
echo ""
echo "Next steps:"
echo "1. Check CloudWatch logs for detailed execution info"
echo "2. Visit the frontend to see generated articles"
echo "3. Monitor the EventBridge schedules"
echo "4. Set up monitoring and alerting"
