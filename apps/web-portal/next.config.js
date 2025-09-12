/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['recharts', 'react-virtualized'],
  },
  webpack: (config, { dev, isServer }) => {
    // Optimize for performance
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        performance: {
          name: 'performance',
          chunks: 'all',
          test: /[\\/]src[\\/]lib[\\/]performance[\\/]/,
          priority: 30,
        },
      };
    }

    return config;
  },
  // Performance optimizations
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
};

module.exports = nextConfig;