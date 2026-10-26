/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Product images will be added in a later step; allow remote patterns when they are.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
