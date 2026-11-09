import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefixSymbol?: string;
  suffixSymbol?: string;
  isNumeric?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      prefixSymbol,
      suffixSymbol,
      isNumeric = false,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-ink-soft"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixSymbol && (
            <span className="absolute left-3 text-xs font-semibold text-ink-muted select-none pointer-events-none">
              {prefixSymbol}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            suppressHydrationWarning
            className={`w-full h-9 rounded-md border border-line-strong bg-surface text-sm text-ink placeholder-ink-subtle shadow-[0_1px_1px_rgb(11_18_32/0.04)] transition-[border-color,box-shadow] focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 disabled:bg-canvas disabled:text-ink-subtle ${
              prefixSymbol ? "pl-7" : "px-3"
            } ${suffixSymbol ? "pr-8" : "px-3"} ${
              isNumeric ? "text-right font-mono" : ""
            } ${error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""} ${className}`}
            {...props}
          />
          {suffixSymbol && (
            <span className="absolute right-3 text-xs font-semibold text-ink-muted select-none pointer-events-none">
              {suffixSymbol}
            </span>
          )}
        </div>
        {error && (
          <p className="text-xs text-rose-600 font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
