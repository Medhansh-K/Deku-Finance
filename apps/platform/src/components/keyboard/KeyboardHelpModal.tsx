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
              className="flex items-start justify-between p-2 rounded border border-line bg-canvas text-xs"
            >
              <div>
                <span className="font-bold text-ink block">{sc.label}</span>
                <span className="text-[11px] text-ink-muted">{sc.description}</span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-line text-ink-soft px-1.5 py-0.5 rounded">
                {sc.category}
              </span>
            </div>
          ))}
        </div>

        <div className="p-3 rounded bg-brand/10 border border-brand/30 text-xs text-ink">
          <p className="font-bold mb-1">Voucher Data Entry Pro-Tips:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-ink-soft">
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
