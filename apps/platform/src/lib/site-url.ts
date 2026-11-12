/** Resolves the public origin for metadata, OpenGraph links, robots, and sitemap. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodHost) return `https://${prodHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  const previewHost = process.env.VERCEL_URL?.trim();
  if (previewHost) return `https://${previewHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

