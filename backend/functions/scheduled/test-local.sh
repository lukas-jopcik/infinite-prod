#!/bin/bash

# Local Testing Script for AI-Generated Space Articles
# This script sets up and runs local tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 AI-Generated Space Articles - Local Testing${NC}"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "test-ai-discoveries-local.js" ]; then
    echo -e "${RED}❌ Please run this script from the backend/functions/scheduled directory${NC}"
    exit 1
fi

# Check if AWS CLI is configured
echo -e "${YELLOW}🔍 Checking AWS CLI configuration...${NC}"
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    echo "You need AWS credentials to access DynamoDB tables."
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI configured${NC}"

# Check if Node.js is available
echo -e "${YELLOW}🔍 Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js available${NC}"

# Install dependencies if needed
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Check if DynamoDB tables exist
echo -e "${YELLOW}🔍 Checking DynamoDB tables...${NC}"

RAW_TABLE="InfiniteRawContent-dev"
ARTICLES_TABLE="InfiniteArticles-dev"

if ! aws dynamodb describe-table --table-name $RAW_TABLE --region eu-central-1 > /dev/null 2>&1; then
    echo -e "${RED}❌ DynamoDB table $RAW_TABLE not found.${NC}"
    echo "Please make sure the table exists in eu-central-1 region."
    exit 1
fi

if ! aws dynamodb describe-table --table-name $ARTICLES_TABLE --region eu-central-1 > /dev/null 2>&1; then
    echo -e "${RED}❌ DynamoDB table $ARTICLES_TABLE not found.${NC}"
    echo "Please make sure the table exists in eu-central-1 region."
    exit 1
fi

echo -e "${GREEN}✅ DynamoDB tables found${NC}"

# Run the test
echo -e "${YELLOW}🚀 Running local test...${NC}"
echo ""

node test-ai-discoveries-local.js

echo ""
echo -e "${GREEN}🎉 Local testing completed!${NC}"
echo ""
echo -e "${BLUE}📋 What was tested:${NC}"
echo "  ✅ Mock idea generation"
echo "  ✅ DynamoDB storage (InfiniteRawContent-dev)"
echo "  ✅ Mock article generation"
echo "  ✅ DynamoDB storage (InfiniteArticles-dev)"
echo "  ✅ Status updates"
echo ""
echo -e "${BLUE}🔗 Next steps:${NC}"
echo "  1. Check frontend at http://localhost:3000/kategoria/vesmirne-objavy"
echo "  2. Verify articles appear in the category page"
echo "  3. Test individual article pages"
echo "  4. Check navigation and SEO metadata"
echo ""
echo -e "${YELLOW}💡 Note: This test uses mock data. For real testing with OpenAI,${NC}"
echo -e "${YELLOW}   set the OPENAI_API_KEY environment variable.${NC}"
