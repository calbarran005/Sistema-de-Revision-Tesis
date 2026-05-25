import type { NextConfig } from 'next';

const allowedOrigins = ['localhost:3000'];
if (process.env.NEXT_PUBLIC_APP_DOMAIN) {
  allowedOrigins.push(process.env.NEXT_PUBLIC_APP_DOMAIN);
}

const nextConfig: NextConfig = {
  experimental: { serverActions: { allowedOrigins } },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'SisTesis',
  },
};

export default nextConfig;
