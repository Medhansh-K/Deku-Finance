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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
      {/* Workspace Header Strip */}
      <div className="bg-white border-b border-[#CBD5E1] px-5 py-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            {breadcrumbs.length > 0 && (
              <div className="mb-1">
                <Breadcrumb items={breadcrumbs} />
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold tracking-tight text-[#0A0A0A] uppercase font-mono">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-5">{children}</main>
    </div>
  );
}
