import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set the correct workspace root to avoid lockfile warnings
  outputFileTracingRoot: __dirname,
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Image optimization - temporarily disable for debugging
  images: {
    unoptimized: true, // Disable Next.js image optimization temporarily
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'infinite-images-dev-349660737637.s3.eu-central-1.amazonaws.com',
        port: '',
        pathname: '/images/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [25, 50, 60, 75, 80, 90, 95, 100], // Add quality configuration
  },

  // Compression and optimization
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  // Router configuration
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  // Headers for better caching and security
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://www.gstatic.com https://www.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://region1.analytics.google.com https://vitals.vercel-insights.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https://jqg44jstd1.execute-api.eu-central-1.amazonaws.com https://stats.g.doubleclick.net https://ep1.adtrafficquality.google",
              "frame-src 'self' https://www.google.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
              "block-all-mixed-content"
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Bundle analyzer (only in development)
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config: unknown) => {
      const BundleAnalyzerPlugin = require('@next/bundle-analyzer');
      (config as any).plugins.push(
        new BundleAnalyzerPlugin({
          enabled: true,
        })
      );
      return config;
    },
  }),
};

export default nextConfig;
