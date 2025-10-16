#!/bin/bash

# Delete old NASA news articles, keeping only the most recent one
# This script removes all NASA news articles except the one we just created

set -e

ENVIRONMENT="dev"
REGION="eu-central-1"
TABLE_NAME="InfiniteArticles-$ENVIRONMENT"
KEEP_ARTICLE_ID="06dd3f12-3c54-4b8b-b3b5-d4921d4376cb"

echo "🗑️  Deleting old NASA news articles (keeping most recent one)..."

# Get all NASA news articles
echo "📋 Scanning for NASA news articles..."
NASA_ARTICLES=$(aws dynamodb scan \
    --table-name $TABLE_NAME \
    --region $REGION \
    --filter-expression "#source = :source" \
    --expression-attribute-names '{"#source":"source"}' \
    --expression-attribute-values '{":source":{"S":"nasa-news"}}' \
    --query 'Items[*].{articleId:articleId.S,type:type.S,title:title.S}' \
    --output json)

echo "Found NASA articles:"
echo "$NASA_ARTICLES" | jq -r '.[] | "\(.articleId) (\(.type)): \(.title)"'

# Count total articles
TOTAL_COUNT=$(echo "$NASA_ARTICLES" | jq '. | length')
echo "📊 Total NASA articles found: $TOTAL_COUNT"

if [ "$TOTAL_COUNT" -eq 0 ]; then
    echo "✅ No NASA articles found to delete."
    exit 0
fi

# Check if the article we want to keep exists
KEEP_EXISTS=$(echo "$NASA_ARTICLES" | jq -r --arg keep_id "$KEEP_ARTICLE_ID" '.[] | select(.articleId == $keep_id) | .articleId')
if [ -z "$KEEP_EXISTS" ]; then
    echo "⚠️  Warning: Article to keep ($KEEP_ARTICLE_ID) not found in the list!"
    echo "This might be because it was already deleted or has a different ID."
    read -p "Continue with deletion? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deletion cancelled."
        exit 1
    fi
fi

# Delete articles (excluding the one we want to keep)
DELETED_COUNT=0
echo "$NASA_ARTICLES" | jq -r --arg keep_id "$KEEP_ARTICLE_ID" '.[] | select(.articleId != $keep_id) | "\(.articleId)|\(.type)"' | while IFS='|' read -r article_id type; do
    if [ -n "$article_id" ] && [ -n "$type" ]; then
        echo "🗑️  Deleting article: $article_id (type: $type)"
        
        # Delete from DynamoDB
        aws dynamodb delete-item \
            --table-name $TABLE_NAME \
            --region $REGION \
            --key "{\"articleId\":{\"S\":\"$article_id\"},\"type\":{\"S\":\"$type\"}}" \
            --output text > /dev/null
        
        echo "✅ Deleted: $article_id"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done

echo "🎉 Cleanup completed!"
echo "📊 Articles deleted: $DELETED_COUNT"
echo "✅ Kept article: $KEEP_ARTICLE_ID"

# Verify the remaining article
echo "🔍 Verifying remaining article..."
REMAINING=$(aws dynamodb scan \
    --table-name $TABLE_NAME \
    --region $REGION \
    --filter-expression "#source = :source" \
    --expression-attribute-names '{"#source":"source"}' \
    --expression-attribute-values '{":source":{"S":"nasa-news"}}' \
    --query 'Items[*].{articleId:articleId.S,title:title.S}' \
    --output json)

REMAINING_COUNT=$(echo "$REMAINING" | jq '. | length')
echo "📊 Remaining NASA articles: $REMAINING_COUNT"

if [ "$REMAINING_COUNT" -eq 1 ]; then
    echo "✅ Perfect! Only one NASA article remains:"
    echo "$REMAINING" | jq -r '.[] | "\(.articleId): \(.title)"'
else
    echo "⚠️  Warning: Expected 1 article, but found $REMAINING_COUNT"
    echo "$REMAINING" | jq -r '.[] | "\(.articleId): \(.title)"'
fi

echo "🎯 Database cleanup completed successfully!"
