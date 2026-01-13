"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function useBottomNavOffset() {
  const [offset, setOffset] = React.useState<number>(24);

  React.useEffect(() => {
    const DEFAULT_OFFSET = 24;
    const GAP = 12;

    let observedEl: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const compute = () => {
      const el = observedEl ?? document.querySelector<HTMLElement>("[data-bottom-nav]");
      if (!el) {
        setOffset(DEFAULT_OFFSET);
        return;
      }

      // Includes pb-[env(safe-area-inset-bottom)] since it's part of layout box.
      const height = el.getBoundingClientRect().height;
      const next = Math.max(DEFAULT_OFFSET, Math.round(height + GAP));
      setOffset(next);
    };

    const attach = (el: HTMLElement | null) => {
      if (observedEl === el) return;

      ro?.disconnect();
      ro = null;
      observedEl = el;

      if (typeof ResizeObserver !== "undefined" && el) {
        ro = new ResizeObserver(() => compute());
        ro.observe(el);
      }

      compute();
    };

    // Initial attach (might be null if BottomNav isn't mounted on this route yet).
    attach(document.querySelector<HTMLElement>("[data-bottom-nav]"));

    // Watch for BottomNav mounting/unmounting as routes/layouts change.
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(() => {
        const next = document.querySelector<HTMLElement>("[data-bottom-nav]");
        attach(next);
      });

      mo.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener("resize", compute);

    return () => {
      window.removeEventListener("resize", compute);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return offset;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const offset = useBottomNavOffset();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={offset}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg relative",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:absolute group-[.toast]:right-2 group-[.toast]:top-2 group-[.toast]:left-auto",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
