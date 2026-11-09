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
      "inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-md";

    const sizeStyles = {
      sm: "text-xs h-7 px-2.5 gap-1.5",
      md: "text-sm h-9 px-3.5 gap-2",
      lg: "text-sm h-11 px-5 gap-2.5",
    };

    const variantStyles = {
      primary: "bg-panel text-white hover:bg-panel-raised shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_1px_2px_rgb(11_18_32/0.2)]",
      secondary: "bg-surface text-ink border border-line-strong hover:bg-canvas shadow-card",
      outline: "bg-transparent text-ink border border-line-strong hover:bg-canvas hover:border-ink-subtle",
      danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-card",
      ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-canvas-sunken",
      tally: "bg-brand text-panel-deep font-semibold hover:bg-brand-hover shadow-card",
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
          <kbd className="ml-1 text-[10px] font-mono font-medium px-1.5 py-px rounded bg-current/10 opacity-70">
            {shortcutHint}
          </kbd>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
