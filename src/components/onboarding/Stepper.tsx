"use client";

import * as React from "react";
import clsx from "clsx";

export default function Stepper({
  totalSteps,
  currentStep,
}: {
  totalSteps: number;
  currentStep: number;
}) {
  const steps = Math.max(0, totalSteps);
  const activeIndex = Math.min(Math.max(currentStep, 0), steps - 1);

  return (
    <div className="flex justify-center gap-2 pt-6">
      {Array.from({ length: steps }).map((_, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={`step-${index}`}
            className={clsx(
              "h-2 rounded-full transition-all duration-300 ease-out",
              isActive
                ? "w-6 bg-[#165CF0]"
                : "w-2 bg-slate-300"
            )}
          />
        );
      })}
    </div>
  );
}
