"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (typeof window === "undefined") return null;
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-void-950/60 backdrop-blur-[2px] animate-[fadeIn_150ms_ease]"
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-grow-in max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-display font-semibold">{title}</h2>}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto h-8 w-8 flex items-center justify-center rounded-full hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
