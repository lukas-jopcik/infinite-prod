#!/bin/bash

# Deployment Verification Script
# Verifies that a deployment was successful by testing key functionality

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/deployment-verification-$(date +%Y%m%d-%H%M%S).log"
ENVIRONMENT="${ENVIRONMENT:-prod}"
DEPLOYMENT_ID="${DEPLOYMENT_ID:-$(date +%Y%m%d-%H%M%S)}"

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

# Verify Lambda function deployment
verify_lambda_deployment() {
    log "Verifying Lambda function deployment..."
    
    local functions=(
        "infinite-nasa-apod-$ENVIRONMENT-fetcher"
        "infinite-nasa-apod-$ENVIRONMENT-content-processor"
        "infinite-nasa-apod-$ENVIRONMENT-api-latest"
        "infinite-nasa-apod-$ENVIRONMENT-api-reprocess"
        "infinite-nasa-apod-$ENVIRONMENT-ai-content-generator"
    )
    
    for func in "${functions[@]}"; do
        if aws lambda get-function --function-name "$func" &> /dev/null; then
            local last_modified=$(aws lambda get-function --function-name "$func" --query 'Configuration.LastModified' --output text)
            local version=$(aws lambda get-function --function-name "$func" --query 'Configuration.Version' --output text)
            local code_sha256=$(aws lambda get-function --function-name "$func" --query 'Configuration.CodeSha256' --output text)
            
            test_result "Lambda $func" "PASS" "Deployed (Version: $version, SHA256: ${code_sha256:0:8}..., Modified: $last_modified)"
        else
            test_result "Lambda $func" "FAIL" "Function not found"
        fi
    done
}

# Verify API Gateway deployment
verify_api_gateway_deployment() {
    log "Verifying API Gateway deployment..."
    
    local api_id="test-api-id"  # Replace with actual API ID
    
    if aws apigateway get-rest-api --rest-api-id "$api_id" &> /dev/null; then
        local created_date=$(aws apigateway get-rest-api --rest-api-id "$api_id" --query 'createdDate' --output text)
        local name=$(aws apigateway get-rest-api --rest-api-id "$api_id" --query 'name' --output text)
        
        test_result "API Gateway" "PASS" "Deployed (Name: $name, Created: $created_date)"
    else
        test_result "API Gateway" "FAIL" "API Gateway not found"
    fi
}

# Verify CloudFront deployment
verify_cloudfront_deployment() {
    log "Verifying CloudFront deployment..."
    
    local distribution_id="E1234567890ABC"  # Replace with actual distribution ID
    
    if aws cloudfront get-distribution --id "$distribution_id" &> /dev/null; then
        local status=$(aws cloudfront get-distribution --id "$distribution_id" --query 'Distribution.Status' --output text)
        local domain_name=$(aws cloudfront get-distribution --id "$distribution_id" --query 'Distribution.DomainName' --output text)
        local last_modified=$(aws cloudfront get-distribution --id "$distribution_id" --query 'Distribution.LastModifiedTime' --output text)
        
        if [ "$status" = "Deployed" ]; then
            test_result "CloudFront" "PASS" "Deployed (Domain: $domain_name, Status: $status, Modified: $last_modified)"
        else
            test_result "CloudFront" "WARN" "Status: $status (Domain: $domain_name, Modified: $last_modified)"
        fi
    else
        test_result "CloudFront" "FAIL" "Distribution not found"
    fi
}

# Verify frontend deployment
verify_frontend_deployment() {
    log "Verifying frontend deployment..."
    
    local frontend_url="https://infinite-nasa-apod-$ENVIRONMENT.amplifyapp.com"  # Replace with actual URL
    
    # Check if frontend is accessible
    if curl -s -f "$frontend_url" &> /dev/null; then
        # Check for specific deployment markers
        local response=$(curl -s "$frontend_url")
        if echo "$response" | grep -q "infinite-nasa-apod"; then
            test_result "Frontend" "PASS" "Deployed and accessible at $frontend_url"
        else
            test_result "Frontend" "WARN" "Accessible but content verification failed"
        fi
    else
        test_result "Frontend" "FAIL" "Not accessible at $frontend_url"
    fi
}

