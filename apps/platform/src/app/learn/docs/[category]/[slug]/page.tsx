import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearnShell } from "@/components/learn/LearnShell";
import {
  DOC_ARTICLES,
  getAdjacentArticles,
  getDocArticle,
  getDocCategory,
} from "@/lib/learn/docs-data";
import { ArrowLeft, ArrowRight, Clock, Info, Play, ShieldCheck, Tag } from "lucide-react";

export function generateStaticParams() {
  return DOC_ARTICLES.map((a) => ({ category: a.category, slug: a.slug }));
}

export default async function LearnDocArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category: categorySlug, slug } = await params;
  const category = getDocCategory(categorySlug);
  const article = getDocArticle(categorySlug, slug);
  if (!category || !article) notFound();

  const { prev, next } = getAdjacentArticles(article);
  const related = (article.relatedSlugs ?? [])
    .map((r) => getDocArticle(r.category, r.slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <LearnShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Reading Pane */}
        <article className="lg:col-span-8 space-y-8">
          <div className="space-y-4 pb-6 border-b border-line-strong">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <Link href="/learn/docs" className="hover:text-ink">
                Docs
              </Link>
              <span>/</span>
              <Link href={`/learn/docs/${category.slug}`} className="hover:text-ink font-semibold text-brand-strong">
                {category.order}. {category.title}
              </Link>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight leading-tight">
              {article.title}
            </h1>

            <p className="text-sm sm:text-base text-ink-soft leading-relaxed">{article.summary}</p>

            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-ink-muted pt-1">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {article.readMinutes} min read
              </span>
              <span>Version {article.version}</span>
              <span>Last updated {article.lastUpdated}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Tag className="h-3 w-3 text-ink-muted" />
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded bg-canvas-sunken border border-line font-mono text-[10px] text-ink-soft"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Demo Cross-Link */}
          {article.demoLink && (
            <div className="rounded-2xl border border-brand/40 bg-panel-deep text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-soft">
                  Hands-On Practice
                </span>
                <p className="text-sm font-bold">{article.demoLink.label}</p>
                <p className="text-xs text-slate-300">
                  Launches an isolated session straight into <code className="font-mono text-brand-soft">{article.demoLink.targetRoute}</code>.
                </p>
              </div>
              <Link
                href={`/learn/demo/workspace?company=${article.demoLink.companySlug}&route=${encodeURIComponent(
                  article.demoLink.targetRoute
                )}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-ink font-bold text-xs shrink-0 transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Launch in Demo</span>
              </Link>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-8">
            {article.sections.map((section) => (
              <section key={section.id} id={section.id} className="space-y-3 scroll-mt-24">
                <h2 className="text-xl font-bold text-ink tracking-tight">{section.heading}</h2>
                {section.paragraphs.map((p, idx) => (
                  <p key={idx} className="text-sm text-ink-soft leading-relaxed">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-2 pl-4 list-disc text-sm text-ink-soft leading-relaxed">
                    {section.bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                )}
                {section.callout && (
                  <div
                    className={`rounded-xl border p-4 text-xs leading-relaxed flex items-start gap-2.5 ${
                      section.callout.tone === "compliance"
                        ? "bg-amber-50 border-amber-200 text-amber-950"
                        : "bg-canvas border-line-strong text-ink-soft"
                    }`}
                  >
                    {section.callout.tone === "compliance" ? (
                      <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-4 w-4 text-brand-strong shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-ink">{section.callout.title}</div>
                      <p className="mt-1">{section.callout.body}</p>
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Prev / Next Navigation */}
          <nav
            aria-label="Article navigation"
            className="pt-8 border-t border-line-strong grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {prev ? (
              <Link
                href={`/learn/docs/${prev.category}/${prev.slug}`}
                className="rounded-xl border border-line-strong bg-surface p-4 hover:border-brand transition-colors space-y-1"
              >
                <div className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted">
                  <ArrowLeft className="h-3 w-3" /> Previous
                </div>
                <div className="text-xs font-bold text-ink">{prev.title}</div>
              </Link>
            ) : (
              <div />
            )}
            {next && (
              <Link
                href={`/learn/docs/${next.category}/${next.slug}`}
                className="rounded-xl border border-line-strong bg-surface p-4 hover:border-brand transition-colors space-y-1 sm:text-right"
              >
                <div className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted sm:justify-end w-full">
                  Next <ArrowRight className="h-3 w-3" />
                </div>
                <div className="text-xs font-bold text-ink">{next.title}</div>
              </Link>
            )}
          </nav>
        </article>

        {/* Right Sidebar: Table of Contents & Related */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-line-strong bg-surface p-5 space-y-3 lg:sticky lg:top-20">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
              On This Page
            </h3>
            <ul className="space-y-2 text-xs">
              {article.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink-soft hover:text-brand-strong font-medium block">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>

            {related.length > 0 && (
              <div className="pt-4 border-t border-line space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
                  Related Guides
                </h3>
                <ul className="space-y-2 text-xs">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link
                        href={`/learn/docs/${r.category}/${r.slug}`}
                        className="text-brand-strong hover:underline font-medium block"
                      >
                        {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </LearnShell>
  );
}
