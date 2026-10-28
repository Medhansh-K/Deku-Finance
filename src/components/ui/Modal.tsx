import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Keyboard and screen-reader users land inside the dialog, not behind it.
  useEffect(() => {
    if (isOpen) modalRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dim backdrop */}
      <div
        className="fixed inset-0 bg-panel-deep/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Window */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`relative z-10 w-full ${widthClasses[maxWidth]} rounded-xl border border-line bg-surface shadow-pop overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h3 id="modal-title" className="text-base font-semibold tracking-tight text-ink">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-ink-muted mt-1">{description}</p>
            )}
          </div>
          <button
            suppressHydrationWarning
            onClick={onClose}
            className="rounded-md p-1 text-ink-subtle hover:text-ink hover:bg-canvas-sunken transition-colors"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 bg-surface max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
