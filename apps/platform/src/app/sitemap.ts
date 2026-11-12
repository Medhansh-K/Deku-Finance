import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { DOC_ARTICLES, DOC_CATEGORIES } from "@/lib/learn/docs-data";

const PUBLIC_PAGES = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/features", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/gst-compliance", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/gst-returns", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/learn", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/learn/demo", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/learn/demo/companies", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/learn/docs", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/request-setup", priority: 0.7, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_PAGES.map((entry) => ({
    url: `${baseUrl}${entry.path}`,
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const categoryEntries: MetadataRoute.Sitemap = DOC_CATEGORIES.map((cat) => ({
    url: `${baseUrl}/learn/docs/${cat.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const articleEntries: MetadataRoute.Sitemap = DOC_ARTICLES.map((art) => ({
    url: `${baseUrl}/learn/docs/${art.category}/${art.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...categoryEntries, ...articleEntries];
}
