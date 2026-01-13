"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Check, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch as UISwitch } from "@/components/ui/switch";
import OnboardingHeader from "./_components/OnboardingHeader";

import AuthBanner from "../auth/_components/AuthBanner";
import { useAuth } from "@/context/AuthContext";

type OnboardingData = {
  businessTypes?: string[];
  business?: { name?: string; phone?: string; address?: string };
  currency?: string;
  customCurrency?: { name?: string; symbol?: string };
  services?: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    price?: number;
  }>;
  availability?: {
    timezone?: string;
    weekStartsOn?: 0 | 1;
    days?: Array<{
      day: number;
      enabled: boolean;
      start?: string;
      end?: string;
    }>;
  };
};

const OTHER_CURRENCY_CODE = "OTHER";

const CURRENCIES: Array<{ code: string; label: string; symbol: string }> = [
  { code: "NIS", label: "NIS (₪)", symbol: "₪" },
  { code: "USD", label: "USD ($)", symbol: "$" },
  { code: "EUR", label: "EUR (€)", symbol: "€" },
  { code: "GBP", label: "GBP (£)", symbol: "£" },
  { code: "AUD", label: "AUD ($)", symbol: "$" },
  { code: "CAD", label: "CAD ($)", symbol: "$" },
  { code: "CHF", label: "CHF (CHF)", symbol: "CHF" },
  { code: OTHER_CURRENCY_CODE, label: "Other", symbol: "" },
];

const ALLOWED_CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

function normalizeCurrency(v: unknown): string {
  const code = String(v ?? "")
    .trim()
    .toUpperCase();
  return ALLOWED_CURRENCY_CODES.has(code) ? code : "NIS";
}

function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "₪";
}

function effectiveCurrencySymbol(data: OnboardingData): string {
  const code = normalizeCurrency(data.currency);
  if (code === OTHER_CURRENCY_CODE) {
    const s = String(data.customCurrency?.symbol ?? "").trim();
    return s || "¤";
  }
  return currencySymbol(code);
}

