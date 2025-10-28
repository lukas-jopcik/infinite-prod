# IAM Permissions Fix Required

## Problem
Lambda functions `ai-idea-generator` and `ai-discoveries-generator` cannot access OpenAI API key from AWS Secrets Manager.

## Error
```
AccessDeniedException: User: arn:aws:sts::349660737637:assumed-role/infinite-lambda-execution-role-dev/ai-idea-generator is not authorized to perform: secretsmanager:GetSecretValue on resource: arn:aws:secretsmanager:eu-central-1:349660737637:secret:infinite/openai-api-key
```

## Solution
Add Secrets Manager permissions to the Lambda execution role.

### Option 1: Attach AWS Managed Policy
```bash
aws iam attach-role-policy \
  --role-name infinite-lambda-execution-role-dev \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### Option 2: Create Inline Policy (More Secure)
```bash
aws iam put-role-policy \
  --role-name infinite-lambda-execution-role-dev \
  --policy-name SecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "secretsmanager:GetSecretValue"
        ],
        "Resource": [
          "arn:aws:secretsmanager:eu-central-1:349660737637:secret:infinite/openai-api-key*",
          "arn:aws:secretsmanager:eu-central-1:349660737637:secret:infinite/flickr-api-key*"
        ]
      }
    ]
  }'
```

### Option 3: Add S3 Permissions (if needed)
```bash
aws iam attach-role-policy \
  --role-name infinite-lambda-execution-role-dev \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

## Current Role Policies
- ✅ AWSLambdaBasicExecutionRole
- ✅ AmazonDynamoDBFullAccess
- ❌ Secrets Manager access (MISSING)

## After Fix
Run the test pipeline again:
```bash
cd backend/infrastructure
./test-ai-discoveries-pipeline.sh
```

## Expected Result
- ✅ AI Idea Generator: Creates 5 ideas daily
- ✅ AI Discoveries Generator: Creates articles every 2 hours
- ✅ Articles appear at: https://infinite.sk/kategoria/vesmirne-objavy
