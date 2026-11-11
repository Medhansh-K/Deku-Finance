import React from "react";
import { Modal } from "@/components/ui/Modal";
import { STANDARD_SHORTCUTS } from "@/lib/keyboard/shortcuts";

export interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KBD =
  "font-mono text-[11px] leading-none px-1.5 pt-[3px] pb-[2px] rounded-[5px] border border-line-strong border-b-2 bg-surface text-ink-muted whitespace-nowrap";

export function KeyboardHelpModal({ isOpen, onClose }: KeyboardHelpModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Work through Deku Finance from the keyboard, without reaching for the mouse"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {STANDARD_SHORTCUTS.map((sc, i) => {
            // Labels read "Keys: Name"; show the keys as a key cap.
            const [keys, name] = sc.label.split(/:\s(.+)/);
            return (
              <div
                key={i}
                className="flex items-start justify-between gap-3 px-2.5 py-2 rounded-[8px] hover:bg-canvas"
              >
                <div className="min-w-0">
                  <span className="text-[14px] font-[550] text-ink block">{name ?? sc.label}</span>
                  <span className="text-[12.5px] text-ink-muted">{sc.description}</span>
                </div>
                {name && <kbd className={`${KBD} mt-0.5 shrink-0`}>{keys}</kbd>}
              </div>
            );
          })}
        </div>

        <div className="p-4 rounded-panel bg-brand-wash text-[13px] text-ink">
          <p className="font-semibold mb-1.5">Voucher entry tips</p>
          <ul className="space-y-1.5 text-ink-soft">
            <li>Press <kbd className={KBD}>Enter</kbd> to advance from field to field or account selection.</li>
            <li>Press <kbd className={KBD}>Tab</kbd> or <kbd className={KBD}>Shift+Tab</kbd> to navigate backwards.</li>
            <li>Press <kbd className={KBD}>Esc</kbd> to cancel, close dialogs, or step back to the Gateway.</li>
            <li>Use <kbd className={KBD}>Alt+G</kbd> or <kbd className={KBD}>Ctrl+K</kbd> to jump directly to any report or ledger from anywhere.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
