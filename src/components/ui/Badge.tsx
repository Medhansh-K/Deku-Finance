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
    default: "bg-slate-100 text-slate-700 border-slate-300",
    success: "bg-emerald-50 text-emerald-700 border-emerald-300",
    warning: "bg-amber-50 text-amber-800 border-amber-300",
    danger: "bg-rose-50 text-rose-700 border-rose-300",
    teal: "bg-[#91D7D2]/25 text-[#1F2324] border-[#5BB5BB]/50 font-bold",
    outline: "bg-transparent text-slate-700 border-slate-400",
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
