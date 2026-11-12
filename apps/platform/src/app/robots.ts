import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/gst-compliance", "/gst-returns", "/learn", "/learn/", "/request-setup"],
        disallow: [
          "/api/",
          "/gateway",
          "/vouchers",
          "/reports",
          "/settings",
          "/onboarding",
          "/companies",
          "/executive",
          "/consultant",
          "/approvals",
          "/audit",
          "/banking",
          "/builder",
          "/collect",
          "/day-book",
          "/departments-members",
          "/export",
          "/gst/",
          "/import",
          "/inventory",
          "/join",
          "/kyc",
          "/masters",
          "/purchases",
          "/reconciliation",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

