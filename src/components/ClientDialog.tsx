"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  "birthDate",
  "gender",
  "height",
  "weight",
  "goal",
  "activityLevel",
  "subscription",
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
    subscription: "",
    status: "active",
    notes: "",
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

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
        subscription: client.subscription || "",
        status: client.status || "active",
        notes: client.notes || "",
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
        subscription: "",
        status: "active",
        notes: "",
      });
    }

    setErrors({});
  }, [client, open]);

  /* ======================================================
     Save
     ====================================================== */
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      if (client) {
        return db.entities.Client.update(client.id, data);
      }
      return db.entities.Client.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    },
  });

  /* ======================================================
     Generic validation
     ====================================================== */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    REQUIRED_FIELDS.forEach((field) => {
      const value = formData[field];
      if (!value || String(value).trim() === "") {
        newErrors[field] = "This field is required";
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    saveMutation.mutate(formData);
  };

  /* ======================================================
     Helpers
     ====================================================== */
  const isRequired = (field: keyof Client) => REQUIRED_FIELDS.includes(field);

  const clearError = (field: keyof Client) => {
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const getInputProps = (field: keyof Client) => ({
    value: formData[field] || "",
    className: errors[field] ? "border-red-500 focus-visible:ring-red-500" : "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      setFormData({ ...formData, [field]: e.target.value });
      clearError(field);
    },
  });

  const getSelectTriggerClass = (field: keyof Client) =>
    errors[field] ? "border-red-500 focus:ring-red-500" : "";

  /* ======================================================
     Render
     ====================================================== */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "Add New Client"}</DialogTitle>
        </DialogHeader>

        {/* Disable native HTML validation */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NAME */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Full Name {isRequired("name") && "*"}
              </label>
              <Input {...getInputProps("name")} />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Email {isRequired("email") && "*"}
              </label>
              <Input type="email" {...getInputProps("email")} />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* PHONE */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Phone {isRequired("phone") && "*"}
              </label>
              <Input {...getInputProps("phone")} />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
              )}
            </div>

            {/* BIRTH DATE */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Birth Date {isRequired("birthDate") && "*"}
              </label>
              <Input type="date" {...getInputProps("birthDate")} />
              {errors.birthDate && (
                <p className="mt-1 text-xs text-red-600">{errors.birthDate}</p>
              )}
            </div>

            {/* GENDER */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Gender {isRequired("gender") && "*"}
              </label>
              <Select
                value={formData.gender}
                onValueChange={(v) => {
                  setFormData({ ...formData, gender: v });
                  clearError("gender");
                }}
              >
                <SelectTrigger
                  className={`w-full ${getSelectTriggerClass("gender")}`}
                >
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="mt-1 text-xs text-red-600">{errors.gender}</p>
              )}
            </div>

            {/* HEIGHT */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Height (cm) {isRequired("height") && "*"}
              </label>
              <Input {...getInputProps("height")} />
              {errors.height && (
                <p className="mt-1 text-xs text-red-600">{errors.height}</p>
              )}
            </div>

            {/* WEIGHT */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Weight (kg) {isRequired("weight") && "*"}
              </label>
              <Input {...getInputProps("weight")} />
              {errors.weight && (
                <p className="mt-1 text-xs text-red-600">{errors.weight}</p>
              )}
            </div>

            {/* GOAL */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Goal {isRequired("goal") && "*"}
              </label>
              <Select
                value={formData.goal}
                onValueChange={(v) => {
                  setFormData({ ...formData, goal: v });
                  clearError("goal");
                }}
              >
                <SelectTrigger
                  className={`w-full ${getSelectTriggerClass("goal")}`}
                >
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
              {errors.goal && (
                <p className="mt-1 text-xs text-red-600">{errors.goal}</p>
              )}
            </div>

            {/* ACTIVITY */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Activity Level {isRequired("activityLevel") && "*"}
              </label>
              <Select
                value={formData.activityLevel}
                onValueChange={(v) => {
                  setFormData({ ...formData, activityLevel: v });
                  clearError("activityLevel");
                }}
              >
                <SelectTrigger
                  className={`w-full ${getSelectTriggerClass("activityLevel")}`}
                >
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
              {errors.activityLevel && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.activityLevel}
                </p>
              )}
            </div>

            {/* SUBSCRIPTION */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Subscription {isRequired("subscription") && "*"}
              </label>
              <Select
                value={formData.subscription}
                onValueChange={(v) => {
                  setFormData({ ...formData, subscription: v });
                  clearError("subscription");
                }}
              >
                <SelectTrigger
                  className={`w-full ${getSelectTriggerClass("subscription")}`}
                >
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
              {errors.subscription && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.subscription}
                </p>
              )}
            </div>

            {/* STATUS */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Status {isRequired("status") && "*"}
              </label>
              <Select
                value={formData.status}
                onValueChange={(v) => {
                  setFormData({ ...formData, status: v });
                  clearError("status");
                }}
              >
                <SelectTrigger
                  className={`w-full ${getSelectTriggerClass("status")}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="mt-1 text-xs text-red-600">{errors.status}</p>
              )}
            </div>

            {/* NOTES (NOT REQUIRED) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Textarea {...getInputProps("notes")} rows={3} />
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
