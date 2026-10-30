import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "teal" | "outline";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-100 dark:bg-[#07111E] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#1A2E44]",
    success: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/40",
    warning: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/40",
    danger: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800/40",
    teal: "bg-[#91D7D2]/25 dark:bg-[#5BB5BB]/20 text-[#1F2324] dark:text-[#91D7D2] border-[#5BB5BB]/50 font-bold",
    outline: "bg-transparent text-slate-700 dark:text-slate-300 border-slate-400 dark:border-[#1A2E44]",
  };

  const sizeStyles = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono uppercase tracking-wider border select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
