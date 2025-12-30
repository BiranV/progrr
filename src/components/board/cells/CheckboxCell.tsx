"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface CheckboxCellProps {
  value: boolean;
  onUpdate: (value: boolean) => void;
}

export default function CheckboxCell({ value, onUpdate }: CheckboxCellProps) {
  const isChecked = !!value;

  const handleChange = (checked: boolean) => {
    onUpdate(checked);
  };

  return (
    <div className="flex items-center justify-center h-full w-full">
      <Checkbox
        checked={isChecked}
        onCheckedChange={(checked) => handleChange(checked as boolean)}
        aria-label="Checkbox"
      />
    </div>
  );
}
