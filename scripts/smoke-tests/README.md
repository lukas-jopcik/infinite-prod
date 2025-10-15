# Smoke Test Scripts

This directory contains bash scripts for production monitoring, deployment verification, and health checks.

## Scripts Overview

### 1. `production-smoke-test.sh`
Comprehensive smoke test for production environment after deployment.

**Features:**
- AWS infrastructure health checks
- Lambda function verification
- DynamoDB table status
- S3 bucket accessibility
- CloudFront distribution status
- EventBridge rules verification
- API Gateway health
- API endpoint testing
- Frontend accessibility
- Recent data validation
- Lambda performance testing
- CloudWatch logs verification
- Secrets Manager validation

**Usage:**
```bash
# Run for production
./production-smoke-test.sh

# Run for specific environment
./production-smoke-test.sh -e dev

# Set environment variable
ENVIRONMENT=staging ./production-smoke-test.sh
```

### 2. `deployment-verification.sh`
Detailed verification script for deployment success.

**Features:**
- Lambda function deployment verification
- API Gateway deployment status
- CloudFront deployment verification
- Frontend deployment validation
- Database schema verification
- Environment variables validation
- Secrets configuration verification
- IAM roles and policies verification
- EventBridge configuration verification
- API endpoints functionality testing
- Lambda function functionality testing
- Data flow verification
- Monitoring and logging verification
- Deployment report generation

**Usage:**
```bash
# Verify production deployment
./deployment-verification.sh

# Verify with specific deployment ID
./deployment-verification.sh -d v1.2.3

# Verify for specific environment
./deployment-verification.sh -e dev
```

### 3. `health-check.sh`
Quick health check for monitoring and alerting.

**Features:**
- AWS connectivity verification
- Lambda function health
- DynamoDB health
- S3 bucket health
- API endpoints health
- Frontend health
- CloudFront health
- EventBridge health
- Secrets Manager health
- Recent data validation
- Lambda performance testing
- CloudWatch logs verification
- System resource monitoring
- Network connectivity testing
- SSL certificate validation

**Usage:**
```bash
# Run health check for production
./health-check.sh

# Run for specific environment
./health-check.sh -e dev

# Set environment variable
ENVIRONMENT=staging ./health-check.sh
```

## Configuration

### Environment Variables

All scripts support the following environment variables:

- `ENVIRONMENT`: Target environment (default: `prod`)
- `DEPLOYMENT_ID`: Deployment identifier (for deployment verification)
- `AWS_REGION`: AWS region (default: `eu-central-1`)

### Required AWS Permissions

The scripts require the following AWS permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lambda:GetFunction",
                "lambda:InvokeFunction",
                "dynamodb:DescribeTable",
                "dynamodb:Scan",
                "s3:ListBucket",
                "s3:GetObject",
                "cloudfront:GetDistribution",
                "events:DescribeRule",
                "apigateway:GET",
                "logs:DescribeLogGroups",
                "secretsmanager:DescribeSecret",
                "iam:GetRole",
                "sts:GetCallerIdentity"
            ],
            "Resource": "*"
        }
    ]
}
```

### Required Tools

- AWS CLI v2
- curl
- jq (for JSON processing)
- openssl (for SSL certificate checks)

## Logging

All scripts generate detailed logs in the `logs/` directory:

- `logs/smoke-test-YYYYMMDD-HHMMSS.log`
- `logs/deployment-verification-YYYYMMDD-HHMMSS.log`
- `logs/health-check-YYYYMMDD-HHMMSS.log`
- `logs/deployment-report-{DEPLOYMENT_ID}.md`

## Exit Codes

- `0`: Success (all tests passed)
- `1`: Failure (critical tests failed)

## Integration

### CI/CD Pipeline

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Smoke Tests
  run: |
    chmod +x scripts/smoke-tests/*.sh
    ./scripts/smoke-tests/production-smoke-test.sh -e ${{ env.ENVIRONMENT }}

- name: Verify Deployment
  run: |
    ./scripts/smoke-tests/deployment-verification.sh -d ${{ github.sha }}
```

### Monitoring

For continuous monitoring, use the health check script:

```bash
# Add to crontab for regular health checks
*/5 * * * * /path/to/scripts/smoke-tests/health-check.sh -e prod
```

### Alerting

The scripts can be integrated with monitoring systems:

```bash
# Example with alerting
if ! ./scripts/smoke-tests/health-check.sh; then
    # Send alert to monitoring system
    curl -X POST "https://hooks.slack.com/services/..." \
         -H "Content-Type: application/json" \
         -d '{"text":"Production health check failed!"}'
fi
```

## Customization

### Adding New Tests

To add new tests to any script:

1. Create a new function following the naming pattern `check_*_health()`
2. Use the appropriate test function:
   - `check_critical()` for critical tests
   - `check_warning()` for warning tests
3. Call the function in the main execution flow

### Modifying Test Thresholds

Adjust performance thresholds in the scripts:

```bash
# Example: Change Lambda timeout threshold
if [ "$duration" -lt 3000 ]; then  # Changed from 5000 to 3000
    test_result "Lambda Performance" "PASS" "Function responded in ${duration}ms"
```

### Environment-Specific Configuration

Create environment-specific configurations:

```bash
# Example: Different URLs per environment
case "$ENVIRONMENT" in
    "dev")
        API_BASE_URL="https://dev-api.example.com"
        FRONTEND_URL="https://dev.example.com"
        ;;
    "staging")
        API_BASE_URL="https://staging-api.example.com"
        FRONTEND_URL="https://staging.example.com"
        ;;
    "prod")
        API_BASE_URL="https://api.example.com"
        FRONTEND_URL="https://example.com"
        ;;
esac
```

## Troubleshooting

### Common Issues

1. **AWS CLI not configured**
   ```bash
   aws configure
   ```

2. **Missing permissions**
   - Check IAM user/role permissions
   - Verify resource ARNs

3. **Network connectivity issues**
   - Check firewall rules
   - Verify DNS resolution

4. **SSL certificate issues**
   - Check certificate expiry
   - Verify domain configuration

### Debug Mode

Enable debug mode for detailed output:

```bash
set -x  # Enable debug mode
./scripts/smoke-tests/health-check.sh
```

### Log Analysis

Analyze logs for patterns:

```bash
# Count test results
grep -c "✅" logs/health-check-*.log
grep -c "❌" logs/health-check-*.log
grep -c "⚠️" logs/health-check-*.log

# Find failed tests
grep "❌" logs/health-check-*.log
```

## Best Practices

1. **Run smoke tests after every deployment**
2. **Use health checks for continuous monitoring**
3. **Set up alerts for critical failures**
4. **Regularly review and update test thresholds**
5. **Keep scripts in version control**
6. **Document any customizations**
7. **Test scripts in non-production environments first**

## Support

For issues or questions:

1. Check the logs for detailed error messages
2. Verify AWS permissions and configuration
3. Test individual components manually
4. Review the troubleshooting section
5. Check for recent changes in the environment
