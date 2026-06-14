/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output only for self-hosting (Docker). Vercel handles Next natively.
  output: process.env.VERCEL ? undefined : "standalone",
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  },
};

export default nextConfig;
