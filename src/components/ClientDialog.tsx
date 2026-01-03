"use client";

import React from "react";
import { db } from "@/lib/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

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

const DEFAULT_COUNTRY = "IL";

const GOAL_VALUES = [
  "weight_loss",
  "muscle_gain",
  "maintenance",
  "strength",
  "endurance",
  "recomposition",
  "better_habits",
] as const;

const ACTIVITY_VALUES = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very",
  "extra",
] as const;

function normalizeGoal(value: unknown): (typeof GOAL_VALUES)[number] | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const v = raw.toLowerCase().replace(/\s+/g, "_");
  if ((GOAL_VALUES as readonly string[]).includes(v)) {
    return v as any;
  }

  // Common legacy / human-friendly values
  if (v.includes("loss") || v.includes("cut") || v.includes("fat"))
    return "weight_loss";
  if (v.includes("muscle") || v.includes("gain") || v.includes("bulk"))
    return "muscle_gain";
  if (v.includes("maint")) return "maintenance";
  if (v.includes("strength")) return "strength";
  if (v.includes("endur") || v.includes("cardio")) return "endurance";
  if (v.includes("recomp") || v.includes("recomposition"))
    return "recomposition";
  if (
    v.includes("habit") ||
    v.includes("better_habits") ||
    v.includes("lifestyle")
  )
    return "better_habits";

  return "";
}

function normalizeActivityLevel(
  value: unknown
): (typeof ACTIVITY_VALUES)[number] | "" {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const v = raw.toLowerCase().replace(/\s+/g, "_");
  if ((ACTIVITY_VALUES as readonly string[]).includes(v)) {
    return v as any;
  }

  // Common legacy / human-friendly values
  if (v.includes("sedent")) return "sedentary";
  if (v.includes("light")) return "light";
  if (v.includes("moderate")) return "moderate";
  if (v === "active") return "active";
  if (v.includes("active") && !v.includes("very") && !v.includes("extra")) {
    return "active";
  }
  if (v.includes("extra")) return "extra";
  if (v.includes("very")) return "very";

  return "";
}

function getDialCode(country: string): string {
  try {
    return `+${getCountryCallingCode(country as any)}`;
  } catch {
    return "+972";
  }
}

function getLocale(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en";
}

function getCountryLabel(country: string): string {
  const locale = getLocale();
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(country) || country;
  } catch {
    return country;
  }
}

function splitPhoneForUi(raw: unknown): {
  country: string;
  national: string;
} {
  const v = String(raw ?? "").trim();
  const digitsOnly = (s: string) => s.replace(/\D/g, "");

  if (!v) return { country: DEFAULT_COUNTRY, national: "" };

  // If user pasted an international number, try to parse it and infer country.
  if (v.startsWith("+") || v.startsWith("00")) {
    const formatted = v.startsWith("00") ? `+${digitsOnly(v).slice(2)}` : v;
    const pn = parsePhoneNumberFromString(formatted);
    if (pn) {
      return {
        country: (pn.country as string) || DEFAULT_COUNTRY,
        national: pn.nationalNumber || "",
      };
    }

    // Fallback: keep default country, strip any obvious dial-code prefix.
    const digits = digitsOnly(formatted);
    if (digits.startsWith("972")) {
      let national = digits.slice(3);
      if (national.startsWith("0")) national = national.slice(1);
      return { country: DEFAULT_COUNTRY, national };
    }
    return { country: DEFAULT_COUNTRY, national: digits };
  }

  // Local format fallback (keeps existing IL behavior)
  let national = digitsOnly(v);
  if (national.startsWith("0")) national = national.slice(1);
  return { country: DEFAULT_COUNTRY, national };
}

