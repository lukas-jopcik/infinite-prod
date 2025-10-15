#!/bin/bash

# Delete all komunita articles and raw content from DynamoDB
# This script removes all existing komunita data to prepare for news category

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

echo -e "${GREEN}🗑️  Deleting komunita data from DynamoDB${NC}"
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

# Delete komunita articles
delete_items_from_table "$ARTICLES_TABLE" "category = :category" "komunita articles"

# Delete komunita raw content
delete_items_from_table "$RAW_CONTENT_TABLE" "source = :source" "komunita raw content"

echo ""
echo -e "${GREEN}🎉 Komunita data deletion completed!${NC}"
echo ""
echo "Summary:"
echo "✅ Deleted all komunita articles from $ARTICLES_TABLE"
echo "✅ Deleted all komunita raw content from $RAW_CONTENT_TABLE"
echo ""
echo "The database is now ready for the news category migration."
echo "You can now deploy the Space.com pipeline and start generating news articles."