# Verify database schema
verify_database_schema() {
    log "Verifying database schema..."
    
    local tables=(
        "InfiniteRawContent-$ENVIRONMENT"
        "InfiniteArticles-$ENVIRONMENT"
    )
    
    for table in "${tables[@]}"; do
        if aws dynamodb describe-table --table-name "$table" &> /dev/null; then
            local status=$(aws dynamodb describe-table --table-name "$table" --query 'Table.TableStatus' --output text)
            local item_count=$(aws dynamodb describe-table --table-name "$table" --query 'Table.ItemCount' --output text)
            local creation_date=$(aws dynamodb describe-table --table-name "$table" --query 'Table.CreationDateTime' --output text)
            
            if [ "$status" = "ACTIVE" ]; then
                test_result "DynamoDB $table" "PASS" "Active (Items: $item_count, Created: $creation_date)"
            else
                test_result "DynamoDB $table" "WARN" "Status: $status (Items: $item_count, Created: $creation_date)"
            fi
        else
            test_result "DynamoDB $table" "FAIL" "Table not found"
        fi
    done
}

# Verify environment variables
verify_environment_variables() {
    log "Verifying environment variables..."
    
    local function_name="infinite-nasa-apod-$ENVIRONMENT-fetcher"
    
    if aws lambda get-function --function-name "$function_name" &> /dev/null; then
        local env_vars=$(aws lambda get-function --function-name "$function_name" --query 'Configuration.Environment.Variables' --output json)
        
        # Check for required environment variables
        local required_vars=(
            "REGION"
            "ENVIRONMENT"
            "DYNAMODB_RAW_CONTENT_TABLE"
            "DYNAMODB_ARTICLES_TABLE"
            "NASA_SECRET_ARN"
            "S3_BUCKET_NAME"
            "CLOUDFRONT_DOMAIN"
        )
        
        local missing_vars=()
        for var in "${required_vars[@]}"; do
            if ! echo "$env_vars" | jq -e ".$var" &> /dev/null; then
                missing_vars+=("$var")
            fi
        done
        
        if [ ${#missing_vars[@]} -eq 0 ]; then
            test_result "Environment Variables" "PASS" "All required variables present"
        else
            test_result "Environment Variables" "FAIL" "Missing variables: ${missing_vars[*]}"
        fi
    else
        test_result "Environment Variables" "FAIL" "Cannot verify - function not found"
    fi
}

# Verify secrets configuration
verify_secrets_configuration() {
    log "Verifying secrets configuration..."
    
    local secrets=(
        "infinite/nasa-api-key-$ENVIRONMENT"
        "infinite/openai-api-key-$ENVIRONMENT"
    )
    
    for secret in "${secrets[@]}"; do
        if aws secretsmanager describe-secret --secret-id "$secret" &> /dev/null; then
            local status=$(aws secretsmanager describe-secret --secret-id "$secret" --query 'SecretStatus' --output text)
            local last_changed=$(aws secretsmanager describe-secret --secret-id "$secret" --query 'LastChangedDate' --output text)
            
            if [ "$status" = "Active" ]; then
                test_result "Secret $secret" "PASS" "Active (Last changed: $last_changed)"
            else
                test_result "Secret $secret" "WARN" "Status: $status (Last changed: $last_changed)"
            fi
        else
            test_result "Secret $secret" "FAIL" "Secret not found"
        fi
    done
}

# Verify IAM roles and policies
verify_iam_configuration() {
    log "Verifying IAM configuration..."
    
    local roles=(
        "infinite-nasa-apod-$ENVIRONMENT-fetcher-role"
        "infinite-nasa-apod-$ENVIRONMENT-content-processor-role"
        "infinite-nasa-apod-$ENVIRONMENT-api-latest-role"
    )
    
    for role in "${roles[@]}"; do
        if aws iam get-role --role-name "$role" &> /dev/null; then
            local create_date=$(aws iam get-role --role-name "$role" --query 'Role.CreateDate' --output text)
            local assume_role_policy=$(aws iam get-role --role-name "$role" --query 'Role.AssumeRolePolicyDocument' --output json)
            
            if echo "$assume_role_policy" | jq -e '.Statement[0].Principal.Service' | grep -q "lambda.amazonaws.com"; then
                test_result "IAM Role $role" "PASS" "Active (Created: $create_date)"
            else
                test_result "IAM Role $role" "WARN" "Invalid assume role policy"
            fi
        else
            test_result "IAM Role $role" "FAIL" "Role not found"
        fi
    done
}

# Verify EventBridge configuration
verify_eventbridge_configuration() {
    log "Verifying EventBridge configuration..."
    
    local rules=(
        "infinite-nasa-apod-$ENVIRONMENT-daily-fetch"
        "infinite-nasa-apod-$ENVIRONMENT-weekly-ai-content"
        "infinite-nasa-apod-$ENVIRONMENT-esa-hubble-fetch"
    )
    
    for rule in "${rules[@]}"; do
        if aws events describe-rule --name "$rule" &> /dev/null; then
            local state=$(aws events describe-rule --name "$rule" --query 'State' --output text)
            local schedule=$(aws events describe-rule --name "$rule" --query 'ScheduleExpression' --output text)
            local created_date=$(aws events describe-rule --name "$rule" --query 'CreatedBy' --output text)
            
            if [ "$state" = "ENABLED" ]; then
                test_result "EventBridge $rule" "PASS" "Enabled (Schedule: $schedule)"
            else
                test_result "EventBridge $rule" "WARN" "State: $state (Schedule: $schedule)"
            fi
        else
            test_result "EventBridge $rule" "FAIL" "Rule not found"
        fi
    done
}

# Verify API endpoints functionality
verify_api_endpoints() {
    log "Verifying API endpoints functionality..."
    
    local base_url="https://test.execute-api.eu-central-1.amazonaws.com/prod"  # Replace with actual URL
    
    # Test /api/latest endpoint
    local response=$(curl -s -w "%{http_code}" "$base_url/api/latest" -o /tmp/api-response.json)
    if [ "$response" = "200" ]; then
        local content=$(cat /tmp/api-response.json)
        if echo "$content" | jq -e '.articles' &> /dev/null; then
            test_result "API /api/latest" "PASS" "Endpoint responding with valid JSON"
        else
            test_result "API /api/latest" "WARN" "Endpoint responding but invalid JSON"
        fi
    else
        test_result "API /api/latest" "FAIL" "HTTP $response"
    fi
    
    # Test /api/articles endpoint
    local response=$(curl -s -w "%{http_code}" "$base_url/api/articles" -o /tmp/api-response.json)
    if [ "$response" = "200" ]; then
        local content=$(cat /tmp/api-response.json)
        if echo "$content" | jq -e '.articles' &> /dev/null; then
            test_result "API /api/articles" "PASS" "Endpoint responding with valid JSON"
        else
            test_result "API /api/articles" "WARN" "Endpoint responding but invalid JSON"
        fi
    else
        test_result "API /api/articles" "FAIL" "HTTP $response"
    fi
    
    # Clean up
    rm -f /tmp/api-response.json
}

# Verify Lambda function functionality
verify_lambda_functionality() {
    log "Verifying Lambda function functionality..."
    
    local function_name="infinite-nasa-apod-$ENVIRONMENT-api-latest"
    
    # Test function invocation
    local response=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload '{"httpMethod":"GET","path":"/api/latest","queryStringParameters":{"limit":"5"}}' \
        --output text \
        /tmp/lambda-response.json 2>/dev/null || echo "ERROR")
    
    if [ "$response" != "ERROR" ]; then
        local content=$(cat /tmp/lambda-response.json)
        if echo "$content" | jq -e '.statusCode' &> /dev/null; then
            local status_code=$(echo "$content" | jq -r '.statusCode')
            if [ "$status_code" = "200" ]; then
                test_result "Lambda Functionality" "PASS" "Function responding correctly"
            else
                test_result "Lambda Functionality" "WARN" "Function responding but status: $status_code"
            fi
        else
            test_result "Lambda Functionality" "WARN" "Function responding but invalid response format"
        fi
    else
        test_result "Lambda Functionality" "FAIL" "Function invocation failed"
    fi
    
    # Clean up
    rm -f /tmp/lambda-response.json
}

# Verify data flow
verify_data_flow() {
    log "Verifying data flow..."
    
    local raw_table="InfiniteRawContent-$ENVIRONMENT"
    local articles_table="InfiniteArticles-$ENVIRONMENT"
    
    # Check if there's data in raw content table
    local raw_count=$(aws dynamodb scan --table-name "$raw_table" --select COUNT --query 'Count' --output text 2>/dev/null || echo "0")
    
    # Check if there's data in articles table
    local articles_count=$(aws dynamodb scan --table-name "$articles_table" --select COUNT --query 'Count' --output text 2>/dev/null || echo "0")
    
    if [ "$raw_count" -gt 0 ] && [ "$articles_count" -gt 0 ]; then
        test_result "Data Flow" "PASS" "Data present in both tables (Raw: $raw_count, Articles: $articles_count)"
    elif [ "$raw_count" -gt 0 ]; then
        test_result "Data Flow" "WARN" "Data in raw table but not in articles table (Raw: $raw_count, Articles: $articles_count)"
    else
        test_result "Data Flow" "WARN" "No data found in tables (Raw: $raw_count, Articles: $articles_count)"
    fi
}

# Verify monitoring and logging
verify_monitoring() {
    log "Verifying monitoring and logging..."
    
    local log_groups=(
        "/aws/lambda/infinite-nasa-apod-$ENVIRONMENT-fetcher"
        "/aws/lambda/infinite-nasa-apod-$ENVIRONMENT-content-processor"
        "/aws/lambda/infinite-nasa-apod-$ENVIRONMENT-api-latest"
    )
    
    for log_group in "${log_groups[@]}"; do
        if aws logs describe-log-groups --log-group-name-prefix "$log_group" &> /dev/null; then
            local retention=$(aws logs describe-log-groups --log-group-name-prefix "$log_group" --query 'logGroups[0].retentionInDays' --output text)
            test_result "Log Group $log_group" "PASS" "Exists (Retention: $retention days)"
        else
            test_result "Log Group $log_group" "FAIL" "Not found"
        fi
    done
}

# Generate deployment report
generate_deployment_report() {
    log "Generating deployment report..."
    
    local report_file="$PROJECT_ROOT/logs/deployment-report-$DEPLOYMENT_ID.md"
    
    cat > "$report_file" << EOF
# Deployment Verification Report

**Deployment ID:** $DEPLOYMENT_ID  
**Environment:** $ENVIRONMENT  
**Date:** $(date)  
**Log File:** $LOG_FILE  

## Summary

- **Tests Passed:** $TESTS_PASSED
- **Tests Failed:** $TESTS_FAILED
- **Tests Warning:** $TESTS_WARNING
- **Total Tests:** $((TESTS_PASSED + TESTS_FAILED + TESTS_WARNING))

## Test Results

EOF

    # Append test results from log file
    grep -E "✅|❌|⚠️" "$LOG_FILE" >> "$report_file"
    
    cat >> "$report_file" << EOF

## Recommendations

EOF

    if [ $TESTS_FAILED -gt 0 ]; then
        echo "- **CRITICAL:** Address failed tests before considering deployment successful" >> "$report_file"
    fi
    
    if [ $TESTS_WARNING -gt 0 ]; then
        echo "- **WARNING:** Review warning tests for potential issues" >> "$report_file"
    fi
    
    if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_WARNING -eq 0 ]; then
        echo "- **SUCCESS:** All tests passed! Deployment is successful." >> "$report_file"
    fi
    
    log "Deployment report generated: $report_file"
}

