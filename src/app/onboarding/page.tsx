"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type OnboardingData = {
    businessType?: string;
    business?: { name?: string; phone?: string; address?: string };
    services?: Array<{ id: string; name: string; durationMinutes: number; price?: number }>;
    availability?: {
        timezone?: string;
        days?: Array<{ day: number; enabled: boolean; start?: string; end?: string }>;
    };
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultDays() {
    return DAY_LABELS.map((_, day) => ({ day, enabled: day >= 1 && day <= 5, start: "09:00", end: "17:00" }));
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

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [step, setStep] = useState(0);
    const totalSteps = 5;

    const [data, setData] = useState<OnboardingData>({
        businessType: "",
        business: { name: "", phone: "", address: "" },
        services: [{ id: crypto.randomUUID(), name: "", durationMinutes: 30, price: undefined }],
        availability: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, days: defaultDays() },
    });

    const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await apiFetch<{ onboardingCompleted: boolean; onboarding: OnboardingData }>(
                    "/api/onboarding",
                    { method: "GET" }
                );

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
                                res.onboarding?.availability?.days && res.onboarding.availability.days.length
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

                    if (!merged.services || !merged.services.length) {
                        merged.services = [{ id: crypto.randomUUID(), name: "", durationMinutes: 30 }];
                    }

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
            const res = await apiFetch<{ onboardingCompleted: boolean; onboarding: OnboardingData }>(
                "/api/onboarding",
                { method: "PATCH", body: JSON.stringify(partial) }
            );
            setData((prev) => ({
                ...prev,
                ...(res.onboarding || {}),
                business: { ...prev.business, ...(res.onboarding?.business || {}) },
                availability: { ...prev.availability, ...(res.onboarding?.availability || {}) },
                services: res.onboarding?.services ?? prev.services,
            }));
        } finally {
            setSaving(false);
        }
    };

    const next = async () => {
        try {
            if (step === 0) {
                await savePartial({ businessType: data.businessType });
            }
            if (step === 1) {
                await savePartial({ business: data.business });
            }
            if (step === 2) {
                await savePartial({ services: data.services });
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
            await apiFetch<{ ok: true }>("/api/onboarding/complete", { method: "POST" });
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
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Business type</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Choose what best describes you.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={data.businessType || ""}
                                onValueChange={(v) => setData((d) => ({ ...d, businessType: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a business type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="salon">Salon</SelectItem>
                                    <SelectItem value="barbershop">Barbershop</SelectItem>
                                    <SelectItem value="fitness">Fitness</SelectItem>
                                    <SelectItem value="therapy">Therapy</SelectItem>
                                    <SelectItem value="consulting">Consulting</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );

            case 1:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Business details</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Tell us the basics.</p>
                        </div>

                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label>Business name</Label>
                                <Input
                                    value={data.business?.name || ""}
                                    onChange={(e) =>
                                        setData((d) => ({
                                            ...d,
                                            business: { ...(d.business || {}), name: e.target.value },
                                        }))
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input
                                    value={data.business?.phone || ""}
                                    onChange={(e) =>
                                        setData((d) => ({
                                            ...d,
                                            business: { ...(d.business || {}), phone: e.target.value },
                                        }))
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Input
                                    value={data.business?.address || ""}
                                    onChange={(e) =>
                                        setData((d) => ({
                                            ...d,
                                            business: { ...(d.business || {}), address: e.target.value },
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Services</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Add what you offer. You can change this later.</p>
                        </div>

                        <div className="space-y-3">
                            {(data.services || []).map((svc, idx) => (
                                <div key={svc.id} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-6">
                                        <Label className="sr-only">Service name</Label>
                                        <Input
                                            placeholder="Service name"
                                            value={svc.name}
                                            onChange={(e) => {
                                                const name = e.target.value;
                                                setData((d) => ({
                                                    ...d,
                                                    services: (d.services || []).map((s) => (s.id === svc.id ? { ...s, name } : s)),
                                                }));
                                            }}
                                        />
                                    </div>

                                    <div className="md:col-span-3">
                                        <Label className="sr-only">Duration</Label>
                                        <Input
                                            type="number"
                                            min={5}
                                            step={5}
                                            placeholder="Minutes"
                                            value={svc.durationMinutes}
                                            onChange={(e) => {
                                                const durationMinutes = Number(e.target.value || 0);
                                                setData((d) => ({
                                                    ...d,
                                                    services: (d.services || []).map((s) =>
                                                        s.id === svc.id ? { ...s, durationMinutes } : s
                                                    ),
                                                }));
                                            }}
                                        />
                                    </div>

                                    <div className="md:col-span-3">
                                        <Label className="sr-only">Price</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            placeholder="Price"
                                            value={svc.price ?? ""}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const price = raw === "" ? undefined : Number(raw);
                                                setData((d) => ({
                                                    ...d,
                                                    services: (d.services || []).map((s) => (s.id === svc.id ? { ...s, price } : s)),
                                                }));
                                            }}
                                        />
                                    </div>

                                    <div className="md:col-span-12 flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            disabled={(data.services || []).length <= 1}
                                            onClick={() => {
                                                setData((d) => ({
                                                    ...d,
                                                    services: (d.services || []).filter((s) => s.id !== svc.id),
                                                }));
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setData((d) => ({
                                            ...d,
                                            services: [
                                                ...(d.services || []),
                                                { id: crypto.randomUUID(), name: "", durationMinutes: 30, price: undefined },
                                            ],
                                        }));
                                    }}
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
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Availability</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Set your typical working hours.</p>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label>Timezone</Label>
                                <Input
                                    value={data.availability?.timezone || ""}
                                    onChange={(e) =>
                                        setData((d) => ({
                                            ...d,
                                            availability: { ...(d.availability || {}), timezone: e.target.value },
                                        }))
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Days</Label>
                                <div className="space-y-2">
                                    {(data.availability?.days || []).map((d) => (
                                        <div
                                            key={d.day}
                                            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30"
                                        >
                                            <div className="w-16 font-medium text-gray-900 dark:text-white">{DAY_LABELS[d.day]}</div>
                                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <input
                                                    type="checkbox"
                                                    checked={d.enabled}
                                                    onChange={(e) => {
                                                        const enabled = e.target.checked;
                                                        setData((state) => ({
                                                            ...state,
                                                            availability: {
                                                                ...(state.availability || {}),
                                                                days: (state.availability?.days || []).map((x) =>
                                                                    x.day === d.day ? { ...x, enabled } : x
                                                                ),
                                                            },
                                                        }));
                                                    }}
                                                />
                                                Available
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="time"
                                                    value={d.start || ""}
                                                    disabled={!d.enabled}
                                                    onChange={(e) => {
                                                        const start = e.target.value;
                                                        setData((state) => ({
                                                            ...state,
                                                            availability: {
                                                                ...(state.availability || {}),
                                                                days: (state.availability?.days || []).map((x) =>
                                                                    x.day === d.day ? { ...x, start } : x
                                                                ),
                                                            },
                                                        }));
                                                    }}
                                                />
                                                <span className="text-sm text-gray-500">to</span>
                                                <Input
                                                    type="time"
                                                    value={d.end || ""}
                                                    disabled={!d.enabled}
                                                    onChange={(e) => {
                                                        const end = e.target.value;
                                                        setData((state) => ({
                                                            ...state,
                                                            availability: {
                                                                ...(state.availability || {}),
                                                                days: (state.availability?.days || []).map((x) =>
                                                                    x.day === d.day ? { ...x, end } : x
                                                                ),
                                                            },
                                                        }));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All set</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Finish onboarding to access your dashboard.</p>
                        </div>

                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white/60 dark:bg-gray-900/30">
                            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                <div><span className="font-medium">Type:</span> {data.businessType || "—"}</div>
                                <div><span className="font-medium">Business:</span> {data.business?.name || "—"}</div>
                                <div><span className="font-medium">Services:</span> {(data.services || []).filter((s) => s.name.trim()).length}</div>
                                <div><span className="font-medium">Timezone:</span> {data.availability?.timezone || "—"}</div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-2rem)] flex items-center justify-center">
                <div className="text-sm text-gray-600 dark:text-gray-300">Loading onboarding…</div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-2rem)] flex items-center justify-center">
            <div className="w-full max-w-2xl">
                <Card className="border-gray-200/60 dark:border-gray-800 bg-white/70 dark:bg-gray-950/40 backdrop-blur">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl">Onboarding</CardTitle>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                                <span>Step {step + 1} of {totalSteps}</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {error ? (
                            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                        ) : null}

                        {content()}

                        <div className="flex items-center justify-between pt-2">
                            <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || saving}>
                                Back
                            </Button>

                            {step < totalSteps - 1 ? (
                                <Button type="button" onClick={next} disabled={saving}>
                                    {saving ? "Saving…" : "Next"}
                                </Button>
                            ) : (
                                <Button type="button" onClick={complete} disabled={saving}>
                                    {saving ? "Finishing…" : "Finish"}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
