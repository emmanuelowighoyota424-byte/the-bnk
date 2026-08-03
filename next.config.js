/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', 'speakeasy', 'qrcode'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;