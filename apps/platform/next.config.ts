import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Next silently truncates bodies past this limit, which would store a corrupt file. Set above the
    // backend's 10 MB limit so oversized uploads reach the backend and get refused.
    proxyClientMaxBodySize: "12mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    const adminUrl =
      process.env.ADMIN_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3001/" : undefined);
    const distributorUrl =
      process.env.DISTRIBUTOR_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3002/" : undefined);

    return [
      {
        source: "/dashboard",
        destination: "/gateway",
        permanent: true,
      },
      { source: "/dashboard/returns", destination: "/gst/returns", permanent: true },
      { source: "/dashboard/license", destination: "/settings/license", permanent: true },
      { source: "/dashboard/executive", destination: "/executive", permanent: true },
      { source: "/dashboard/invoices/:path*", destination: "/gst", permanent: true },
      { source: "/invoices", destination: "/gst", permanent: true },
      { source: "/marketplace", destination: "/reconciliation?tab=marketplace", permanent: true },
      ...(adminUrl
        ? [{ source: "/admin", destination: adminUrl, permanent: false }]
        : []),
      ...(distributorUrl
        ? [{ source: "/distributor", destination: distributorUrl, permanent: false }]
        : []),
    ];
  },
};

export default nextConfig;
