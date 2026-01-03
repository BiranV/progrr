"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createClientAction,
  updateClientAction,
  ClientFormData,
} from "@/app/actions/client-management";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Client } from "@/types";

/* ======================================================
   REQUIRED FIELDS – single source of truth
   (Notes is intentionally NOT here)
   ====================================================== */
const REQUIRED_FIELDS: Array<keyof Client> = [
  "name",
  "email",
  "phone",
  "status",
];

interface ClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClientDialog({
  client,
  open,
  onOpenChange,
}: ClientDialogProps) {
  const queryClient = useQueryClient();

  const { data: workoutPlans = [] } = useQuery({
    queryKey: ["workoutPlans"],
    queryFn: () => db.entities.WorkoutPlan.list(),
  });

  const { data: mealPlans = [] } = useQuery({
    queryKey: ["mealPlans"],
    queryFn: () => db.entities.MealPlan.list(),
  });

  const normalizeStatus = (value: unknown) => {
    const v = String(value ?? "")
      .trim()
      .toUpperCase();
    return v === "ACTIVE" || v === "PENDING" || v === "INACTIVE" ? v : "";
  };

  const todayDateInputValue = React.useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [formData, setFormData] = React.useState<Partial<Client>>({
    name: "",
    email: "",
    phone: "",
    birthDate: "",
    gender: "",
    height: "",
    weight: "",
    goal: "",
    activityLevel: "",
    status: "",
    notes: "",
    assignedPlanId: "",
    assignedMealPlanId: "",
  });

  /* ======================================================
     Init / Reset
     ====================================================== */
  React.useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        birthDate: client.birthDate || "",
        gender: client.gender || "",
        height: client.height || "",
        weight: client.weight || "",
        goal: client.goal || "",
        activityLevel: client.activityLevel || "",
        status: normalizeStatus(client.status) || "ACTIVE",
        notes: client.notes || "",
        assignedPlanId: client.assignedPlanId || "",
        assignedMealPlanId: client.assignedMealPlanId || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        birthDate: "",
        gender: "",
        height: "",
        weight: "",
        goal: "",
        activityLevel: "",
        status: "",
        notes: "",
        assignedPlanId: "",
        assignedMealPlanId: "",
      });
    }
  }, [client, open]);

  /* ======================================================
     Save
     ====================================================== */
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      const payload = data as ClientFormData;
      if (client) {
        return updateClientAction(client.id, payload);
      }
      return createClientAction(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(
        client ? "Client updated successfully" : "Client created successfully"
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to save client: " + error.message);
    },
  });

  /* ======================================================
     Generic validation
     ====================================================== */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const normalized = normalizeStatus(formData.status);
    if (!normalized) {
      toast.error("Please select a client status");
      return;
    }

    const next = { ...formData, status: normalized };
    saveMutation.mutate(next);
  };

  /* ======================================================
     Helpers
     ====================================================== */
  const isRequired = (field: keyof Client) => REQUIRED_FIELDS.includes(field);

  const getInputProps = (field: keyof Client) => ({
    value: formData[field] || "",
    required: isRequired(field),
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      setFormData({ ...formData, [field]: e.target.value });
    },
  });

  /* ======================================================
     Render
     ====================================================== */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "Add New Client"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NAME */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name {isRequired("name") && "*"}
              </label>
              <Input {...getInputProps("name")} />
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email {isRequired("email") && "*"}
              </label>
              <Input
                type="email"
                pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                title="Please enter a valid email address (e.g., user@example.com)"
                {...getInputProps("email")}
              />
            </div>

            {/* PHONE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone {isRequired("phone") && "*"}
              </label>
              <Input {...getInputProps("phone")} />
            </div>

            {/* BIRTH DATE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Birth Date {isRequired("birthDate") && "*"}
              </label>
              <Input
                type="date"
                max={todayDateInputValue}
                {...getInputProps("birthDate")}
              />
            </div>

            {/* GENDER */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gender {isRequired("gender") && "*"}
              </label>
              <Select
                value={formData.gender}
                required={isRequired("gender")}
                onValueChange={(v) => {
                  setFormData({ ...formData, gender: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* HEIGHT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Height (cm) {isRequired("height") && "*"}
              </label>
              <Input {...getInputProps("height")} />
            </div>

            {/* WEIGHT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Weight (kg) {isRequired("weight") && "*"}
              </label>
              <Input {...getInputProps("weight")} />
            </div>

            {/* GOAL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Goal {isRequired("goal") && "*"}
              </label>
              <Select
                value={formData.goal}
                required={isRequired("goal")}
                onValueChange={(v) => {
                  setFormData({ ...formData, goal: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight_loss">Weight Loss</SelectItem>
                  <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="endurance">Endurance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ACTIVITY */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Activity Level {isRequired("activityLevel") && "*"}
              </label>
              <Select
                value={formData.activityLevel}
                required={isRequired("activityLevel")}
                onValueChange={(v) => {
                  setFormData({ ...formData, activityLevel: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select activity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="very">Very Active</SelectItem>
                  <SelectItem value="extra">Extra Active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* STATUS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status {isRequired("status") && "*"}
              </label>
              <Select
                value={formData.status}
                required={isRequired("status")}
                onValueChange={(v) => {
                  setFormData({ ...formData, status: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* NOTES (NOT REQUIRED) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <Textarea {...getInputProps("notes")} rows={3} />
            </div>

            {/* ASSIGNED WORKOUT PLAN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assigned Workout Plan
              </label>
              <Select
                value={formData.assignedPlanId}
                onValueChange={(v) => {
                  setFormData({ ...formData, assignedPlanId: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select workout plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {workoutPlans.map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ASSIGNED MEAL PLAN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assigned Meal Plan
              </label>
              <Select
                value={formData.assignedMealPlanId}
                onValueChange={(v) => {
                  setFormData({ ...formData, assignedMealPlanId: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select meal plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {mealPlans.map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
