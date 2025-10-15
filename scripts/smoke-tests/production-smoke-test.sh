#!/bin/bash

# Production Smoke Test Script
# Tests critical production functionality after deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/smoke-test-$(date +%Y%m%d-%H%M%S).log"
ENVIRONMENT="${ENVIRONMENT:-prod}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Test result tracking
test_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    case "$result" in
        "PASS")
            log_success "$test_name: $message"
            ((TESTS_PASSED++))
            ;;
        "FAIL")
            log_error "$test_name: $message"
            ((TESTS_FAILED++))
            ;;
        "WARN")
            log_warning "$test_name: $message"
            ((TESTS_WARNING++))
            ;;
    esac
}

# AWS CLI check
check_aws_cli() {
    log "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        test_result "AWS CLI" "FAIL" "AWS CLI not installed"
        return 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        test_result "AWS CLI" "FAIL" "AWS CLI not configured or credentials invalid"
        return 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local region=$(aws configure get region)
    
    test_result "AWS CLI" "PASS" "Connected to account $account_id in region $region"
    return 0
}

# Lambda function health check
check_lambda_functions() {
    log "Checking Lambda function health..."
    
    local functions=(
        "infinite-nasa-apod-$ENVIRONMENT-fetcher"
        "infinite-nasa-apod-$ENVIRONMENT-content-processor"
        "infinite-nasa-apod-$ENVIRONMENT-api-latest"
        "infinite-nasa-apod-$ENVIRONMENT-api-reprocess"
        "infinite-nasa-apod-$ENVIRONMENT-ai-content-generator"
    )
    
    for func in "${functions[@]}"; do
        if aws lambda get-function --function-name "$func" &> /dev/null; then
            local state=$(aws lambda get-function --function-name "$func" --query 'Configuration.State' --output text)
            if [ "$state" = "Active" ]; then
                test_result "Lambda $func" "PASS" "Function is active"
            else
                test_result "Lambda $func" "WARN" "Function state: $state"
            fi
        else
            test_result "Lambda $func" "FAIL" "Function not found"
        fi
    done
}

# DynamoDB table health check
check_dynamodb_tables() {
    log "Checking DynamoDB table health..."
    
    local tables=(
        "InfiniteRawContent-$ENVIRONMENT"
        "InfiniteArticles-$ENVIRONMENT"
    )
    
    for table in "${tables[@]}"; do
        if aws dynamodb describe-table --table-name "$table" &> /dev/null; then
            local status=$(aws dynamodb describe-table --table-name "$table" --query 'Table.TableStatus' --output text)
            if [ "$status" = "ACTIVE" ]; then
                test_result "DynamoDB $table" "PASS" "Table is active"
            else
                test_result "DynamoDB $table" "WARN" "Table status: $status"
            fi
        else
            test_result "DynamoDB $table" "FAIL" "Table not found"
        fi
    done
}

# S3 bucket health check
check_s3_bucket() {
    log "Checking S3 bucket health..."
    
    local bucket="infinite-nasa-apod-$ENVIRONMENT-images-349660737637"
    
    if aws s3 ls "s3://$bucket" &> /dev/null; then
        test_result "S3 Bucket" "PASS" "Bucket $bucket is accessible"
    else
        test_result "S3 Bucket" "FAIL" "Bucket $bucket not accessible"
    fi
}

# CloudFront distribution health check
check_cloudfront() {
    log "Checking CloudFront distribution health..."
    
    local distribution_id="E1234567890ABC"  # Replace with actual distribution ID
    
    if aws cloudfront get-distribution --id "$distribution_id" &> /dev/null; then
        local status=$(aws cloudfront get-distribution --id "$distribution_id" --query 'Distribution.Status' --output text)
        if [ "$status" = "Deployed" ]; then
            test_result "CloudFront" "PASS" "Distribution is deployed"
        else
            test_result "CloudFront" "WARN" "Distribution status: $status"
        fi
    else
        test_result "CloudFront" "FAIL" "Distribution not found"
    fi
}

# EventBridge rules health check
check_eventbridge_rules() {
    log "Checking EventBridge rules health..."
    
    local rules=(
        "infinite-nasa-apod-$ENVIRONMENT-daily-fetch"
        "infinite-nasa-apod-$ENVIRONMENT-weekly-ai-content"
        "infinite-nasa-apod-$ENVIRONMENT-esa-hubble-fetch"
    )
    
    for rule in "${rules[@]}"; do
        if aws events describe-rule --name "$rule" &> /dev/null; then
            local state=$(aws events describe-rule --name "$rule" --query 'State' --output text)
            if [ "$state" = "ENABLED" ]; then
                test_result "EventBridge $rule" "PASS" "Rule is enabled"
            else
                test_result "EventBridge $rule" "WARN" "Rule state: $state"
            fi
        else
            test_result "EventBridge $rule" "FAIL" "Rule not found"
        fi
    done
}

# API Gateway health check
check_api_gateway() {
    log "Checking API Gateway health..."
    
    local api_id="test-api-id"  # Replace with actual API ID
    
    if aws apigateway get-rest-api --rest-api-id "$api_id" &> /dev/null; then
        test_result "API Gateway" "PASS" "API Gateway is accessible"
    else
        test_result "API Gateway" "FAIL" "API Gateway not accessible"
    fi
}

