import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const PUBLIC_PAGES = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/features", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/gst-compliance", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/gst-returns", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/learn", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/learn/demo", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/learn/docs", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/request-setup", priority: 0.7, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const lastModified = new Date();
  return PUBLIC_PAGES.map((entry) => ({
    url: `${baseUrl}${entry.path}`,
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}

