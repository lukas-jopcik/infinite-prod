#!/bin/bash

# Setup AI Discoveries Pipeline - Complete EventBridge Configuration
# This script configures both EventBridge rules for the AI discoveries pipeline

set -e

# Configuration
ENVIRONMENT="dev"
REGION="eu-central-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up AI Discoveries Pipeline EventBridge Rules${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

# Function names
IDEA_GENERATOR_FUNCTION="ai-idea-generator"
DISCOVERIES_GENERATOR_FUNCTION="ai-discoveries-generator"

# Check if Lambda functions exist
echo -e "${YELLOW}🔍 Checking Lambda functions...${NC}"

if ! aws lambda get-function --function-name $IDEA_GENERATOR_FUNCTION --region $REGION > /dev/null 2>&1; then
    echo -e "${RED}❌ AI Idea Generator function not found. Please deploy it first.${NC}"
    exit 1
fi

if ! aws lambda get-function --function-name $DISCOVERIES_GENERATOR_FUNCTION --region $REGION > /dev/null 2>&1; then
    echo -e "${RED}❌ AI Discoveries Generator function not found. Please deploy it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Both Lambda functions found${NC}"

# 1. Setup AI Idea Generator Daily Rule
echo -e "${YELLOW}⏰ Setting up AI Idea Generator daily rule...${NC}"

IDEA_RULE_NAME="ai-idea-generator-daily-$ENVIRONMENT"
IDEA_RULE_ARN="arn:aws:events:$REGION:$ACCOUNT_ID:rule/$IDEA_RULE_NAME"

# Create EventBridge rule
aws events put-rule \
    --name $IDEA_RULE_NAME \
    --schedule-expression "cron(0 0 * * ? *)" \
    --description "Daily execution of AI Idea Generator at midnight UTC" \
    --state "ENABLED" \
    --region $REGION \
    --output text > /dev/null

# Add Lambda permission
aws lambda add-permission \
    --function-name $IDEA_GENERATOR_FUNCTION \
    --statement-id "allow-eventbridge-$IDEA_RULE_NAME" \
    --action "lambda:InvokeFunction" \
    --principal events.amazonaws.com \
    --source-arn $IDEA_RULE_ARN \
    --region $REGION \
    --output text > /dev/null 2>&1 || true

# Add target
aws events put-targets \
    --rule $IDEA_RULE_NAME \
    --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$IDEA_GENERATOR_FUNCTION" \
    --region $REGION \
    --output text > /dev/null

echo -e "${GREEN}✅ AI Idea Generator rule configured${NC}"

# 2. Setup AI Discoveries Generator 2-Hour Rule
echo -e "${YELLOW}⏰ Setting up AI Discoveries Generator 2-hour rule...${NC}"

DISCOVERIES_RULE_NAME="ai-discoveries-generator-2hours-$ENVIRONMENT"
DISCOVERIES_RULE_ARN="arn:aws:events:$REGION:$ACCOUNT_ID:rule/$DISCOVERIES_RULE_NAME"

# Create EventBridge rule
aws events put-rule \
    --name $DISCOVERIES_RULE_NAME \
    --schedule-expression "cron(0 */2 * * ? *)" \
    --description "Every 2 hours execution of AI Discoveries Generator" \
    --state "ENABLED" \
    --region $REGION \
    --output text > /dev/null

# Add Lambda permission
aws lambda add-permission \
    --function-name $DISCOVERIES_GENERATOR_FUNCTION \
    --statement-id "allow-eventbridge-$DISCOVERIES_RULE_NAME" \
    --action "lambda:InvokeFunction" \
    --principal events.amazonaws.com \
    --source-arn $DISCOVERIES_RULE_ARN \
    --region $REGION \
    --output text > /dev/null 2>&1 || true

# Add target
aws events put-targets \
    --rule $DISCOVERIES_RULE_NAME \
    --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$DISCOVERIES_GENERATOR_FUNCTION" \
    --region $REGION \
    --output text > /dev/null

echo -e "${GREEN}✅ AI Discoveries Generator rule configured${NC}"

# 3. Verify rules
echo -e "${YELLOW}🔍 Verifying EventBridge rules...${NC}"

echo "AI Idea Generator Rule:"
aws events describe-rule \
    --name $IDEA_RULE_NAME \
    --region $REGION \
    --query "{Name:Name,ScheduleExpression:ScheduleExpression,State:State,Description:Description}" \
    --output table

echo ""
echo "AI Discoveries Generator Rule:"
aws events describe-rule \
    --name $DISCOVERIES_RULE_NAME \
    --region $REGION \
    --query "{Name:Name,ScheduleExpression:ScheduleExpression,State:State,Description:Description}" \
    --output table

echo ""
echo -e "${GREEN}🎉 AI Discoveries Pipeline EventBridge setup completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo "  ✅ AI Idea Generator: Daily at 00:00 UTC (midnight)"
echo "  ✅ AI Discoveries Generator: Every 2 hours"
echo "  ✅ Both rules are ENABLED"
echo "  ✅ Lambda permissions configured"
echo "  ✅ Targets set correctly"
echo ""
echo -e "${YELLOW}🔄 Pipeline Flow:${NC}"
echo "  1. Daily at midnight: AI Idea Generator creates 5 ideas"
echo "  2. Every 2 hours: AI Discoveries Generator processes 1 idea"
echo "  3. Result: 12 articles per day (every 2 hours)"
echo ""
echo -e "${YELLOW}🔗 Next steps:${NC}"
echo "  1. Test the pipeline manually"
echo "  2. Monitor CloudWatch logs"
echo "  3. Verify articles appear in frontend"
echo "  4. Check DynamoDB for data flow"