# Main verification function
run_deployment_verification() {
    log "Starting deployment verification for environment: $ENVIRONMENT"
    log "Deployment ID: $DEPLOYMENT_ID"
    log "Log file: $LOG_FILE"
    
    # Infrastructure verification
    verify_lambda_deployment
    verify_api_gateway_deployment
    verify_cloudfront_deployment
    verify_frontend_deployment
    verify_database_schema
    verify_environment_variables
    verify_secrets_configuration
    verify_iam_configuration
    verify_eventbridge_configuration
    
    # Functionality verification
    verify_api_endpoints
    verify_lambda_functionality
    verify_data_flow
    verify_monitoring
    
    # Generate report
    generate_deployment_report
    
    # Summary
    log "Deployment verification completed!"
    log "Results: $TESTS_PASSED passed, $TESTS_WARNING warnings, $TESTS_FAILED failed"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "Deployment verification successful! All critical tests passed."
        exit 0
    else
        log_error "Deployment verification failed! Please investigate the issues above."
        exit 1
    fi
}

# Help function
show_help() {
    echo "Deployment Verification Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Set environment (default: prod)"
    echo "  -d, --deployment-id ID   Set deployment ID (default: timestamp)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT             Override environment setting"
    echo "  DEPLOYMENT_ID           Override deployment ID"
    echo ""
    echo "Examples:"
    echo "  $0                      # Verify production deployment"
    echo "  $0 -e dev               # Verify development deployment"
    echo "  $0 -d v1.2.3            # Verify deployment with specific ID"
    echo "  ENVIRONMENT=staging $0  # Verify staging deployment"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--deployment-id)
            DEPLOYMENT_ID="$2"
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

# Run deployment verification
run_deployment_verification
