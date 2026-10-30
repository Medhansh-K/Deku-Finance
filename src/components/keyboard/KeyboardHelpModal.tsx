import React from "react";
import { Modal } from "@/components/ui/Modal";
import { STANDARD_SHORTCUTS } from "@/lib/keyboard/shortcuts";

export interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardHelpModal({ isOpen, onClose }: KeyboardHelpModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Accounting Keyboard Shortcut Index"
      description="Deku Finance supports direct desktop muscle memory without touching the mouse"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STANDARD_SHORTCUTS.map((sc, i) => (
            <div
              key={i}
              className="flex items-start justify-between p-2 rounded border border-slate-200 dark:border-[#1A2E44] bg-slate-50 dark:bg-[#07111E] text-xs"
            >
              <div>
                <span className="font-bold text-[#0F172A] dark:text-slate-200 block">{sc.label}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{sc.description}</span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-slate-200 dark:bg-[#1A2E44] text-slate-700 dark:text-[#91D7D2] px-1.5 py-0.5 rounded">
                {sc.category}
              </span>
            </div>
          ))}
        </div>

        <div className="p-3 rounded bg-[#5BB5BB]/10 border border-[#5BB5BB]/30 text-xs text-[#1F2324] dark:text-slate-200">
          <p className="font-bold mb-1">Voucher Data Entry Pro-Tips:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
            <li>Press <strong>Enter</strong> to advance from field to field or account selection.</li>
            <li>Press <strong>Tab</strong> or <strong>Shift+Tab</strong> to navigate backwards.</li>
            <li>Press <strong>Esc</strong> to cancel, close dialogs, or step back to the Gateway.</li>
            <li>Use <strong>Alt+G</strong> or <strong>Ctrl+K</strong> to jump directly to any report or ledger from anywhere.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
