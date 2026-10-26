import React, { forwardRef } from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "tally";
  size?: "sm" | "md" | "lg";
  shortcutHint?: string;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      shortcutHint,
      isLoading = false,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus:ring-2 focus:ring-[#5BB5BB] focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded";

    const sizeStyles = {
      sm: "text-xs px-2.5 py-1 gap-1.5",
      md: "text-sm px-3.5 py-1.5 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5",
    };

    const variantStyles = {
      primary: "bg-[#1F2324] text-white hover:bg-[#0A0A0A] border border-[#3E4848]",
      secondary: "bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0] border border-[#cbd5e1]",
      outline: "bg-transparent text-[#1f2324] hover:bg-[#f1f5f9] border border-[#3e4848]",
      danger: "bg-rose-700 text-white hover:bg-rose-800 border border-rose-900",
      ghost: "bg-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-slate-100",
      tally: "bg-[#5BB5BB] text-[#0a0a0a] font-bold hover:bg-[#4ea5a5] border border-[#3e4848] shadow-sm",
    };

    return (
      <button
        ref={ref}
        suppressHydrationWarning
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
        {shortcutHint && (
          <kbd className="ml-1.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/10 border border-black/20 text-current">
            {shortcutHint}
          </kbd>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
