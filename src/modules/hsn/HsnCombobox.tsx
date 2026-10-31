"use client";

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hsnApi, HsnMatch } from "@/api/endpoints";
import { comboboxKey, hsnCodeError } from "./hsn";

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** Visible label; omit inside tables and pass ariaLabel instead. */
  label?: string;
  ariaLabel?: string;
  inputClassName?: string;
  /** Extra attributes for the input, e.g. data-grid-field for the invoice grid. */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> & Record<`data-${string}`, string | boolean>;
}

type Status = "idle" | "loading" | "not-loaded" | "no-match" | "error";

const DEBOUNCE_MS = 250;

/**
 * HSN/SAC picker: free typing, with suggestions from the imported HSN master.
 * Picking a suggestion only fills the code; the GST rate is always chosen by the user.
 */
export function HsnCombobox({ value, onChange, label, ariaLabel, inputClassName = "", inputProps }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<HsnMatch[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [rect, setRect] = useState<DOMRect | null>(null);

  const query = value.trim();

  useEffect(() => {
    if (!focused || query.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    setStatus("loading");
    const t = setTimeout(async () => {
      try {
        const res = await hsnApi.search(query, 10, ctrl.signal);
        if (ctrl.signal.aborted) return;
        const rows = res.data ?? [];
        setResults(rows);
        setActive(-1);
        setStatus(rows.length > 0 ? "idle" : res.loaded === false ? "not-loaded" : "no-match");
      } catch {
        if (!ctrl.signal.aborted) {
          setResults([]);
          setStatus("error");
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, focused]);

  const showPopup = open && focused && query.length >= 2 && (results.length > 0 || status !== "idle");

  // The popup is portalled with fixed positioning so table and modal overflow can't clip it.
  useLayoutEffect(() => {
    if (!showPopup) return;
    const place = () => setRect(inputRef.current?.getBoundingClientRect() ?? null);
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [showPopup]);

  const pick = (m: HsnMatch) => {
    onChange(m.code);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const next = comboboxKey(e.key, { open: showPopup, active }, results.length);
    if (!next.handled) return;
    // Keeps Enter from reaching the invoice grid / form and Escape from closing a surrounding modal.
    e.preventDefault();
    e.stopPropagation();
    if (next.select) pick(results[active]);
    setOpen(next.open);
    setActive(next.active);
  };

  const error = focused ? null : hsnCodeError(value);
  const message =
    status === "loading" ? "Searching…"
    : status === "not-loaded" ? "HSN master not loaded yet; ask an admin to import it. You can still type the code."
    : status === "no-match" ? "No match in the HSN master. You can still type the code."
    : status === "error" ? "HSN search is unavailable right now. You can still type the code."
    : null;

  const input = (
    <input
      {...inputProps}
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      role="combobox"
      aria-label={label ? undefined : ariaLabel}
      aria-autocomplete="list"
      aria-expanded={showPopup}
      aria-controls={listId}
      aria-activedescendant={showPopup && active >= 0 ? `${id}-opt-${active}` : undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setOpen(true);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setOpen(false);
        setActive(-1);
      }}
      onKeyDown={onKeyDown}
      className={`${inputClassName} font-mono ${error ? "border-rose-500" : ""}`}
    />
  );

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-ink-soft">
          {label}
        </label>
      )}
      {input}
      {error && (
        <p id={errorId} className="text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
      {showPopup && rect && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[60] max-h-64 w-80 max-w-[calc(100vw-32px)] overflow-y-auto rounded-md border border-line bg-surface text-xs shadow-pop"
            style={{ top: rect.bottom + 4, left: Math.max(16, Math.min(rect.left, window.innerWidth - 336)) }}
          >
            <ul id={listId} role="listbox" aria-label="HSN/SAC suggestions">
              {results.map((m, i) => (
                <li
                  key={m.code}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown, not click: keep focus in the input so blur doesn't close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(m);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer gap-2 px-2.5 py-1.5 ${i === active ? "bg-brand-soft text-ink" : "text-ink-soft"}`}
                >
                  <span className="w-16 shrink-0 font-mono font-semibold text-ink">{m.code}</span>
                  <span className="min-w-0">{m.description}</span>
                </li>
              ))}
            </ul>
            {message && (
              <p role="status" className="px-2.5 py-2 text-ink-muted">
                {message}
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
