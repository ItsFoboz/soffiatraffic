import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Google profile images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'googleusercontent.com' },
    ],
  },
  // Allow fetching from sofiatraffic.bg and openstreetmap servers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
