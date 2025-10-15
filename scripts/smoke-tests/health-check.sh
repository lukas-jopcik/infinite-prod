#!/bin/bash

# Health Check Script
# Quick health check for monitoring and alerting

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/health-check-$(date +%Y%m%d-%H%M%S).log"
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

# Health check status
HEALTH_STATUS="HEALTHY"
CRITICAL_ISSUES=0
WARNING_ISSUES=0

# Health check functions
check_critical() {
    local test_name="$1"
    local command="$2"
    local error_message="$3"
    
    if eval "$command" &> /dev/null; then
        log_success "$test_name: OK"
        return 0
    else
        log_error "$test_name: $error_message"
        HEALTH_STATUS="UNHEALTHY"
        ((CRITICAL_ISSUES++))
        return 1
    fi
}

check_warning() {
    local test_name="$1"
    local command="$2"
    local error_message="$3"
    
    if eval "$command" &> /dev/null; then
        log_success "$test_name: OK"
        return 0
    else
        log_warning "$test_name: $error_message"
        ((WARNING_ISSUES++))
        return 1
    fi
}

# AWS connectivity check
check_aws_connectivity() {
    log "Checking AWS connectivity..."
    check_critical "AWS CLI" "aws sts get-caller-identity" "AWS CLI not configured or credentials invalid"
}

# Lambda function health
check_lambda_health() {
    log "Checking Lambda function health..."
    
    local functions=(
        "infinite-nasa-apod-$ENVIRONMENT-fetcher"
        "infinite-nasa-apod-$ENVIRONMENT-content-processor"
        "infinite-nasa-apod-$ENVIRONMENT-api-latest"
    )
    
    for func in "${functions[@]}"; do
        check_critical "Lambda $func" "aws lambda get-function --function-name $func" "Function not found or not accessible"
    done
}

# DynamoDB health
check_dynamodb_health() {
    log "Checking DynamoDB health..."
    
    local tables=(
        "InfiniteRawContent-$ENVIRONMENT"
        "InfiniteArticles-$ENVIRONMENT"
    )
    
    for table in "${tables[@]}"; do
        check_critical "DynamoDB $table" "aws dynamodb describe-table --table-name $table" "Table not found or not accessible"
    done
}

# S3 bucket health
check_s3_health() {
    log "Checking S3 bucket health..."
    
    local bucket="infinite-nasa-apod-$ENVIRONMENT-images-349660737637"
    check_critical "S3 Bucket" "aws s3 ls s3://$bucket" "Bucket not accessible"
}

# API endpoints health
check_api_health() {
    log "Checking API endpoints health..."
    
    local base_url="https://test.execute-api.eu-central-1.amazonaws.com/prod"  # Replace with actual URL
    
    # Test /api/latest endpoint
    check_critical "API /api/latest" "curl -s -f $base_url/api/latest" "Endpoint not responding"
    
    # Test /api/articles endpoint
    check_critical "API /api/articles" "curl -s -f $base_url/api/articles" "Endpoint not responding"
}

# Frontend health
check_frontend_health() {
    log "Checking frontend health..."
    
    local frontend_url="https://infinite-nasa-apod-$ENVIRONMENT.amplifyapp.com"  # Replace with actual URL
    check_critical "Frontend" "curl -s -f $frontend_url" "Frontend not accessible"
}

# CloudFront health
check_cloudfront_health() {
    log "Checking CloudFront health..."
    
    local distribution_id="E1234567890ABC"  # Replace with actual distribution ID
    check_critical "CloudFront" "aws cloudfront get-distribution --id $distribution_id" "Distribution not found or not accessible"
}

# EventBridge health
check_eventbridge_health() {
    log "Checking EventBridge health..."
    
    local rules=(
        "infinite-nasa-apod-$ENVIRONMENT-daily-fetch"
        "infinite-nasa-apod-$ENVIRONMENT-weekly-ai-content"
    )
    
    for rule in "${rules[@]}"; do
        check_critical "EventBridge $rule" "aws events describe-rule --name $rule" "Rule not found or not accessible"
    done
}

# Secrets Manager health
check_secrets_health() {
    log "Checking Secrets Manager health..."
    
    local secrets=(
        "infinite/nasa-api-key-$ENVIRONMENT"
        "infinite/openai-api-key-$ENVIRONMENT"
    )
    
    for secret in "${secrets[@]}"; do
        check_critical "Secret $secret" "aws secretsmanager describe-secret --secret-id $secret" "Secret not found or not accessible"
    done
}

# Recent data check
check_recent_data() {
    log "Checking for recent data..."
    
    local table="InfiniteRawContent-$ENVIRONMENT"
    local recent_count=$(aws dynamodb scan \
        --table-name "$table" \
        --filter-expression "createdAt > :date" \
        --expression-attribute-values '{":date":{"S":"'$(date -u -d '2 days ago' +%Y-%m-%dT%H:%M:%S.000Z)'"}}' \
        --select COUNT \
        --query 'Count' \
        --output text 2>/dev/null || echo "0")
    
    if [ "$recent_count" -gt 0 ]; then
        log_success "Recent Data: Found $recent_count recent records"
    else
        log_warning "Recent Data: No recent data found in the last 2 days"
        ((WARNING_ISSUES++))
    fi
}

