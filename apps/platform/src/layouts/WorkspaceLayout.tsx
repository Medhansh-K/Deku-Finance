import React from "react";
import { Breadcrumb, BreadcrumbItem } from "@/components/navigation/Breadcrumb";

export interface WorkspaceLayoutProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function WorkspaceLayout({
  title,
  subtitle,
  badge,
  breadcrumbs = [],
  actions,
  children,
}: WorkspaceLayoutProps) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas">
      {/* Workspace Header Strip */}
      <div className="bg-surface border-b border-line px-5 py-4 sm:px-8 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            {breadcrumbs.length > 0 && (
              <div className="mb-1.5">
                <Breadcrumb items={breadcrumbs} />
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-ink-muted mt-1 max-w-3xl">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">{children}</main>
    </div>
  );
}
