import type { NextConfig } from "next";

// The app is embedded in Notion, so it must be allowed inside Notion's iframe.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://*.notion.so https://notion.so https://*.notion.site https://app.notion.com https://*.notion.com" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};
export default nextConfig;
