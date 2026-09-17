// @ts-check

import createNextIntlPlugin from 'next-intl/plugin';
import MDXPlugin from '@next/mdx';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');
const withMDX = MDXPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@colonial-collections/ui'],
  // Self-contained server bundle for the container image (see /Dockerfile):
  // .next/standalone holds server.js plus only the node_modules actually
  // imported. outputFileTracingRoot points at the monorepo root so workspace
  // packages are traced too.
  output: 'standalone',
  experimental: {
    mdxRs: true,
    outputFileTracingRoot: path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../'
    ),
  },
  // https://vercel.com/docs/image-optimization
  images: {
    remotePatterns: [{hostname: '**'}],
    // https://nextjs.org/docs/app/api-reference/components/image#minimumcachettl
    minimumCacheTTL: 31_536_000, // 1 year
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [80, 90, 120, 160, 270, 360],
    formats: ['image/avif', 'image/webp'],
  },
};

export default withNextIntl(withMDX(nextConfig));
