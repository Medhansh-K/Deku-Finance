"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  DOC_ARTICLES,
  DOC_CATEGORIES,
  getArticlesForCategory,
  searchDocArticles,
} from "@/lib/learn/docs-data";
import { ArrowRight, BookOpen, Clock, Play, Search, Tag } from "lucide-react";

export function DocsExplorer() {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of DOC_ARTICLES) {
      for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag]) => tag);
  }, []);

  const filtered = useMemo(() => {
    const byQuery = searchDocArticles(query);
    return activeTag ? byQuery.filter((a) => a.tags.includes(activeTag)) : byQuery;
  }, [query, activeTag]);

  const isFiltering = Boolean(query.trim() || activeTag);

  return (
    <div className="space-y-10">
      {/* Search & Tag Bar */}
      <div className="rounded-2xl border border-line-strong bg-surface p-5 sm:p-6 shadow-xs space-y-4">
        <div className="relative">
          <Search className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <label htmlFor="learn-docs-search" className="sr-only">
            Search Deku manuals and technical documentation
          </label>
          <input
            id="learn-docs-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manuals: ALERX, GSTIN, GSTR-3B, FIFO warehouse, Maker-Checker, RBAC, RLS..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line-strong bg-canvas text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-ink-muted font-medium mr-1">
            <Tag className="h-3 w-3" /> Topics:
          </span>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] border transition-colors ${
                activeTag === tag
                  ? "bg-panel text-white border-edge"
                  : "bg-canvas text-ink-soft border-line hover:border-line-strong"
              }`}
            >
              #{tag}
            </button>
          ))}
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveTag(null);
              }}
              className="ml-auto text-xs font-semibold text-brand-strong hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Search Results Mode */}
      {isFiltering ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>
              Found <strong className="text-ink">{filtered.length}</strong> matching article
              {filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-ink">No manuals matched your search.</p>
              <p className="text-xs text-ink-muted">
                Try keywords like <code className="font-mono">alerx</code>,{" "}
                <code className="font-mono">gstr3b</code>, <code className="font-mono">inventory</code>, or{" "}
                <code className="font-mono">rbac</code>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((article) => (
                <Link
                  key={`${article.category}-${article.slug}`}
                  href={`/learn/docs/${article.category}/${article.slug}`}
                  className="p-5 rounded-2xl border border-line-strong bg-surface hover:border-brand transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
                      <span className="uppercase">{article.category.replace(/-/g, " ")}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {article.readMinutes} min
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-ink group-hover:text-brand-strong transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs text-ink-soft leading-relaxed">{article.summary}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-line text-xs font-semibold text-brand-strong">
                    <span>Read manual</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 8 Category Directories */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {DOC_CATEGORIES.map((cat) => {
            const articles = getArticlesForCategory(cat.slug);
            return (
              <div
                key={cat.slug}
                className="rounded-2xl border border-line-strong bg-surface p-5 flex flex-col justify-between gap-4 hover:shadow-sm transition-shadow"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-panel text-brand-soft font-mono text-[11px] font-bold">
                      {cat.order}
                    </span>
                    <span className="text-[11px] font-mono text-ink-muted">
                      {articles.length} {articles.length === 1 ? "guide" : "guides"}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-ink">{cat.title}</h2>
                  <p className="text-xs text-ink-soft leading-relaxed">{cat.summary}</p>

                  <ul className="pt-2 space-y-1.5 border-t border-line">
                    {articles.map((a) => (
                      <li key={a.slug}>
                        <Link
                          href={`/learn/docs/${cat.slug}/${a.slug}`}
                          className="text-xs text-ink hover:text-brand-strong font-medium flex items-start gap-1.5"
                        >
                          <BookOpen className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                          <span>{a.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-line flex items-center justify-between">
                  <Link
                    href={`/learn/docs/${cat.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-strong hover:underline"
                  >
                    <span>Browse Category</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {articles[0]?.demoLink && (
                    <Link
                      href={`/learn/demo/workspace?company=${articles[0].demoLink.companySlug}&route=${encodeURIComponent(
                        articles[0].demoLink.targetRoute
                      )}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted hover:text-ink"
                      title="Open in Interactive Demo"
                    >
                      <Play className="h-3 w-3 text-brand" />
                      <span>Demo</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
