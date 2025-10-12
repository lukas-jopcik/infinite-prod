#!/bin/bash

# Deploy the meta descriptions update Lambda function
# This script packages and deploys the Lambda function to update existing articles with better meta descriptions

set -e

FUNCTION_NAME="update-meta-descriptions"
FUNCTION_DIR="update-meta-descriptions"
ZIP_FILE="${FUNCTION_NAME}.zip"

echo "🚀 Deploying meta descriptions update Lambda function..."

# Navigate to the function directory
cd "$FUNCTION_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create deployment package
echo "📦 Creating deployment package..."
zip -r "../${ZIP_FILE}" . -x "*.git*" "*.DS_Store*" "node_modules/.cache/*"

# Go back to parent directory
cd ..

# Deploy to AWS Lambda
echo "☁️ Deploying to AWS Lambda..."

# Check if function exists
if aws lambda get-function --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
    echo "📝 Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file "fileb://${ZIP_FILE}"
    
    # Update function configuration
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --description "Update existing articles with improved meta descriptions for better SEO" \
        --timeout 900 \
        --memory-size 512 \
        --environment Variables="{ENVIRONMENT=dev}"
else
    echo "🆕 Creating new Lambda function..."
    
    # Get the role ARN (you may need to adjust this)
    ROLE_ARN=$(aws iam get-role --role-name infinite-lambda-execution-role-dev --query 'Role.Arn' --output text 2>/dev/null || echo "")
    
    if [ -z "$ROLE_ARN" ]; then
        echo "❌ Error: Could not find infinite-lambda-execution-role-dev. Please create it first or update the script with the correct role ARN."
        exit 1
    fi
    
    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime nodejs18.x \
        --role "$ROLE_ARN" \
        --handler index.handler \
        --zip-file "fileb://${ZIP_FILE}" \
        --description "Update existing articles with improved meta descriptions for better SEO" \
        --timeout 900 \
        --memory-size 512 \
        --environment Variables="{ENVIRONMENT=dev}"
fi

# Clean up
echo "🧹 Cleaning up..."
rm -f "$ZIP_FILE"

echo "✅ Deployment completed!"
echo ""
echo "To run the function, use:"
echo "aws lambda invoke --function-name $FUNCTION_NAME --payload '{}' response.json"
echo ""
echo "To check the logs, use:"
echo "aws logs describe-log-groups --log-group-name-prefix /aws/lambda/$FUNCTION_NAME"