# Lambda function performance check
check_lambda_performance() {
    log "Checking Lambda function performance..."
    
    local function_name="infinite-nasa-apod-$ENVIRONMENT-api-latest"
    
    # Test function invocation with timeout
    local start_time=$(date +%s%3N)
    local response=$(timeout 10s aws lambda invoke \
        --function-name "$function_name" \
        --payload '{"httpMethod":"GET","path":"/api/latest"}' \
        --output text \
        /tmp/lambda-response.json 2>/dev/null || echo "ERROR")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if [ "$response" != "ERROR" ] && [ "$duration" -lt 5000 ]; then
        log_success "Lambda Performance: Function responded in ${duration}ms"
    elif [ "$response" != "ERROR" ]; then
        log_warning "Lambda Performance: Function responded but slowly: ${duration}ms"
        ((WARNING_ISSUES++))
    else
        log_error "Lambda Performance: Function invocation failed or timed out"
        HEALTH_STATUS="UNHEALTHY"
        ((CRITICAL_ISSUES++))
    fi
    
    # Clean up
    rm -f /tmp/lambda-response.json
}

# CloudWatch logs check
check_cloudwatch_logs() {
    log "Checking CloudWatch logs..."
    
    local log_group="/aws/lambda/infinite-nasa-apod-$ENVIRONMENT-fetcher"
    
    if aws logs describe-log-groups --log-group-name-prefix "$log_group" &> /dev/null; then
        log_success "CloudWatch Logs: Log group exists"
    else
        log_warning "CloudWatch Logs: Log group not found"
        ((WARNING_ISSUES++))
    fi
}

# Disk space check (if running on EC2)
check_disk_space() {
    log "Checking disk space..."
    
    if [ -d "/tmp" ]; then
        local disk_usage=$(df /tmp | awk 'NR==2 {print $5}' | sed 's/%//')
        if [ "$disk_usage" -lt 80 ]; then
            log_success "Disk Space: ${disk_usage}% used"
        elif [ "$disk_usage" -lt 90 ]; then
            log_warning "Disk Space: ${disk_usage}% used (getting full)"
            ((WARNING_ISSUES++))
        else
            log_error "Disk Space: ${disk_usage}% used (critical)"
            HEALTH_STATUS="UNHEALTHY"
            ((CRITICAL_ISSUES++))
        fi
    fi
}

# Memory usage check (if running on EC2)
check_memory_usage() {
    log "Checking memory usage..."
    
    if command -v free &> /dev/null; then
        local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        if [ "$memory_usage" -lt 80 ]; then
            log_success "Memory Usage: ${memory_usage}% used"
        elif [ "$memory_usage" -lt 90 ]; then
            log_warning "Memory Usage: ${memory_usage}% used (getting high)"
            ((WARNING_ISSUES++))
        else
            log_error "Memory Usage: ${memory_usage}% used (critical)"
            HEALTH_STATUS="UNHEALTHY"
            ((CRITICAL_ISSUES++))
        fi
    fi
}

# Network connectivity check
check_network_connectivity() {
    log "Checking network connectivity..."
    
    # Test external connectivity
    check_critical "Internet Connectivity" "ping -c 1 8.8.8.8" "No internet connectivity"
    
    # Test DNS resolution
    check_critical "DNS Resolution" "nslookup google.com" "DNS resolution failed"
}

# SSL certificate check
check_ssl_certificates() {
    log "Checking SSL certificates..."
    
    local domains=(
        "test.execute-api.eu-central-1.amazonaws.com"
        "infinite-nasa-apod-$ENVIRONMENT.amplifyapp.com"
    )
    
    for domain in "${domains[@]}"; do
        if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates &> /dev/null; then
            local expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
            local expiry_timestamp=$(date -d "$expiry_date" +%s)
            local current_timestamp=$(date +%s)
            local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
            
            if [ "$days_until_expiry" -gt 30 ]; then
                log_success "SSL $domain: Valid (expires in $days_until_expiry days)"
            elif [ "$days_until_expiry" -gt 7 ]; then
                log_warning "SSL $domain: Expires in $days_until_expiry days"
                ((WARNING_ISSUES++))
            else
                log_error "SSL $domain: Expires in $days_until_expiry days (critical)"
                HEALTH_STATUS="UNHEALTHY"
                ((CRITICAL_ISSUES++))
            fi
        else
            log_warning "SSL $domain: Cannot check certificate"
            ((WARNING_ISSUES++))
        fi
    done
}

# Main health check function
run_health_check() {
    log "Starting health check for environment: $ENVIRONMENT"
    log "Log file: $LOG_FILE"
    
    # Critical health checks
    check_aws_connectivity
    check_lambda_health
    check_dynamodb_health
    check_s3_health
    check_api_health
    check_frontend_health
    check_cloudfront_health
    check_eventbridge_health
    check_secrets_health
    
    # Performance checks
    check_lambda_performance
    check_recent_data
    check_cloudwatch_logs
    
    # System checks
    check_disk_space
    check_memory_usage
    check_network_connectivity
    check_ssl_certificates
    
    # Summary
    log "Health check completed!"
    log "Status: $HEALTH_STATUS"
    log "Critical issues: $CRITICAL_ISSUES"
    log "Warning issues: $WARNING_ISSUES"
    
    # Exit with appropriate code
    if [ "$HEALTH_STATUS" = "HEALTHY" ]; then
        log_success "System is healthy!"
        exit 0
    else
        log_error "System is unhealthy! Critical issues detected."
        exit 1
    fi
}

# Help function
show_help() {
    echo "Health Check Script"
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
    echo "  $0                      # Run health check for production"
    echo "  $0 -e dev               # Run health check for development"
    echo "  ENVIRONMENT=staging $0  # Run health check for staging"
    echo ""
    echo "Exit codes:"
    echo "  0 - System is healthy"
    echo "  1 - System is unhealthy (critical issues detected)"
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

# Run health check
run_health_check
