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
    default: "bg-canvas-sunken text-ink-soft ring-line-strong",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
    danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
    teal: "bg-brand/10 text-brand-strong ring-brand/30",
    outline: "bg-transparent text-ink-soft ring-line-strong",
  };

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-0.5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset whitespace-nowrap select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
