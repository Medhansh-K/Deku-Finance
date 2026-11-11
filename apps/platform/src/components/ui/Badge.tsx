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
    default: "bg-canvas-sunken text-ink-soft ring-transparent",
    success: "bg-ok-wash text-ok ring-transparent",
    warning: "bg-warn-wash text-warn ring-transparent",
    danger: "bg-bad-wash text-bad ring-transparent",
    teal: "bg-brand-wash text-brand-strong ring-transparent",
    outline: "bg-transparent text-ink-soft ring-line-strong",
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5",
    md: "text-[13px] px-2.5 py-0.5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip font-medium ring-1 ring-inset whitespace-nowrap select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
