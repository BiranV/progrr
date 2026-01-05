"use client";

import * as React from "react";

type RefetchOnVisibleOptions = {
  enabled?: boolean;
};

/**
 * Runs `onVisible` exactly when the document transitions to `visible`.
 * Event-based (no polling).
 */
export function useRefetchOnVisible(
  onVisible: () => void | Promise<void>,
  options?: RefetchOnVisibleOptions
) {
  const enabled = options?.enabled ?? true;

  const onVisibleRef = React.useRef(onVisible);
  React.useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  React.useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    const handler = () => {
      if (document.visibilityState !== "visible") return;
      void onVisibleRef.current();
    };

    document.addEventListener("visibilitychange", handler);

    return () => {
      document.removeEventListener("visibilitychange", handler);
    };
  }, [enabled]);
}
