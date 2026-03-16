import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
