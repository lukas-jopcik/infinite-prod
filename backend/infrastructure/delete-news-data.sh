#!/bin/bash

# Delete all news articles and raw content from DynamoDB
# This script removes all existing news data to prepare for NASA RSS feed

set -e

# Configuration
REGION="eu-central-1"
ENVIRONMENT="dev"
ARTICLES_TABLE="InfiniteArticles-${ENVIRONMENT}"
RAW_CONTENT_TABLE="InfiniteRawContent-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗑️  Deleting news data from DynamoDB${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Function to delete items from table
delete_items_from_table() {
    local table_name=$1
    local filter_expression=$2
    local description=$3
    
    echo -e "${YELLOW}📊 Scanning $description...${NC}"
    
    # Get all items matching the filter
    local items=$(aws dynamodb scan \
        --table-name $table_name \
        --filter-expression "$filter_expression" \
        --projection-expression "articleId,type,contentId,source" \
        --region $REGION \
        --output json 2>/dev/null || echo '{"Items": []}')
    
    local item_count=$(echo $items | jq '.Items | length')
    
    if [ "$item_count" -eq 0 ]; then
        echo -e "${GREEN}✅ No $description found${NC}"
        return
    fi
    
    echo -e "${YELLOW}Found $item_count $description items${NC}"
    
    # Delete items in batches
    local batch_count=0
    echo $items | jq -r '.Items[] | @base64' | while read -r item; do
        local decoded_item=$(echo $item | base64 --decode)
        
        # Extract keys based on table
        if [ "$table_name" = "$ARTICLES_TABLE" ]; then
            local article_id=$(echo $decoded_item | jq -r '.articleId.S')
            local type=$(echo $decoded_item | jq -r '.type.S')
            
            if [ "$article_id" != "null" ] && [ "$type" != "null" ]; then
                aws dynamodb delete-item \
                    --table-name $table_name \
                    --key "{\"articleId\":{\"S\":\"$article_id\"},\"type\":{\"S\":\"$type\"}}" \
                    --region $REGION \
                    --output text > /dev/null
                
                batch_count=$((batch_count + 1))
                if [ $((batch_count % 10)) -eq 0 ]; then
                    echo -e "${YELLOW}Deleted $batch_count $description items...${NC}"
                fi
            fi
        else
            local content_id=$(echo $decoded_item | jq -r '.contentId.S')
            local source=$(echo $decoded_item | jq -r '.source.S')
            
            if [ "$content_id" != "null" ] && [ "$source" != "null" ]; then
                aws dynamodb delete-item \
                    --table-name $table_name \
                    --key "{\"contentId\":{\"S\":\"$content_id\"},\"source\":{\"S\":\"$source\"}}" \
                    --region $REGION \
                    --output text > /dev/null
                
                batch_count=$((batch_count + 1))
                if [ $((batch_count % 10)) -eq 0 ]; then
                    echo -e "${YELLOW}Deleted $batch_count $description items...${NC}"
                fi
            fi
        fi
    done
    
    echo -e "${GREEN}✅ Deleted all $description items${NC}"
}

# Delete news articles
echo -e "${YELLOW}Deleting news articles...${NC}"
delete_items_from_table "$ARTICLES_TABLE" "category = :category" "news articles"

# Delete space-com raw content
echo -e "${YELLOW}Deleting space-com raw content...${NC}"
delete_items_from_table "$RAW_CONTENT_TABLE" "source = :source" "space-com raw content"

echo -e "${GREEN}🎉 News data cleanup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo "  ✅ Deleted all news articles from InfiniteArticles table"
echo "  ✅ Deleted all space-com raw content from InfiniteRawContent table"
echo "  ✅ Ready for NASA RSS feed integration"
