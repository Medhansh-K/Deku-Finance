"use client";

import React from "react";
import { Keyboard, Check, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useKeyboardNav } from "@/context/KeyboardNavContext";

export function KeyboardPreferencesCard() {
  const { keyboardNavEnabled, toggleKeyboardNav } = useKeyboardNav();

  return (
    <div className="bg-surface border border-line rounded-panel p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-[8px] bg-canvas-sunken text-ink-soft grid place-items-center mt-0.5">
            <Keyboard className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                Keyboard navigation and shortcuts
              </h3>
              <Badge variant={keyboardNavEnabled ? "teal" : "default"}>
                {keyboardNavEnabled ? "On" : "Off"}
              </Badge>
            </div>
            <p className="text-[13px] text-ink-muted mt-0.5">
              Function keys (F1–F11) and Esc-to-Gateway navigation across Deku Finance.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={keyboardNavEnabled}
              onChange={toggleKeyboardNav}
              aria-label="Toggle keyboard navigation"
            />
            <div className="w-11 h-6 bg-line-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-line after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            <span className="ml-2.5 text-[13px] font-medium text-ink">
              {keyboardNavEnabled ? "On" : "Off"}
            </span>
          </label>
        </div>
      </div>

      {/* Details Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="px-4 py-3 rounded-ctl bg-canvas space-y-2">
          <span className="font-[550] text-ink flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-ok" />
            When on (default)
          </span>
          <ul className="space-y-1 text-ink-muted text-[13px] list-disc list-inside">
            <li><strong className="font-medium text-ink-soft">F1–F11</strong> jump instantly to their assigned modules from anywhere.</li>
            <li><strong className="font-medium text-ink-soft">Esc</strong> returns to the central Gateway when no dialog is open.</li>
            <li>Transaction-entry protection automatically guards active inputs and unsaved work.</li>
          </ul>
        </div>

        <div className="px-4 py-3 rounded-ctl bg-canvas space-y-2">
          <span className="font-[550] text-ink flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-warn" />
            When off
          </span>
          <ul className="space-y-1 text-ink-muted text-[13px] list-disc list-inside">
            <li>Global F1–F11 and Esc-to-Gateway page jumps are deactivated.</li>
            <li><strong className="font-medium text-ink-soft">Ctrl+K / Cmd+K</strong> (command palette) remains active.</li>
            <li>Local voucher editor mode keys (F4–F9 within Voucher Desk) continue to function.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

