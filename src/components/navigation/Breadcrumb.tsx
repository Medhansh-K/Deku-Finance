import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-sans select-none">
      <Link
        href="/gateway"
        className="flex items-center gap-1 text-slate-600 hover:text-brand transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Gateway</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
            {isLast || !item.href ? (
              <span className="font-semibold text-ink truncate">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-slate-600 hover:text-brand transition-colors truncate"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
