"use client";

import React from "react";
import { toast } from "sonner";

import { updateBusiness, useBusiness } from "@/hooks/useBusiness";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type BusinessDetailsForm = {
    name: string;
    phone: string;
    address: string;
    description: string;
};

function digitsOnly(value: string) {
    return value.replace(/\D/g, "");
}

export default function BusinessDetailsPage() {
    const { data: business } = useBusiness();

    const initialRef = React.useRef<BusinessDetailsForm | null>(null);
    const [form, setForm] = React.useState<BusinessDetailsForm>({
        name: "",
        phone: "",
        address: "",
        description: "",
    });
    const [errors, setErrors] = React.useState<Partial<Record<keyof BusinessDetailsForm, string>>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (!business) return;
        if (initialRef.current) return;

        const next: BusinessDetailsForm = {
            name: String(business.name ?? ""),
            phone: String(business.phone ?? ""),
            address: String(business.address ?? ""),
            description: String(business.description ?? ""),
        };

        initialRef.current = next;
        setForm(next);
    }, [business]);

    const bookingLink = business?.slug ? `https://www.progrr.io/b/${business.slug}` : "";

    const initialData = initialRef.current;

    const isDirty =
        !!initialData &&
        (form.name !== initialData.name ||
            form.phone !== initialData.phone ||
            form.address !== initialData.address ||
            form.description !== initialData.description);

    const validate = React.useCallback((next: BusinessDetailsForm) => {
        const nextErrors: Partial<Record<keyof BusinessDetailsForm, string>> = {};

        if (!next.name.trim()) {
            nextErrors.name = "Business name cannot be empty.";
        }

        if (digitsOnly(next.phone).length < 9) {
            nextErrors.phone = "Phone number must have at least 9 digits.";
        }

        return nextErrors;
    }, []);

    const onSave = async () => {
        const nextErrors = validate(form);
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) return;
        if (!initialRef.current) return;

        setIsSaving(true);
        try {
            await updateBusiness(form);
            initialRef.current = { ...form };
            toast.success("Changes saved");
        } catch (err: any) {
            toast.error(err?.message || "Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    const onCopy = async () => {
        if (!bookingLink) return;
        try {
            await navigator.clipboard.writeText(bookingLink);
            toast.success("Copied");
        } catch {
            toast.error("Failed to copy");
        }
    };

    const updateField = <K extends keyof BusinessDetailsForm>(key: K, value: BusinessDetailsForm[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _removed, ...rest } = prev;
            return rest;
        });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business details</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">Edit your business information.</p>
            </div>

            <div className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="business-name">Business name</Label>
                    <Input
                        id="business-name"
                        type="text"
                        required
                        placeholder="Your business name"
                        value={form.name}
                        onChange={(e) => updateField("name", e.target.value)}
                    />
                    {errors.name ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{errors.name}</p>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                        id="phone"
                        type="tel"
                        required
                        placeholder="0501234567"
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                    />
                    {errors.phone ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{errors.phone}</p>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                        id="address"
                        type="text"
                        placeholder="City, street (optional)"
                        value={form.address}
                        onChange={(e) => updateField("address", e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="Short description of your business"
                        maxLength={250}
                        value={form.description}
                        onChange={(e) => updateField("description", e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="booking-link">Public booking link</Label>
                    <div className="flex gap-2">
                        <Input id="booking-link" readOnly value={bookingLink} />
                        <Button type="button" variant="outline" onClick={onCopy}>
                            Copy
                        </Button>
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        type="button"
                        className="w-full"
                        onClick={onSave}
                        disabled={!isDirty || isSaving || !initialRef.current}
                    >
                        {isSaving ? "Saving…" : "Save changes"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
