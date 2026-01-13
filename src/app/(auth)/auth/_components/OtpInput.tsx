"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";

export default function OtpInput({
  id,
  name,
  value,
  onChange,
  length,
  disabled,
  inputClassName,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (nextValue: string) => void;
  length: number;
  disabled?: boolean;
  inputClassName?: string;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const didAutoFocusRef = useRef(false);

  const digits = useMemo(() => {
    const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
    return Array.from({ length }, (_, i) => sanitized[i] ?? "");
  }, [value, length]);

  useEffect(() => {
    if (didAutoFocusRef.current) return;
    if (disabled) return;

    const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
    if (sanitized.length > 0) return;

    const first = inputsRef.current[0];
    if (!first) return;

    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      try {
        first.focus();
      } catch {
        // ignore
      }
    });
  }, [disabled, length, value]);

  const setAtIndex = useCallback(
    (index: number, digit: string) => {
      const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
      const next = sanitized.padEnd(length, " ").split("");
      next[index] = digit;
      const joined = next.join("").replace(/\s/g, "").slice(0, length);
      onChange(joined);
    },
    [length, onChange, value]
  );

  return (
    <div className="flex gap-2">
      <input type="hidden" id={id} name={name} value={digits.join("")} />

      {digits.map((digit, index) => (
        <Input
          key={index}
          aria-label={`Digit ${index + 1}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          value={digit}
          onChange={(e) => {
            const nextDigit = (e.target.value || "").replace(/\D/g, "");
            if (!nextDigit) {
              setAtIndex(index, "");
              return;
            }
            const single = nextDigit.slice(-1);
            setAtIndex(index, single);
            const nextEl = inputsRef.current[index + 1];
            if (nextEl) nextEl.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              if (digit) {
                setAtIndex(index, "");
                return;
              }
              const prevEl = inputsRef.current[index - 1];
              if (prevEl) {
                prevEl.focus();
                setAtIndex(index - 1, "");
              }
            }

            if (e.key === "ArrowLeft") {
              const prevEl = inputsRef.current[index - 1];
              if (prevEl) prevEl.focus();
            }

            if (e.key === "ArrowRight") {
              const nextEl = inputsRef.current[index + 1];
              if (nextEl) nextEl.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            const pasted = (text || "").replace(/\D/g, "");
            if (!pasted) return;

            e.preventDefault();
            const chars = pasted.slice(0, length - index).split("");

            const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
            const next = sanitized.padEnd(length, " ").split("");
            chars.forEach((ch, i) => {
              next[index + i] = ch;
            });
            const joined = next.join("").replace(/\s/g, "").slice(0, length);
            onChange(joined);

            const focusIndex = Math.min(index + chars.length, length - 1);
            const focusEl = inputsRef.current[focusIndex];
            if (focusEl) focusEl.focus();
          }}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          className={`h-12 w-12 sm:h-14 sm:w-14 p-0 text-center text-lg sm:text-xl font-medium ${
            inputClassName || ""
          }`}
        />
      ))}
    </div>
  );
}