# API endpoint health check
check_api_endpoints() {
    log "Checking API endpoint health..."
    
    local base_url="https://test.execute-api.eu-central-1.amazonaws.com/prod"  # Replace with actual URL
    
    # Test /api/latest endpoint
    if curl -s -f "$base_url/api/latest" &> /dev/null; then
        test_result "API /api/latest" "PASS" "Endpoint is responding"
    else
        test_result "API /api/latest" "FAIL" "Endpoint not responding"
    fi
    
    # Test /api/articles endpoint
    if curl -s -f "$base_url/api/articles" &> /dev/null; then
        test_result "API /api/articles" "PASS" "Endpoint is responding"
    else
        test_result "API /api/articles" "FAIL" "Endpoint not responding"
    fi
}

# Frontend health check
check_frontend() {
    log "Checking frontend health..."
    
    local frontend_url="https://infinite-nasa-apod-$ENVIRONMENT.amplifyapp.com"  # Replace with actual URL
    
    if curl -s -f "$frontend_url" &> /dev/null; then
        test_result "Frontend" "PASS" "Frontend is accessible"
    else
        test_result "Frontend" "FAIL" "Frontend not accessible"
    fi
}

# Recent data check
check_recent_data() {
    log "Checking for recent data..."
    
    local table="InfiniteRawContent-$ENVIRONMENT"
    local recent_count=$(aws dynamodb scan \
        --table-name "$table" \
        --filter-expression "createdAt > :date" \
        --expression-attribute-values '{":date":{"S":"'$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S.000Z)'"}}' \
        --select COUNT \
        --query 'Count' \
        --output text 2>/dev/null || echo "0")
    
    if [ "$recent_count" -gt 0 ]; then
        test_result "Recent Data" "PASS" "Found $recent_count recent records"
    else
        test_result "Recent Data" "WARN" "No recent data found"
    fi
}

# Lambda function performance check
check_lambda_performance() {
    log "Checking Lambda function performance..."
    
    local function_name="infinite-nasa-apod-$ENVIRONMENT-api-latest"
    
    # Test function invocation
    local start_time=$(date +%s%3N)
    local response=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload '{"httpMethod":"GET","path":"/api/latest"}' \
        --output text \
        /tmp/lambda-response.json 2>/dev/null || echo "ERROR")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if [ "$response" != "ERROR" ] && [ "$duration" -lt 5000 ]; then
        test_result "Lambda Performance" "PASS" "Function responded in ${duration}ms"
    elif [ "$response" != "ERROR" ]; then
        test_result "Lambda Performance" "WARN" "Function responded but slowly: ${duration}ms"
    else
        test_result "Lambda Performance" "FAIL" "Function invocation failed"
    fi
    
    # Clean up
    rm -f /tmp/lambda-response.json
}

# CloudWatch logs check
check_cloudwatch_logs() {
    log "Checking CloudWatch logs..."
    
    local log_group="/aws/lambda/infinite-nasa-apod-$ENVIRONMENT-fetcher"
    
    if aws logs describe-log-groups --log-group-name-prefix "$log_group" &> /dev/null; then
        test_result "CloudWatch Logs" "PASS" "Log group exists"
    else
        test_result "CloudWatch Logs" "WARN" "Log group not found"
    fi
}

# Secrets Manager check
check_secrets_manager() {
    log "Checking Secrets Manager..."
    
    local secrets=(
        "infinite/nasa-api-key-$ENVIRONMENT"
        "infinite/openai-api-key-$ENVIRONMENT"
    )
    
    for secret in "${secrets[@]}"; do
        if aws secretsmanager describe-secret --secret-id "$secret" &> /dev/null; then
            test_result "Secret $secret" "PASS" "Secret exists"
        else
            test_result "Secret $secret" "FAIL" "Secret not found"
        fi
    done
}

# Main smoke test function
run_smoke_tests() {
    log "Starting production smoke tests for environment: $ENVIRONMENT"
    log "Log file: $LOG_FILE"
    
    # Core infrastructure checks
    check_aws_cli
    check_lambda_functions
    check_dynamodb_tables
    check_s3_bucket
    check_cloudfront
    check_eventbridge_rules
    check_api_gateway
    
    # Application health checks
    check_api_endpoints
    check_frontend
    check_recent_data
    check_lambda_performance
    check_cloudwatch_logs
    check_secrets_manager
    
    # Summary
    log "Smoke test completed!"
    log "Results: $TESTS_PASSED passed, $TESTS_WARNING warnings, $TESTS_FAILED failed"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "All critical tests passed! Production is healthy."
        exit 0
    else
        log_error "Some tests failed! Please investigate the issues above."
        exit 1
    fi
}

# Help function
show_help() {
    echo "Production Smoke Test Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Set environment (default: prod)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT             Override environment setting"
    echo ""
    echo "Examples:"
    echo "  $0                      # Run smoke tests for production"
    echo "  $0 -e dev               # Run smoke tests for development"
    echo "  ENVIRONMENT=staging $0  # Run smoke tests for staging"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run smoke tests
run_smoke_tests
