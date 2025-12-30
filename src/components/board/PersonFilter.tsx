"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { X, User } from "lucide-react";
import { motion } from "framer-motion";
import { Item } from "@/types";

interface PersonFilterProps {
  items: Item[];
  selectedPeople: string[];
  onChange: (people: string[]) => void;
  onClose: () => void;
}

export default function PersonFilter({
  items,
  selectedPeople,
  onChange,
  onClose,
}: PersonFilterProps) {
  // Extract unique people from items
  // Assuming item.owner is the person's name or ID
  const allPeople = Array.from(
    new Set(items.map((item) => item.owner).filter(Boolean))
  ) as string[];

  const handlePersonChange = (person: string, checked: boolean) => {
    const newPeople = checked
      ? [...selectedPeople, person]
      : selectedPeople.filter((p) => p !== person);
    onChange(newPeople);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 mt-2 z-50"
    >
      <Card className="w-64 shadow-lg border-[#E1E5F3] dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-bold text-[#323338] dark:text-gray-200">
            Filter by Person
          </CardTitle>
          <button
            onClick={onClose}
            className="text-[#676879] hover:text-[#323338] dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {allPeople.length === 0 ? (
            <div className="text-center py-4 text-[#676879] dark:text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No people assigned yet</p>
            </div>
          ) : (
            allPeople.map((person) => (
              <div key={person} className="flex items-center space-x-2">
                <Checkbox
                  id={`person-${person}`}
                  checked={selectedPeople.includes(person)}
                  onCheckedChange={(checked) =>
                    handlePersonChange(person, checked as boolean)
                  }
                />
                <label
                  htmlFor={`person-${person}`}
                  className="flex items-center gap-2 text-sm cursor-pointer flex-1 text-gray-700 dark:text-gray-300"
                >
                  <div className="w-6 h-6 bg-[#0073EA] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {person.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span>{person}</span>
                </label>
              </div>
            ))
          )}

          {selectedPeople.length > 0 && (
            <div className="pt-3 border-t border-[#E1E5F3] dark:border-gray-700">
              <button
                onClick={() => onChange([])}
                className="text-sm text-[#E2445C] hover:underline"
              >
                Clear selection
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