function buildPhoneValue(country: string, nationalInput: string): string {
  const countryCode = getDialCode(country);
  const digits = String(nationalInput ?? "").replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? digits.slice(1) : digits;
  return normalized ? `${countryCode}${normalized}` : "";
}

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
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );

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
    assignedPlanIds: [],
    assignedMealPlanIds: [],
  });

  const normalizeIdArray = (value: any, fallbackSingle?: any): string[] => {
    const fromArray = Array.isArray(value) ? value : [];
    const fallback = String(fallbackSingle ?? "").trim();
    const merged = [
      ...fromArray.map((v: any) => String(v ?? "").trim()),
      ...(fallback ? [fallback] : []),
    ]
      .map((v) => String(v).trim())
      .filter((v) => v && v !== "none");
    return Array.from(new Set(merged));
  };

  const [phoneCountry, setPhoneCountry] = React.useState(DEFAULT_COUNTRY);
  const [phoneNational, setPhoneNational] = React.useState("");

  const countryOptions = React.useMemo(() => {
    const items = getCountries().map((c) => ({
      country: c,
      label: getCountryLabel(c),
      dial: getDialCode(c),
    }));
    items.sort((a, b) => a.label.localeCompare(b.label));
    return items;
  }, []);

  /* ======================================================
     Init / Reset
     ====================================================== */
  React.useEffect(() => {
    setValidationError(null);
    if (client) {
      const split = splitPhoneForUi(client.phone);
      setPhoneCountry(split.country);
      setPhoneNational(split.national);

      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: buildPhoneValue(split.country, split.national) || "",
        birthDate: client.birthDate || "",
        gender: client.gender || "",
        height: client.height || "",
        weight: client.weight || "",
        goal: normalizeGoal(client.goal) || "",
        activityLevel: normalizeActivityLevel(client.activityLevel) || "",
        status: normalizeStatus(client.status) || "ACTIVE",
        notes: client.notes || "",
        assignedPlanIds: normalizeIdArray(
          (client as any).assignedPlanIds,
          (client as any).assignedPlanId
        ),
        assignedMealPlanIds: normalizeIdArray(
          (client as any).assignedMealPlanIds,
          (client as any).assignedMealPlanId
        ),
        // Keep legacy single-id fields aligned (first selected)
        assignedPlanId: String(
          normalizeIdArray(
            (client as any).assignedPlanIds,
            (client as any).assignedPlanId
          )[0] ?? ""
        ),
        assignedMealPlanId: String(
          normalizeIdArray(
            (client as any).assignedMealPlanIds,
            (client as any).assignedMealPlanId
          )[0] ?? ""
        ),
      });
    } else {
      setPhoneCountry(DEFAULT_COUNTRY);
      setPhoneNational("");

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
        assignedPlanIds: [],
        assignedMealPlanIds: [],
      });
    }
  }, [client, open]);

  const toggleAssignedId = (
    field: "assignedPlanIds" | "assignedMealPlanIds",
    id: string
  ) => {
    const cleanId = String(id ?? "").trim();
    if (!cleanId) return;
    setFormData((prev) => {
      const current = Array.isArray((prev as any)[field])
        ? ((prev as any)[field] as any[]).map((v) => String(v ?? "").trim())
        : [];
      const next = current.includes(cleanId)
        ? current.filter((x) => x !== cleanId)
        : [...current, cleanId];
      const unique = Array.from(new Set(next)).filter((v) => v && v !== "none");

      // Keep legacy single-id fields aligned (first selected)
      const legacyKey =
        field === "assignedPlanIds" ? "assignedPlanId" : "assignedMealPlanId";
      return {
        ...prev,
        [field]: unique,
        [legacyKey]: unique[0] ?? "",
      } as any;
    });
  };

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
      setValidationError(error?.message || "Failed to save client");
    },
  });

  /* ======================================================
     Generic validation
     ====================================================== */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Disable native HTML validation; use banner-only errors (like login)
    setValidationError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const name = String(formData.name ?? "").trim();
    const email = String(formData.email ?? "").trim();
    const phone = String(formData.phone ?? "").trim();

    if (!name) {
      setValidationError("Full name is required");
      return;
    }

    if (!phone) {
      setValidationError("Phone is required");
      return;
    }

    if (!email) {
      setValidationError("Email is required");
      return;
    }

    if (!emailRegex.test(email)) {
      setValidationError("Please enter a valid email address");
      return;
    }

    const normalized = normalizeStatus(formData.status);
    if (!normalized) {
      setValidationError("Status is required");
      return;
    }

    const next = {
      ...formData,
      status: normalized,
      goal: normalizeGoal((formData as any).goal) || "",
      activityLevel:
        normalizeActivityLevel((formData as any).activityLevel) || "",
    };
    const assignedPlanIds = normalizeIdArray(
      (next as any).assignedPlanIds,
      (next as any).assignedPlanId
    );
    const assignedMealPlanIds = normalizeIdArray(
      (next as any).assignedMealPlanIds,
      (next as any).assignedMealPlanId
    );

    saveMutation.mutate({
      ...next,
      assignedPlanIds,
      assignedMealPlanIds,
      // Backward compatibility
      assignedPlanId: assignedPlanIds[0] ?? "",
      assignedMealPlanId: assignedMealPlanIds[0] ?? "",
    });
  };

  /* ======================================================
     Helpers
     ====================================================== */
  const isRequired = (field: keyof Client) => REQUIRED_FIELDS.includes(field);

  const getInputProps = (field: keyof Client) => ({
    value: formData[field] || "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      if (validationError) setValidationError(null);
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

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {validationError ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 min-h-12 py-2">
              <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
                <XCircle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
                  {validationError}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NAME */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name {isRequired("name") && "*"}
              </label>
              <Input {...getInputProps("name")} />
            </div>

            {/* PHONE */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone {isRequired("phone") && "*"}
              </label>
              <div className="flex gap-2">
                <Select
                  value={phoneCountry}
                  onValueChange={(v) => {
                    setPhoneCountry(v);
                    const nextPhone = buildPhoneValue(v, phoneNational);
                    setFormData({ ...formData, phone: nextPhone });
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {countryOptions.map((c) => (
                      <SelectItem key={c.country} value={c.country}>
                        {c.label} ({c.dial})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={phoneNational}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Phone number"
                  onChange={(e) => {
                    if (validationError) setValidationError(null);
                    const raw = e.target.value;

                    // If user pasted a full number, split it.
                    if (
                      raw.includes("+") ||
                      raw.startsWith("00") ||
                      /^(\d{1,4})/.test(raw)
                    ) {
                      const split = splitPhoneForUi(raw);
                      setPhoneCountry(split.country);
                      setPhoneNational(split.national);
                      setFormData({
                        ...formData,
                        phone: buildPhoneValue(split.country, split.national),
                      });
                      return;
                    }

                    setPhoneNational(raw);
                    setFormData({
                      ...formData,
                      phone: buildPhoneValue(phoneCountry, raw),
                    });
                  }}
                />
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email {isRequired("email") && "*"}
              </label>
              <Input type="email" {...getInputProps("email")} />
            </div>

            {/* STATUS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status {isRequired("status") && "*"}
              </label>
              <Select
                value={formData.status}
                onValueChange={(v) => {
                  if (validationError) setValidationError(null);
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
                  <SelectItem value="weight_loss">Fat Loss</SelectItem>
                  <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="endurance">Endurance</SelectItem>
                  <SelectItem value="recomposition">Recomposition</SelectItem>
                  <SelectItem value="better_habits">Better Habits</SelectItem>
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="very">Very Active</SelectItem>
                  <SelectItem value="extra">Extra Active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ASSIGNED WORKOUT PLAN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assigned Workout Plan
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => {
                      if (validationError) setValidationError(null);
                    }}
                  >
                    {Array.isArray(formData.assignedPlanIds) &&
                    formData.assignedPlanIds.length > 0
                      ? `${formData.assignedPlanIds.length} selected`
                      : "None"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] p-3">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {workoutPlans.map((plan: any) => {
                      const id = String(plan.id);
                      const checked = Array.isArray(formData.assignedPlanIds)
                        ? formData.assignedPlanIds.includes(id)
                        : false;
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/40 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              if (validationError) setValidationError(null);
                              toggleAssignedId("assignedPlanIds", id);
                            }}
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                            {plan.name}
                          </span>
                        </label>
                      );
                    })}
                    {workoutPlans.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No workout plans
                      </div>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* ASSIGNED MEAL PLAN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Assigned Meal Plan
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => {
                      if (validationError) setValidationError(null);
                    }}
                  >
                    {Array.isArray(formData.assignedMealPlanIds) &&
                    formData.assignedMealPlanIds.length > 0
                      ? `${formData.assignedMealPlanIds.length} selected`
                      : "None"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] p-3">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {mealPlans.map((plan: any) => {
                      const id = String(plan.id);
                      const checked = Array.isArray(
                        formData.assignedMealPlanIds
                      )
                        ? formData.assignedMealPlanIds.includes(id)
                        : false;
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/40 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              if (validationError) setValidationError(null);
                              toggleAssignedId("assignedMealPlanIds", id);
                            }}
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                            {plan.name}
                          </span>
                        </label>
                      );
                    })}
                    {mealPlans.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        No meal plans
                      </div>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* NOTES (NOT REQUIRED) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
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
