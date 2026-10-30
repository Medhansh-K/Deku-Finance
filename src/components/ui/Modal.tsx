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
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Window */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 w-full ${widthClasses[maxWidth]} rounded-lg border border-[#3E4848] bg-white dark:bg-[#0B1522] shadow-2xl overflow-hidden`}
      >
        {/* Header with Dark Obsidian Accent */}
        <div className="flex items-center justify-between border-b border-[#3E4848] bg-[#1F2324] px-4 py-3 text-white">
          <div>
            <h3 id="modal-title" className="text-sm font-bold tracking-wide">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[#91D7D2]/80 mt-0.5">{description}</p>
            )}
          </div>
          <button
            suppressHydrationWarning
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 bg-white dark:bg-[#0B1522] max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
