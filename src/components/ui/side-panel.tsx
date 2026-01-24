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
  showCloseButton?: boolean;
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
  showCloseButton = true,
  className,
  contentClassName,
  widthClassName,
}: SidePanelProps) {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);
  const touchDeltaRef = React.useRef<number>(0);

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

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchDeltaRef.current = 0;
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (touchStartYRef.current == null) return;
    const currentY = event.touches[0]?.clientY ?? 0;
    touchDeltaRef.current = currentY - touchStartYRef.current;
  };

  const handleTouchEnd = () => {
    const delta = touchDeltaRef.current;
    const scrollTop = contentRef.current?.scrollTop ?? 0;
    if (delta > 80 && scrollTop <= 0) {
      onOpenChange(false);
    }
    touchStartYRef.current = null;
    touchDeltaRef.current = 0;
  };

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
          "absolute inset-x-0 bottom-0 flex w-full flex-col rounded-t-2xl border-t bg-background shadow-2xl max-h-[82dvh]",
          "sm:inset-y-0 sm:end-0 sm:inset-x-auto sm:h-full sm:max-h-[100dvh] sm:rounded-none sm:border-t-0 sm:border-s",
          "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200 ease-out",
          "max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
          "sm:data-[state=open]:slide-in-from-right sm:rtl:data-[state=open]:slide-in-from-left",
          "sm:data-[state=closed]:slide-out-to-right sm:rtl:data-[state=closed]:slide-out-to-left",
          "overflow-hidden",
          widthClassName ?? "w-full sm:w-[480px] lg:w-[560px]",
          "dark:bg-gray-900",
          contentClassName
        )}
        data-state="open"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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

          {showCloseButton ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-scroll px-4 pt-4 pb-[calc(var(--bottom-nav-height)+16px+env(safe-area-inset-bottom))] sm:px-5"
        >
          {children}
        </div>

        {footer ? (
          <div
            className="border-t px-4 pt-4 sm:px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
