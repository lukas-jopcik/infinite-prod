#!/bin/bash

# Setup EventBridge Schedule for Space.com RSS Pipeline
# This script creates EventBridge rules to trigger the Space.com fetcher every 3 hours

set -e

# Configuration
RULE_NAME_FETCHER="space-com-rss-fetcher-schedule"
RULE_NAME_GENERATOR="space-com-content-generator-schedule"
FUNCTION_NAME_FETCHER="space-com-fetcher"
FUNCTION_NAME_GENERATOR="space-com-content-generator"
REGION="eu-central-1"
ENVIRONMENT="dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}⏰ Setting up Space.com Pipeline EventBridge Schedules${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Get Lambda function ARNs
FETCHER_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME_FETCHER --query 'Configuration.FunctionArn' --output text --region $REGION 2>/dev/null || echo "")
GENERATOR_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME_GENERATOR --query 'Configuration.FunctionArn' --output text --region $REGION 2>/dev/null || echo "")

if [ -z "$FETCHER_ARN" ]; then
    echo -e "${RED}❌ Lambda function '$FUNCTION_NAME_FETCHER' not found.${NC}"
    echo "Please deploy the functions first using deploy-space-com-fetcher.sh"
    exit 1
fi

if [ -z "$GENERATOR_ARN" ]; then
    echo -e "${RED}❌ Lambda function '$FUNCTION_NAME_GENERATOR' not found.${NC}"
    echo "Please deploy the functions first using deploy-space-com-fetcher.sh"
    exit 1
fi

# Create EventBridge rule for RSS fetcher (every 3 hours)
echo -e "${YELLOW}📡 Creating EventBridge rule for RSS fetcher (every 3 hours)...${NC}"

aws events put-rule \
    --name $RULE_NAME_FETCHER \
    --description "Trigger Space.com RSS fetcher every 3 hours" \
    --schedule-expression "cron(0 */3 * * ? *)" \
    --state ENABLED \
    --region $REGION \
    2>/dev/null || {
    echo -e "${YELLOW}⚠️  Rule exists, updating...${NC}"
    aws events put-rule \
        --name $RULE_NAME_FETCHER \
        --description "Trigger Space.com RSS fetcher every 3 hours" \
        --schedule-expression "cron(0 */3 * * ? *)" \
        --state ENABLED \
        --region $REGION
}

# Add permission for EventBridge to invoke the fetcher Lambda
echo -e "${YELLOW}🔐 Adding EventBridge permission for RSS fetcher...${NC}"

aws lambda add-permission \
    --function-name $FUNCTION_NAME_FETCHER \
    --statement-id "space-com-fetcher-eventbridge-$(date +%s)" \
    --action "lambda:InvokeFunction" \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/$RULE_NAME_FETCHER" \
    --region $REGION \
    2>/dev/null || echo -e "${YELLOW}⚠️  Permission may already exist${NC}"

# Add target for the fetcher rule
echo -e "${YELLOW}🎯 Adding target for RSS fetcher rule...${NC}"

aws events put-targets \
    --rule $RULE_NAME_FETCHER \
    --targets "Id"="1","Arn"="$FETCHER_ARN" \
    --region $REGION

echo -e "${GREEN}✅ RSS fetcher schedule created successfully${NC}"

# Create EventBridge rule for content generator (every hour, but only processes if there's new content)
echo -e "${YELLOW}🤖 Creating EventBridge rule for content generator (every hour)...${NC}"

aws events put-rule \
    --name $RULE_NAME_GENERATOR \
    --description "Trigger Space.com content generator every hour" \
    --schedule-expression "cron(0 * * * ? *)" \
    --state ENABLED \
    --region $REGION \
    2>/dev/null || {
    echo -e "${YELLOW}⚠️  Rule exists, updating...${NC}"
    aws events put-rule \
        --name $RULE_NAME_GENERATOR \
        --description "Trigger Space.com content generator every hour" \
        --schedule-expression "cron(0 * * * ? *)" \
        --state ENABLED \
        --region $REGION
}

# Add permission for EventBridge to invoke the generator Lambda
echo -e "${YELLOW}🔐 Adding EventBridge permission for content generator...${NC}"

aws lambda add-permission \
    --function-name $FUNCTION_NAME_GENERATOR \
    --statement-id "space-com-generator-eventbridge-$(date +%s)" \
    --action "lambda:InvokeFunction" \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:$(aws sts get-caller-identity --query Account --output text):rule/$RULE_NAME_GENERATOR" \
    --region $REGION \
    2>/dev/null || echo -e "${YELLOW}⚠️  Permission may already exist${NC}"

# Add target for the generator rule
echo -e "${YELLOW}🎯 Adding target for content generator rule...${NC}"

aws events put-targets \
    --rule $RULE_NAME_GENERATOR \
    --targets "Id"="1","Arn"="$GENERATOR_ARN" \
    --region $REGION

echo -e "${GREEN}✅ Content generator schedule created successfully${NC}"

# Test the schedules
echo -e "${YELLOW}🧪 Testing EventBridge rules...${NC}"

# List rules to verify they exist
echo "EventBridge rules created:"
aws events list-rules \
    --name-prefix "space-com" \
    --region $REGION \
    --query 'Rules[*].[Name,State,ScheduleExpression]' \
    --output table

echo ""
echo -e "${GREEN}🎉 Space.com Pipeline scheduling setup completed!${NC}"
echo ""
echo "Schedule Summary:"
echo "📡 RSS Fetcher: Every 3 hours (cron: 0 */3 * * ? *)"
echo "🤖 Content Generator: Every hour (cron: 0 * * * ? *)"
echo ""
echo "Next steps:"
echo "1. Monitor CloudWatch logs to see the functions running"
echo "2. Check DynamoDB tables for new content"
echo "3. Verify articles appear on the frontend"
echo ""
echo "To manually trigger functions:"
echo "aws lambda invoke --function-name $FUNCTION_NAME_FETCHER --region $REGION /tmp/result.json"
echo "aws lambda invoke --function-name $FUNCTION_NAME_GENERATOR --region $REGION /tmp/result.json"
echo ""
echo "To disable schedules:"
echo "aws events disable-rule --name $RULE_NAME_FETCHER --region $REGION"
echo "aws events disable-rule --name $RULE_NAME_GENERATOR --region $REGION"
