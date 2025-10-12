#!/bin/bash

echo "🚀 Starting bulk upload of all APOD batches..."
echo "📊 Total batches: 21"
echo ""

total_uploaded=0
total_failed=0
successful_batches=0
failed_batches=0

for i in {1..21}; do
    echo "📦 Uploading batch $i/21..."
    
    # Upload batch
    aws lambda invoke --function-name bulk-upload-apod --payload file://batch-$i.json response-$i.json
    
    # Check if upload was successful
    if [ $? -eq 0 ]; then
        # Parse response to get upload stats
        uploaded=$(cat response-$i.json | jq -r '.body | fromjson | .uploaded // 0')
        failed=$(cat response-$i.json | jq -r '.body | fromjson | .failed // 0')
        success_rate=$(cat response-$i.json | jq -r '.body | fromjson | .successRate // "0%"')
        
        total_uploaded=$((total_uploaded + uploaded))
        total_failed=$((total_failed + failed))
        
        if [ "$uploaded" -gt 0 ]; then
            successful_batches=$((successful_batches + 1))
            echo "✅ Batch $i: $uploaded uploaded, $failed failed ($success_rate)"
        else
            failed_batches=$((failed_batches + 1))
            echo "❌ Batch $i: All failed"
        fi
    else
        failed_batches=$((failed_batches + 1))
        echo "❌ Batch $i: Upload command failed"
    fi
    
    echo ""
    
    # Small delay between batches
    sleep 2
done

echo "🎉 Upload completed!"
echo "📊 Final Statistics:"
echo "- Total uploaded: $total_uploaded"
echo "- Total failed: $total_failed"
echo "- Successful batches: $successful_batches/21"
echo "- Failed batches: $failed_batches/21"

if [ $total_uploaded -gt 0 ]; then
    success_rate=$((total_uploaded * 100 / (total_uploaded + total_failed)))
    echo "- Overall success rate: $success_rate%"
fi

echo ""
echo "💰 Estimated cost: ~$$(echo "scale=4; $total_uploaded * 0.00000125" | bc)"
echo ""
echo "🔍 Check individual responses:"
echo "cat response-*.json | jq -r '.body | fromjson | .message, .uploaded, .failed, .successRate'"
