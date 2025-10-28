# Local Development Setup - Infinite v2

**Date:** 2025-01-27  
**Status:** ✅ Configured for AWS

## Quick Start

### 1. Install Dependencies
```bash
cd infinite-v2
npm install --legacy-peer-deps
```

### 2. Environment Configuration

The `.env.local` file is configured to connect to AWS services:

```bash
# AWS API Gateway (Infinite Platform)
NEXT_PUBLIC_API_URL=https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com/dev
NEXT_PUBLIC_API_BASE_URL=https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com/dev

# Alternative: NASA APOD API
# NEXT_PUBLIC_API_URL=https://l9lm0zrzyl.execute-api.eu-central-1.amazonaws.com/prod
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Access the Application
- **Frontend:** http://localhost:3000
- **API:** AWS API Gateway (configured above)

## Architecture

### Current Setup
```
┌─────────────────────────────────────┐
│   Local Frontend (Next.js)          │
│   http://localhost:3000             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   AWS API Gateway                   │
│   jqg44jstd1...amazonaws.com/dev    │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────┐        ┌──────────────┐
│ Lambda  │        │  DynamoDB    │
│ Functions       │  (Articles)   │
└─────────┘        └──────────────┘
```

## API Endpoints

### Infinite Platform API
**Base URL:** `https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com/dev`

**Available Endpoints:**
- `GET /articles/latest?limit=10` - Get latest articles
- `GET /articles` - Get all articles (paginated)
- `GET /articles/{id}` - Get article by ID
- `GET /articles/slug/{slug}` - Get article by slug
- `GET /articles/category/{category}` - Get articles by category
- `GET /articles/search?q={query}` - Search articles

### NASA APOD API (Alternative)
**Base URL:** `https://l9lm0zrzyl.execute-api.eu-central-1.amazonaws.com/prod`

**Available Endpoints:**
- `GET /api/latest?limit=5` - Get latest APOD entries
- `GET /api/latest?date=YYYY-MM-DD` - Get specific date
- `POST /api/reprocess` - Reprocess content

## Environment Variables

### Required
```bash
NEXT_PUBLIC_API_URL          # AWS API Gateway endpoint
NEXT_PUBLIC_SITE_URL         # Local or production URL
```

### Optional
```bash
NEXT_PUBLIC_GA_ID            # Google Analytics ID
NEXT_PUBLIC_ADSENSE_CLIENT   # Google AdSense client ID
GOOGLE_SITE_VERIFICATION     # Site verification code
NEXT_PUBLIC_DOGNET_AFFILIATE_ID # Affiliate ID
```

## Troubleshooting

### 1. API Connection Errors
If you see "fetch failed" or "ECONNREFUSED" errors:
- Verify the API Gateway endpoint is correct
- Check AWS API Gateway is deployed and running
- Check your network connection

### 2. Redis Connection Errors
Expected in local development - Redis is optional and the app will continue without it:
```
[Cache] Redis connection error (continuing without cache)
```

### 3. CORS Errors
If you encounter CORS errors, check AWS API Gateway CORS settings:
- Origin: `http://localhost:3000`
- Methods: GET, POST, PUT, DELETE
- Headers: `Content-Type, Authorization`

### 4. Build Errors
```bash
# Clean install if needed
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## Switching APIs

To switch between Infinite Platform and NASA APOD APIs:

1. Edit `.env.local`
2. Comment out one API URL and uncomment the other
3. Restart the dev server

```bash
# For Infinite Platform (current)
NEXT_PUBLIC_API_URL=https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com/dev

# For NASA APOD
# NEXT_PUBLIC_API_URL=https://l9lm0zrzyl.execute-api.eu-central-1.amazonaws.com/prod
```

## Development Tips

### Hot Reload
Next.js automatically reloads on file changes in:
- `app/` - Pages and routes
- `components/` - React components
- `lib/` - Utilities and helpers

### Mock Data
If API is unavailable, the app falls back to mock data from `lib/mock-data.ts`

### TypeScript
Run type checking:
```bash
npm run lint
```

### Performance
- Use Next.js dev tools for performance monitoring
- Check Network tab for API requests
- Monitor console for errors

## Production Deployment

See `DEPLOYMENT.md` for AWS Amplify deployment instructions.

---

**Configuration Status:** ✅ Connected to AWS  
**Last Updated:** 2025-01-27

