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
            className="block text-xs font-semibold uppercase tracking-wider text-[#3E4848]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixSymbol && (
            <span className="absolute left-3 text-xs font-semibold text-[#64748b] select-none pointer-events-none">
              {prefixSymbol}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            suppressHydrationWarning
            className={`w-full rounded border border-[#cbd5e1] bg-white text-sm text-[#0f172a] placeholder-[#94a3b8] transition-colors focus:border-[#5BB5BB] focus:outline-none focus:ring-1 focus:ring-[#5BB5BB] disabled:bg-[#f8fafc] disabled:text-[#94a3b8] ${
              prefixSymbol ? "pl-7" : "px-3"
            } ${suffixSymbol ? "pr-8" : "px-3"} py-1.5 ${
              isNumeric ? "text-right font-mono" : ""
            } ${error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500" : ""} ${className}`}
            {...props}
          />
          {suffixSymbol && (
            <span className="absolute right-3 text-xs font-semibold text-[#64748b] select-none pointer-events-none">
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
