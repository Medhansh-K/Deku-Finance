import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearnShell } from "@/components/learn/LearnShell";
import {
  DOC_CATEGORIES,
  getArticlesForCategory,
  getDocCategory,
} from "@/lib/learn/docs-data";
import { ArrowLeft, ArrowRight, BookOpen, Clock, Play } from "lucide-react";

export function generateStaticParams() {
  return DOC_CATEGORIES.map((c) => ({ category: c.slug }));
}

export default async function LearnDocCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const category = getDocCategory(categorySlug);
  if (!category) notFound();

  const articles = getArticlesForCategory(category.slug);

  return (
    <LearnShell>
      <section className="border-b border-line-strong bg-surface py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <Link
            href="/learn/docs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Documentation Categories</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-panel text-brand-soft font-mono text-xs font-bold">
              SECTION {category.order}
            </span>
            <span className="text-xs font-mono text-ink-muted">
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </span>
          </div>

          <h1 className="text-3xl font-black text-ink tracking-tight">{category.title}</h1>
          <p className="text-sm text-ink-soft max-w-3xl leading-relaxed">{category.summary}</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        {articles.map((article) => (
          <article
            key={article.slug}
            className="rounded-2xl border border-line-strong bg-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand transition-colors"
          >
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {article.readMinutes} min read
                </span>
                <span>v{article.version}</span>
                <span>Updated {article.lastUpdated}</span>
              </div>
              <h2 className="text-lg font-bold text-ink">
                <Link href={`/learn/docs/${category.slug}/${article.slug}`} className="hover:text-brand-strong">
                  {article.title}
                </Link>
              </h2>
              <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">{article.summary}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-canvas border border-line font-mono text-[10px] text-ink-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-row sm:flex-col gap-2 shrink-0">
              <Link
                href={`/learn/docs/${category.slug}/${article.slug}`}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-panel hover:bg-panel-deep text-white text-xs font-bold transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 text-brand" />
                <span>Read Guide</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {article.demoLink && (
                <Link
                  href={`/learn/demo/workspace?company=${article.demoLink.companySlug}&route=${encodeURIComponent(
                    article.demoLink.targetRoute
                  )}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-brand/40 bg-brand/10 hover:bg-brand/20 text-brand-strong text-xs font-bold transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Try in Demo</span>
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>
    </LearnShell>
  );
}
