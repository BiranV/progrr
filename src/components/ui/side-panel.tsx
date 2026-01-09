"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOutsideClick?: boolean;
  className?: string;
  contentClassName?: string;
  widthClassName?: string;
};

export default function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeOnOutsideClick = true,
  className,
  contentClassName,
  widthClassName,
}: SidePanelProps) {
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 z-50 h-[100dvh]", className)}>
      {/* Backdrop (click to close) */}
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 cursor-pointer bg-black/10 dark:bg-black/30 focus:outline-none"
        onClick={() => {
          if (closeOnOutsideClick) onOpenChange(false);
        }}
      />

      <div
        role="dialog"
        aria-modal={false}
        className={cn(
          "absolute inset-y-0 right-0 flex h-full max-h-[100dvh] flex-col border-l bg-background shadow-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          widthClassName ?? "w-full sm:w-[480px] lg:w-[560px]",
          "dark:bg-gray-900",
          contentClassName
        )}
        data-state="open"
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <div className="text-base font-semibold text-foreground truncate">
                {title}
              </div>
            ) : null}
            {description ? (
              <div className="mt-1 text-sm text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>

        {footer ? (
          <div className="border-t px-4 pt-4 sm:px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
