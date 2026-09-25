/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    serverComponentsExternalPackages: [
      "@vercel/blob",
      "undici"
    ]
  }
};

module.exports = nextConfig;
