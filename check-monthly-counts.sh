#!/bin/bash

echo "📊 Kontrola počtu článkov v DB podľa mesiacov"
echo "=============================================="
echo ""

# 2025 mesiace
for month in {01..10}; do
    count=$(aws dynamodb scan \
        --table-name InfiniteRawContent-dev \
        --filter-expression "begins_with(#date, :datePrefix)" \
        --expression-attribute-names '{"#date":"date"}' \
        --expression-attribute-values "{\":datePrefix\":{\"S\":\"2025-$month\"}}" \
        --select COUNT \
        --region eu-central-1 \
        --output json | jq -r '.Count')
    
    echo "2025-$month: $count článkov"
done

echo ""

# 2024 mesiace
for month in {01..12}; do
    count=$(aws dynamodb scan \
        --table-name InfiniteRawContent-dev \
        --filter-expression "begins_with(#date, :datePrefix)" \
        --expression-attribute-names '{"#date":"date"}' \
        --expression-attribute-values "{\":datePrefix\":{\"S\":\"2024-$month\"}}" \
        --select COUNT \
        --region eu-central-1 \
        --output json | jq -r '.Count')
    
    echo "2024-$month: $count článkov"
done

echo ""
echo "✅ Hotovo!"