function currencyLabel(data: OnboardingData): string {
  const code = normalizeCurrency(data.currency);
  if (code === OTHER_CURRENCY_CODE) {
    const name = String(data.customCurrency?.name ?? "").trim();
    const symbol = String(data.customCurrency?.symbol ?? "").trim();
    const left = name || "Other";
    return symbol ? `${left} (${symbol})` : left;
  }
  return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

const BUSINESS_TYPE_OPTIONS: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  { value: "salon", label: "Salon", description: "Hair, beauty, nails" },
  {
    value: "barbershop",
    label: "Barbershop",
    description: "Cuts, shaves, grooming",
  },
  { value: "fitness", label: "Fitness", description: "Training, coaching" },
  { value: "therapy", label: "Therapy", description: "Counseling, wellness" },
  {
    value: "consulting",
    label: "Consulting",
    description: "Advisory services",
  },
  { value: "other", label: "Other", description: "Anything else" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultDays() {
  return DAY_LABELS.map((_, day) => ({
    day,
    enabled: day >= 1 && day <= 5,
    start: "09:00",
    end: "17:00",
  }));
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { updateUser, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [step, setStep] = useState(0);
  const totalSteps = 5;

  const InlineError = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <p className="text-[13px] text-rose-500 dark:text-rose-400 mt-0.5 ml-1">
        {message}
      </p>
    );
  };

  const inputErrorClass = "border-rose-300 ring-1 ring-rose-300/20";

  const [data, setData] = useState<OnboardingData>({
    businessTypes: [],
    business: { name: "", phone: "", address: "" },
    currency: "NIS",
    services: [
      {
        id: crypto.randomUUID(),
        name: "",
        durationMinutes: 30,
        price: undefined,
      },
    ],
    availability: {
      weekStartsOn: 0,
      days: defaultDays(),
    },
  });

  const progress = useMemo(
    () => Math.round(((step + 1) / totalSteps) * 100),
    [step]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch<{
          onboardingCompleted: boolean;
          onboarding: OnboardingData;
        }>("/api/onboarding", { method: "GET" });

        if (cancelled) return;

        if (res.onboardingCompleted) {
          router.replace("/dashboard");
          return;
        }

        setData((prev) => {
          const merged: OnboardingData = {
            ...prev,
            ...(res.onboarding || {}),
            business: { ...prev.business, ...(res.onboarding?.business || {}) },
            availability: {
              ...prev.availability,
              ...(res.onboarding?.availability || {}),
              days:
                res.onboarding?.availability?.days &&
                res.onboarding.availability.days.length
                  ? res.onboarding.availability.days
                  : prev.availability?.days,
            },
            services:
              res.onboarding?.services && res.onboarding.services.length
                ? res.onboarding.services
                : prev.services,
          };

          if (!merged.availability?.days || !merged.availability.days.length) {
            merged.availability = {
              ...(merged.availability || {}),
              days: defaultDays(),
            };
          }

          if (
            (merged.availability as any)?.weekStartsOn !== 0 &&
            (merged.availability as any)?.weekStartsOn !== 1
          ) {
            merged.availability = {
              ...(merged.availability || {}),
              weekStartsOn: 0,
            };
          }

          if (!merged.services || !merged.services.length) {
            merged.services = [
              { id: crypto.randomUUID(), name: "", durationMinutes: 30 },
            ];
          }

          if (!merged.businessTypes) {
            merged.businessTypes = [];
          }

          merged.currency = normalizeCurrency((merged as any).currency);

          return merged;
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load onboarding");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const savePartial = async (partial: Partial<OnboardingData>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{
        onboardingCompleted: boolean;
        onboarding: OnboardingData;
      }>("/api/onboarding", { method: "PATCH", body: JSON.stringify(partial) });
      setData((prev) => ({
        ...prev,
        ...(res.onboarding || {}),
        business: { ...prev.business, ...(res.onboarding?.business || {}) },
        availability: {
          ...prev.availability,
          ...(res.onboarding?.availability || {}),
        },
        services: res.onboarding?.services ?? prev.services,
      }));
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    setFieldErrors({});
    setError(null);
    const newErrors: Record<string, string> = {};

    try {
      if (step === 0) {
        await savePartial({ businessTypes: data.businessTypes });
      }
      if (step === 1) {
        if (!data.business?.name?.trim())
          newErrors.businessName = "Business name is required";
        if (!data.business?.phone?.trim())
          newErrors.businessPhone = "Phone number is required";
        if (!data.business?.address?.trim())
          newErrors.businessAddress = "Address is required";

        if (Object.keys(newErrors).length > 0) {
          setFieldErrors(newErrors);
          return;
        }
        await savePartial({ business: data.business });
      }
      if (step === 2) {
        const currency = normalizeCurrency(data.currency);
        if (currency === OTHER_CURRENCY_CODE) {
          if (!data.customCurrency?.name?.trim())
            newErrors.currencyName = "Currency name is required";
          if (!data.customCurrency?.symbol?.trim())
            newErrors.currencySymbol = "Symbol is required";
        }

        const services = data.services || [];
        if (services.length === 0) {
          setError("At least one service is required");
          return;
        }

        services.forEach((s) => {
          if (!s.name?.trim())
            newErrors[`serviceName_${s.id}`] = "Service name is required";
          if (!s.durationMinutes || s.durationMinutes <= 0)
            newErrors[`serviceDuration_${s.id}`] = "Duration is required";
        });

        if (Object.keys(newErrors).length > 0) {
          setFieldErrors(newErrors);
          return;
        }

        await savePartial({
          services: data.services,
          currency: normalizeCurrency(data.currency),
          customCurrency:
            normalizeCurrency(data.currency) === OTHER_CURRENCY_CODE
              ? {
                  name: String(data.customCurrency?.name ?? "").trim(),
                  symbol: String(data.customCurrency?.symbol ?? "").trim(),
                }
              : undefined,
        });
      }
      if (step === 3) {
        await savePartial({ availability: data.availability });
      }

      setStep((s) => Math.min(s + 1, totalSteps - 1));
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const complete = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>("/api/onboarding/complete", {
        method: "POST",
      });
      updateUser({ onboardingCompleted: true });
      router.replace("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to finish onboarding");
    } finally {
      setSaving(false);
    }
  };

  const content = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Business type
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Choose what best describes you.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Select one or more *</Label>
              <div className="-m-1 grid grid-cols-2 gap-3">
                {BUSINESS_TYPE_OPTIONS.map((opt) => {
                  const selected = (data.businessTypes || []).includes(
                    opt.value
                  );
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setData((d) => {
                          const current = d.businessTypes || [];
                          const next = current.includes(opt.value)
                            ? current.filter((x) => x !== opt.value)
                            : [...current, opt.value];
                          return { ...d, businessTypes: next };
                        });
                      }}
                      className={
                        "m-1 text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 " +
                        (selected
                          ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 shadow-sm"
                          : "border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/30 hover:border-indigo-300 dark:hover:border-indigo-700")
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {opt.label}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {opt.description}
                          </div>
                        </div>
                        <div
                          className={
                            "h-5 w-5 rounded-full border flex items-center justify-center shrink-0 " +
                            (selected
                              ? "border-indigo-500 bg-indigo-500 text-white"
                              : "border-gray-300 dark:border-gray-700")
                          }
                          aria-hidden="true"
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Business details
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Basic info your clients will see.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  className={fieldErrors.businessName ? inputErrorClass : ""}
                  value={data.business?.name || ""}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      business: { ...(d.business || {}), name: e.target.value },
                    }))
                  }
                  placeholder="Acme Studio"
                />
                <InlineError message={fieldErrors.businessName} />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  className={fieldErrors.businessPhone ? inputErrorClass : ""}
                  value={data.business?.phone || ""}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      business: {
                        ...(d.business || {}),
                        phone: e.target.value,
                      },
                    }))
                  }
                  placeholder="+1 (555) 123-4567"
                />
                <InlineError message={fieldErrors.businessPhone} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address *</Label>
                <Input
                  className={fieldErrors.businessAddress ? inputErrorClass : ""}
                  value={data.business?.address || ""}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      business: {
                        ...(d.business || {}),
                        address: e.target.value,
                      },
                    }))
                  }
                  placeholder="123 Main St, City"
                />
                <InlineError message={fieldErrors.businessAddress} />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Services
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Add at least one service.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Label className="flex-1">Service name *</Label>
                <Label className="w-[70px] shrink-0 text-center">Time</Label>
                <Label className="w-[70px] shrink-0 text-center">Price</Label>
                <div className="w-8 shrink-0"></div>
              </div>

              <div className="space-y-3">
                {(data.services || []).map((s) => (
                  <div key={s.id}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <Input
                          className={
                            fieldErrors[`serviceName_${s.id}`]
                              ? inputErrorClass
                              : ""
                          }
                          value={s.name}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).map((x) =>
                                x.id === s.id
                                  ? { ...x, name: e.target.value }
                                  : x
                              ),
                            }))
                          }
                          placeholder="Service"
                        />
                      </div>

                      <div className="w-[70px] shrink-0">
                        <Input
                          type="number"
                          min={5}
                          className={`px-2 text-center ${
                            fieldErrors[`serviceDuration_${s.id}`]
                              ? inputErrorClass
                              : ""
                          }`}
                          value={s.durationMinutes}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      durationMinutes: Number(
                                        e.target.value || 0
                                      ),
                                    }
                                  : x
                              ),
                            }))
                          }
                        />
                      </div>

                      <div className="w-[70px] shrink-0">
                        <Input
                          className={`px-2 text-center ${
                            fieldErrors[`servicePrice_${s.id}`]
                              ? inputErrorClass
                              : ""
                          }`}
                          type="number"
                          min={0}
                          value={typeof s.price === "number" ? s.price : ""}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      price:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    }
                                  : x
                              ),
                            }))
                          }
                          placeholder={effectiveCurrencySymbol(data)}
                        />
                      </div>

                      <div className="w-8 shrink-0 flex pt-1 justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500"
                          disabled={(data.services || []).length <= 1}
                          aria-label="Remove service"
                          onClick={() =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).filter(
                                (x) => x.id !== s.id
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {(fieldErrors[`serviceName_${s.id}`] ||
                      fieldErrors[`serviceDuration_${s.id}`] ||
                      fieldErrors[`servicePrice_${s.id}`]) && (
                      <div className="text-xs text-rose-500 mt-1 px-1">
                        {fieldErrors[`serviceName_${s.id}`] ||
                          fieldErrors[`serviceDuration_${s.id}`] ||
                          fieldErrors[`servicePrice_${s.id}`]}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      services: [
                        ...(d.services || []),
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          durationMinutes: 30,
                        },
                      ],
                    }))
                  }
                >
                  Add service
                </Button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Availability
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Set your weekly hours.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/30 px-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Week starts on
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {(data.availability?.weekStartsOn ?? 0) === 1
                    ? "Monday"
                    : "Sunday"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                  Sun
                </span>
                <UISwitch
                  checked={(data.availability?.weekStartsOn ?? 0) === 1}
                  onCheckedChange={(checked) =>
                    setData((prev) => ({
                      ...prev,
                      availability: {
                        ...(prev.availability || {}),
                        weekStartsOn: checked ? 1 : 0,
                      },
                    }))
                  }
                  aria-label="Toggle week start between Sunday and Monday"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                  Mon
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {(() => {
                const weekStartsOn =
                  (data.availability?.weekStartsOn ?? 0) === 1 ? 1 : 0;
                const days = data.availability?.days || [];
                const byDay = new Map(days.map((d) => [d.day, d] as const));
                const ordered = Array.from(
                  { length: 7 },
                  (_, i) => (i + weekStartsOn) % 7
                )
                  .map((day) => byDay.get(day))
                  .filter(Boolean) as Array<{
                  day: number;
                  enabled: boolean;
                  start?: string;
                  end?: string;
                }>;

                return ordered.map((d) => (
                  <div
                    key={d.day}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 gap-3"
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <UISwitch
                        checked={d.enabled}
                        onCheckedChange={(checked) =>
                          setData((prev) => ({
                            ...prev,
                            availability: {
                              ...(prev.availability || {}),
                              days: (prev.availability?.days || []).map((x) =>
                                x.day === d.day ? { ...x, enabled: checked } : x
                              ),
                            },
                          }))
                        }
                        aria-label={`Toggle ${DAY_LABELS[d.day]}`}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white select-none w-8">
                        {DAY_LABELS[d.day].substring(0, 3)}
                      </span>
                    </div>

                    {d.enabled && (
                      <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                        <Input
                          type="time"
                          className="h-9 px-2 text-sm w-full min-w-[90px] text-center"
                          disabled={!d.enabled}
                          value={d.start || ""}
                          onChange={(e) =>
                            setData((prev) => ({
                              ...prev,
                              availability: {
                                ...(prev.availability || {}),
                                days: (prev.availability?.days || []).map((x) =>
                                  x.day === d.day
                                    ? { ...x, start: e.target.value }
                                    : x
                                ),
                              },
                            }))
                          }
                        />
                        <span className="text-gray-400 shrink-0">–</span>
                        <Input
                          type="time"
                          className="h-9 px-2 text-sm w-full min-w-[90px] text-center"
                          disabled={!d.enabled}
                          value={d.end || ""}
                          onChange={(e) =>
                            setData((prev) => ({
                              ...prev,
                              availability: {
                                ...(prev.availability || {}),
                                days: (prev.availability?.days || []).map((x) =>
                                  x.day === d.day
                                    ? { ...x, end: e.target.value }
                                    : x
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Finish
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Review and complete onboarding.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Business type
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  {data.businessTypes && data.businessTypes.length > 0
                    ? data.businessTypes
                        .map(
                          (v) =>
                            BUSINESS_TYPE_OPTIONS.find((o) => o.value === v)
                              ?.label ?? v
                        )
                        .join(", ")
                    : "—"}
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Business details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <div>
                    <span className="font-medium">Name:</span>{" "}
                    {data.business?.name || "—"}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>{" "}
                    {data.business?.phone || "—"}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-medium">Address:</span>{" "}
                    {data.business?.address || "—"}
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Services
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">Currency:</span>{" "}
                  {currencyLabel(data)}
                </div>

                <div className="space-y-2">
                  {(data.services || []).length ? (
                    (data.services || []).map((s, idx) => (
                      <div
                        key={s.id || idx}
                        className="rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {String(s.name || "").trim() || "—"}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                              Duration:{" "}
                              {Number.isFinite(s.durationMinutes)
                                ? s.durationMinutes
                                : "—"}{" "}
                              min
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">
                            {Number.isFinite(s.price)
                              ? `${effectiveCurrencySymbol(data)}${s.price}`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      —
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Availability
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">Week starts:</span>{" "}
                  {(data.availability?.weekStartsOn ?? 0) === 1
                    ? "Monday"
                    : "Sunday"}
                </div>

                <div className="space-y-2">
                  {(() => {
                    const weekStartsOn =
                      (data.availability?.weekStartsOn ?? 0) === 1 ? 1 : 0;
                    const days = data.availability?.days || [];
                    const byDay = new Map(days.map((d) => [d.day, d] as const));
                    const ordered = Array.from(
                      { length: 7 },
                      (_, i) => (i + weekStartsOn) % 7
                    )
                      .map((day) => byDay.get(day))
                      .filter(Boolean) as Array<{
                      day: number;
                      enabled: boolean;
                      start?: string;
                      end?: string;
                    }>;

                    return ordered.map((d) => (
                      <div
                        key={d.day}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {DAY_LABELS[d.day]}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {d.enabled
                            ? `${d.start || "—"} – ${d.end || "—"}`
                            : "Closed"}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const userInitial = (user?.full_name?.[0] || "U").toUpperCase();

  const card = (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      {/* Header Container */}
      <div className="relative w-full z-0 h-[180px] bg-purple-600 shrink-0">
        <div className="absolute inset-0 opacity-20 bg-[url('/grid.svg')] mix-blend-overlay"></div>
      </div>

      {/* Main Content Area with Convex Curve (Sides lower than center) */}
      <div className="flex-1 -mt-16 bg-gray-50 dark:bg-zinc-900 rounded-t-[40px] relative z-10 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        {/* Logo sitting on the curve */}
        <div className="-mt-10 p-1.5 rounded-full bg-transparent">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-purple-50 shadow-xl">
            <Image
              src="/logo.png"
              alt="Progrr"
              width={48}
              height={48}
              className="object-contain"
            />
          </div>
        </div>

        {/* User & Step Info */}
        <div className="text-center space-y-1 mt-6 mb-8 px-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            {user?.full_name ? `Welcome, ${user.full_name}` : "Welcome"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {step === 0
              ? "Select Business Type"
              : step === 1
              ? "Business Details"
              : step === 2
              ? "Setup Services"
              : step === 3
              ? "Set Availability"
              : "Review & Finish"}
          </p>

          {/* Progress Bar */}
          <div className="pt-5 max-w-xs mx-auto w-full">
            <div className="flex justify-between text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2 px-1">
              <span>
                Step {step + 1} of {totalSteps}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress
              value={progress}
              className="h-2.5 w-full bg-purple-100 dark:bg-purple-900/40 [&>div]:bg-purple-600 rounded-full"
            />
          </div>
        </div>

        <div className="flex-1 px-6 pb-36 w-full max-w-md mx-auto">
          <AuthBanner banner={error ? { type: "error", text: error } : null} />

          <AnimatePresence mode="wait" initial={false}>
            {loading ? (
              <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-purple-600" />
                <p>Loading details...</p>
              </div>
            ) : (
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {content()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 p-4 z-40 shadow-[0_-4px_8px_-1px_rgba(0,0,0,0.02)]">
        <div className="max-w-[420px] mx-auto flex gap-3 w-full">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={back}
              disabled={saving}
              className="h-14 flex-1 rounded-2xl text-lg font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Back
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={next}
              disabled={
                saving ||
                loading ||
                (step === 0 && (data.businessTypes || []).length === 0)
              }
              className="h-14 flex-[2] rounded-2xl text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200/50 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? "Saving…" : "Next"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={complete}
              disabled={saving || loading}
              className="h-14 flex-1 rounded-2xl text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200/50 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? "Finishing…" : "Finish Setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return card;
}
