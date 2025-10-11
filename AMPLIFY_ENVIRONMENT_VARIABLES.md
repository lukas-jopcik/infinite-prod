# AWS Amplify Environment Variables Configuration

## Required Environment Variables

Set these in the AWS Amplify Console under **App settings > Environment variables**:

### Core API Configuration
```
NEXT_PUBLIC_API_URL=https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com/dev
API_REGION=eu-central-1
```

### Site Configuration
```
NEXT_PUBLIC_SITE_URL=https://main.d1234567890.amplifyapp.com
```
*Note: Set this AFTER first deployment with the actual Amplify URL*

## Optional Environment Variables

### Google Analytics (GA4)
```
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### Google Site Verification
```
GOOGLE_SITE_VERIFICATION=your_verification_code
```

### Google AdSense
```
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-xxxxxxxxxx
NEXT_PUBLIC_ADSENSE_SLOT_HEADER=xxxxxxxxxx
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=xxxxxxxxxx
NEXT_PUBLIC_ADSENSE_SLOT_FOOTER=xxxxxxxxxx
NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE=xxxxxxxxxx
```

### Affiliate Marketing
```
NEXT_PUBLIC_DOGNET_AFFILIATE_ID=your_affiliate_id
```

## How to Set Environment Variables in Amplify Console

1. Go to AWS Amplify Console
2. Select your app
3. Go to **App settings** > **Environment variables**
4. Click **Manage variables**
5. Add each variable with its value
6. Click **Save**
7. Redeploy the app to apply changes

## Environment Variable Usage in Code

- **API Configuration**: `lib/config.ts` and `lib/api.ts`
- **Site Configuration**: `lib/config.ts`
- **Analytics**: `lib/config.ts` and `components/analytics/`
- **AdSense**: `lib/config.ts` and `components/ads/`

## Important Notes

- All `NEXT_PUBLIC_*` variables are exposed to the browser
- Variables without `NEXT_PUBLIC_` prefix are server-side only
- Changes to environment variables require a new deployment
- Test all functionality after setting environment variables
