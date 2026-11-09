"use client";

import React from "react";
import { Keyboard, Check, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useKeyboardNav } from "@/context/KeyboardNavContext";

export function KeyboardPreferencesCard() {
  const { keyboardNavEnabled, toggleKeyboardNav } = useKeyboardNav();

  return (
    <div className="bg-surface border border-line-strong rounded-lg p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand mt-0.5">
            <Keyboard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase text-ink font-mono">
                Keyboard Navigation & Desktop Shortcuts
              </h3>
              <Badge variant={keyboardNavEnabled ? "teal" : "default"}>
                {keyboardNavEnabled ? "Shortcuts Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Control global function keys (F1–F11) and ESC-to-Gateway navigation across Deku Finance.
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
            <div className="w-11 h-6 bg-line-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-2.5 text-xs font-semibold text-ink">
              {keyboardNavEnabled ? "ON" : "OFF"}
            </span>
          </label>
        </div>
      </div>

      {/* Details Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-3 rounded-lg bg-canvas border border-line space-y-2">
          <span className="font-semibold text-ink flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            When Enabled (Default ON)
          </span>
          <ul className="space-y-1 text-ink-muted text-[11px] list-disc list-inside">
            <li><strong>F1–F11</strong> jump instantly to their assigned modules from anywhere.</li>
            <li><strong>ESC</strong> returns to the central Gateway when no dialog is open.</li>
            <li>Transaction-entry protection automatically guards active inputs and unsaved work.</li>
          </ul>
        </div>

        <div className="p-3 rounded-lg bg-canvas border border-line space-y-2">
          <span className="font-semibold text-ink flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            When Disabled (OFF)
          </span>
          <ul className="space-y-1 text-ink-muted text-[11px] list-disc list-inside">
            <li>Global F1–F11 and ESC-to-Gateway page jumps are deactivated.</li>
            <li><strong>Ctrl+K / Cmd+K</strong> (Command Palette) remains active.</li>
            <li>Local voucher editor mode keys (F4–F9 within Voucher Desk) continue to function.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

