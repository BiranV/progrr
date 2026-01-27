"use client";

import * as React from "react";
import { useDrag } from "@use-gesture/react";
import { Check, X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  animate,
} from "framer-motion";

const SWIPE_HINT_TEXT = "Swipe an appointment to complete or cancel";

type SwipeableAppointmentCardProps = {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
  threshold?: number;
  showHint?: boolean;
  onHintDismiss?: () => void;
};

export default function SwipeableAppointmentCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
  threshold = 80,
  showHint = false,
  onHintDismiss,
}: SwipeableAppointmentCardProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const [direction, setDirection] = React.useState<"left" | "right" | null>(
    null,
  );
  const [isTouch, setIsTouch] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const isDev = process.env.NODE_ENV !== "production";
  const allowSwipe = isTouch || isDev;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = () => setContainerWidth(node.clientWidth || 0);
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const reset = React.useCallback(() => {
    animate(x, 0, { type: "spring", stiffness: 320, damping: 30 });
    setDirection(null);
  }, [x]);

  const triggerSwipe = React.useCallback(
    (dir: "left" | "right") => {
      if (dir === "left") onSwipeLeft();
      if (dir === "right") onSwipeRight();
      onHintDismiss?.();
      reset();
    },
    [onHintDismiss, onSwipeLeft, onSwipeRight, reset],
  );

  const bind = useDrag(
    ({ active, movement: [mx], last, event }) => {
      if (disabled || !allowSwipe) return;
      const pointerType = (event as PointerEvent)?.pointerType;
      if (pointerType && pointerType !== "touch" && !isDev) return;

      if (active) {
        x.set(mx);
        setDirection(mx > 0 ? "right" : mx < 0 ? "left" : null);
      }
      if (last && !active) {
        const dynamicThreshold =
          containerWidth > 0 ? Math.round(containerWidth * 0.4) : 0;
        const commitThreshold = Math.max(threshold, dynamicThreshold);
        if (Math.abs(mx) >= commitThreshold) {
          triggerSwipe(mx > 0 ? "right" : "left");
        } else {
          reset();
        }
      }
    },
    { axis: "x", filterTaps: true, pointer: { touch: true } },
  );

  const bgClass =
    direction === "right"
      ? "bg-emerald-500/15"
      : direction === "left"
        ? "bg-rose-500/15"
        : "bg-transparent";

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`absolute inset-0 rounded-2xl transition-colors ${bgClass}`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <Check
            className={`h-8 w-8 text-emerald-600 transition-opacity no-rtl-flip ${
              direction === "right" ? "opacity-100" : "opacity-0"
            }`}
          />
          <X
            className={`h-8 w-8 text-rose-600 transition-opacity no-rtl-flip ${
              direction === "left" ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      </div>

      <div
        style={{ touchAction: "pan-y" }}
        className="relative"
        {...bind()}
        onPointerDown={() => onHintDismiss?.()}
      >
        <motion.div style={{ x }} className="relative">
          {children}
        </motion.div>
      </div>

      <AnimatePresence>
        {showHint ? (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onHintDismiss?.()}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <motion.div
                className="absolute left-1/2 top-1/2 h-10 w-32 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/40 bg-white/20"
                animate={{ x: [0, -40, 40, 0] }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              />
              <div className="absolute bottom-3 text-xs text-slate-700 text-center px-3">
                {SWIPE_HINT_TEXT}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
