import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sports/core', '@sports/query'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'crests.football-data.org' }],
  },
};

export default nextConfig;
