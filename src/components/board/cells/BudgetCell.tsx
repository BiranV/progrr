"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface BudgetCellProps {
  value: number;
  onUpdate: (value: number) => void;
  options?: {
    currency?: string;
  };
}

export default function BudgetCell({
  value,
  onUpdate,
  options,
}: BudgetCellProps) {
  const [currentValue, setCurrentValue] = useState<string | number>(value || 0);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currencySymbol = options?.currency === "ILS" ? "₪" : "$";

  useEffect(() => {
    setCurrentValue(value || 0);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const numericValue = parseFloat(currentValue.toString()) || 0;
    if (numericValue !== parseFloat(value?.toString() || "0")) {
      onUpdate(numericValue);
    }
    setCurrentValue(numericValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setCurrentValue(value || 0);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={currentValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-full w-full p-1 border-none focus:ring-1 focus:ring-blue-500 bg-transparent text-sm text-[#323338] dark:text-gray-200"
        step="0.01"
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer h-full w-full flex items-center text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 px-1 rounded"
    >
      {currencySymbol}
      {Number(currentValue).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </div>
  );
}
