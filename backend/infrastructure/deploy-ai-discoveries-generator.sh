#!/bin/bash

# Deploy AI Discoveries Generator Lambda function
# This script packages and deploys the AI discoveries generator to AWS Lambda

set -e

# Configuration
FUNCTION_NAME="ai-discoveries-generator"
ENVIRONMENT="dev"
REGION="eu-central-1"
PACKAGE_NAME="ai-discoveries-generator-deployment.zip"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying AI Discoveries Generator Lambda${NC}"
echo "Function Name: $FUNCTION_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Create deployment directory
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
DEPLOY_DIR="temp-deployment"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy function code
cp ../functions/scheduled/ai-discoveries-generator.js $DEPLOY_DIR/index.js

# Install dependencies
echo -e "${YELLOW}📥 Installing dependencies...${NC}"
cd $DEPLOY_DIR
npm init -y > /dev/null 2>&1
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-secrets-manager axios uuid@8.3.2 > /dev/null 2>&1

# Create deployment package
echo -e "${YELLOW}📦 Creating ZIP package...${NC}"
zip -r ../$PACKAGE_NAME . > /dev/null 2>&1
cd ..

# Clean up deployment directory
rm -rf $DEPLOY_DIR

# Check if function exists
echo -e "${YELLOW}🔍 Checking if function exists...${NC}"
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION > /dev/null 2>&1; then
    echo -e "${YELLOW}📝 Function exists, updating code...${NC}"
    
    # Update function code
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://$PACKAGE_NAME \
        --region $REGION \
        --output text > /dev/null
    
    # Update function configuration
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment Variables="{
            ENVIRONMENT=$ENVIRONMENT,
            REGION=$REGION,
            DYNAMODB_RAW_CONTENT_TABLE=InfiniteRawContent-$ENVIRONMENT,
            DYNAMODB_ARTICLES_TABLE=InfiniteArticles-$ENVIRONMENT,
            OPENAI_SECRET_ARN=arn:aws:secretsmanager:$REGION:349660737637:secret:infinite/openai-api-key
        }" \
        --timeout 300 \
        --memory-size 1024 \
        --region $REGION \
        --output text > /dev/null
    
    echo -e "${GREEN}✅ Function updated successfully${NC}"
else
    echo -e "${YELLOW}🆕 Function doesn't exist, creating new function...${NC}"
    
    # Get execution role ARN
    ROLE_ARN=$(aws iam get-role --role-name infinite-lambda-execution-role-$ENVIRONMENT --query 'Role.Arn' --output text 2>/dev/null || echo "")
    
    if [ -z "$ROLE_ARN" ]; then
        echo -e "${RED}❌ Lambda execution role not found. Please create 'infinite-lambda-execution-role-$ENVIRONMENT' first.${NC}"
        exit 1
    fi
    
    # Create function
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://$PACKAGE_NAME \
        --environment Variables="{
            ENVIRONMENT=$ENVIRONMENT,
            REGION=$REGION,
            DYNAMODB_RAW_CONTENT_TABLE=InfiniteRawContent-$ENVIRONMENT,
            DYNAMODB_ARTICLES_TABLE=InfiniteArticles-$ENVIRONMENT,
            OPENAI_SECRET_ARN=arn:aws:secretsmanager:$REGION:349660737637:secret:infinite/openai-api-key
        }" \
        --timeout 300 \
        --memory-size 1024 \
        --region $REGION \
        --output text > /dev/null
    
    echo -e "${GREEN}✅ Function created successfully${NC}"
fi

# Set up EventBridge rule for 2-hour execution
echo -e "${YELLOW}⏰ Setting up 2-hour execution schedule...${NC}"

RULE_NAME="ai-discoveries-generator-2hours-$ENVIRONMENT"
RULE_ARN="arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/$RULE_NAME"

# Create or update EventBridge rule
aws events put-rule \
    --name $RULE_NAME \
    --schedule-expression "cron(0 */2 * * ? *)" \
    --description "Every 2 hours execution of AI Discoveries Generator" \
    --region $REGION \
    --output text > /dev/null

# Add Lambda permission for EventBridge
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id "allow-eventbridge-$RULE_NAME" \
    --action "lambda:InvokeFunction" \
    --principal events.amazonaws.com \
    --source-arn $RULE_ARN \
    --region $REGION \
    --output text > /dev/null 2>&1 || true

# Add EventBridge target
aws events put-targets \
    --rule $RULE_NAME \
    --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$FUNCTION_NAME" \
    --region $REGION \
    --output text > /dev/null

echo -e "${GREEN}✅ EventBridge rule configured${NC}"

# Test the function
echo -e "${YELLOW}🧪 Testing function...${NC}"
aws lambda invoke \
    --function-name $FUNCTION_NAME \
    --payload '{}' \
    --region $REGION \
    --output text \
    response.json > /dev/null

if [ -f response.json ]; then
    echo -e "${GREEN}✅ Function test completed${NC}"
    echo -e "${YELLOW}Response:${NC}"
    cat response.json | jq '.' 2>/dev/null || cat response.json
    rm -f response.json
else
    echo -e "${RED}❌ Function test failed${NC}"
fi

# Clean up
rm -f $PACKAGE_NAME

echo -e "${GREEN}🎉 AI Discoveries Generator deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo "  ✅ Function: $FUNCTION_NAME"
echo "  ✅ Environment: $ENVIRONMENT"
echo "  ✅ Region: $REGION"
echo "  ✅ Schedule: Every 2 hours (cron(0 */2 * * ? *))"
echo "  ✅ Memory: 1024 MB"
echo "  ✅ Timeout: 5 minutes"
echo ""
echo -e "${YELLOW}🔗 Next steps:${NC}"
echo "  1. Monitor CloudWatch logs for execution results"
echo "  2. Test the complete pipeline"
echo "  3. Verify articles appear in frontend"
echo "  4. Check DynamoDB for processed ideas"
