import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
  async redirects() {
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
    ];
  },
};

export default nextConfig;
