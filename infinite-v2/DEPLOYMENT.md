# Infinite v2 - AWS Amplify Deployment Guide

## Overview

This Next.js application is deployed to AWS Amplify with the following AWS services:
- **Frontend**: AWS Amplify (Next.js)
- **API**: AWS API Gateway + Lambda
- **Database**: DynamoDB with Global Secondary Index (GSI)
- **Images**: AWS S3 for image optimization

## Prerequisites

- AWS Account with Amplify access
- GitHub repository with the code
- AWS API Gateway endpoint configured
- DynamoDB tables with GSI setup

## Deployment Steps

### 1. Connect Repository to Amplify

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click **New app** > **Host web app**
3. Choose **GitHub** as source
4. Select your repository: `lukas-jopcik/infinite-prod`
5. Choose branch: `infinite-v2`
6. **Important**: Check **"This is a monorepo"**
7. Set **Monorepo root directory**: `infinite-v2`

### 2. Configure Build Settings

The `amplify.yml` file is already configured in the root directory:

```yaml
version: 1
applications:
  - appRoot: infinite-v2
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
```

### 3. Set Environment Variables

Go to **App settings** > **Environment variables** and add:

#### Required Variables
```
NEXT_PUBLIC_API_URL=https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com/dev
API_REGION=eu-central-1
```

#### Optional Variables (for future use)
```
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
GOOGLE_SITE_VERIFICATION=your_verification_code
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-xxxxxxxxxx
NEXT_PUBLIC_DOGNET_AFFILIATE_ID=your_affiliate_id
```

### 4. Deploy

1. Click **Save and deploy**
2. Wait for build to complete
3. Note the generated Amplify URL (e.g., `https://main.d1234567890.amplifyapp.com`)

### 5. Post-Deployment Configuration

After successful deployment:

1. **Update Site URL**:
   - Go to **App settings** > **Environment variables**
   - Add: `NEXT_PUBLIC_SITE_URL=https://your-amplify-url.amplifyapp.com`
   - Redeploy to apply changes

2. **Test the Application**:
   - Visit the Amplify URL
   - Test all routes and API calls
   - Verify images load correctly
   - Check console for any errors

## AWS Services Configuration

### API Gateway
- **Endpoint**: `https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com/dev`
- **Region**: `eu-central-1`
- **CORS**: Enabled for Amplify domain

### DynamoDB
- **Table**: `infinite-articles`
- **GSI**: `category-publishedAt-index`
- **Region**: `eu-central-1`

### S3 (Image Optimization)
- **Bucket**: Configured in `next.config.ts`
- **Region**: `eu-central-1`

## Troubleshooting

### Build Failures

1. **"Invalid monorepo spec"**:
   - Ensure `amplify.yml` has `applications` key
   - Verify `appRoot: infinite-v2` is correct
   - Check monorepo settings in Amplify Console

2. **"Command not found: next"**:
   - Verify `package.json` exists in `infinite-v2/`
   - Check `npm ci` runs successfully in preBuild

3. **API Connection Errors**:
   - Verify `NEXT_PUBLIC_API_URL` is set correctly
   - Check API Gateway CORS settings
   - Test API endpoint manually

### Runtime Issues

1. **Images not loading**:
   - Check S3 bucket permissions
   - Verify image optimization settings in `next.config.ts`

2. **API calls failing**:
   - Check browser console for CORS errors
   - Verify API Gateway endpoint is accessible
   - Check Lambda function logs in CloudWatch

### Performance Issues

1. **Slow page loads**:
   - Check CloudWatch metrics
   - Verify caching headers are set
   - Monitor API response times

2. **Build timeouts**:
   - Increase build timeout in Amplify settings
   - Optimize dependencies in `package.json`

## Monitoring

### CloudWatch Logs
- **Amplify Build Logs**: Available in Amplify Console
- **Lambda Logs**: `/aws/lambda/infinite-api`
- **API Gateway Logs**: Enable in API Gateway console

### Key Metrics to Monitor
- Build success rate
- Page load times
- API response times
- Error rates
- User engagement

## Security Considerations

- Environment variables are properly scoped (`NEXT_PUBLIC_*` for client-side)
- API Gateway has CORS configured
- S3 bucket has appropriate permissions
- No sensitive data in client-side code

## Updates and Maintenance

### Code Updates
1. Push changes to `infinite-v2` branch
2. Amplify automatically triggers new build
3. Monitor build logs for issues

### Environment Variable Updates
1. Update in Amplify Console
2. Redeploy application
3. Test functionality

### Dependencies Updates
1. Update `package.json` in `infinite-v2/`
2. Test locally with `npm run build`
3. Push changes to trigger Amplify build

## Support

For issues:
1. Check CloudWatch logs
2. Review Amplify build logs
3. Test API endpoints manually
4. Verify environment variables
5. Check AWS service status

## Cost Optimization

- Use Amplify's caching features
- Optimize images with Next.js image optimization
- Monitor DynamoDB read/write capacity
- Use CloudWatch alarms for cost monitoring
