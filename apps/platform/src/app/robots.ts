import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const PUBLIC_ALLOW = [
  "/",
  "/features",
  "/gst-compliance",
  "/gst-returns",
  "/learn",
  "/learn/",
  "/request-setup",
  "/llms.txt",
  "/llms-full.txt",
];

const PRIVATE_DISALLOW = [
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
];

const AI_AND_SEARCH_BOTS = [
  "Googlebot",
  "Google-Extended",
  "Gemini-Deep-Research",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "*",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: AI_AND_SEARCH_BOTS.map((userAgent) => ({
      userAgent,
      allow: PUBLIC_ALLOW,
      disallow: PRIVATE_DISALLOW,
    })),
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
