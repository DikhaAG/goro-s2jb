import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['bullmq', 'exceljs', 'fast-csv', 'ioredis'],
};

export default nextConfig;
