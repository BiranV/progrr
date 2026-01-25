"use client";

import * as React from "react";

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
      {Array.from({ length: steps }).map((_, index) =>
        index === activeIndex ? (
          <div
            key={`step-${index}`}
            className="w-6 h-2 bg-[#165CF0] rounded-full"
          />
        ) : (
          <div
            key={`step-${index}`}
            className="w-2 h-2 bg-slate-300 rounded-full"
          />
        ),
      )}
    </div>
  );
}
