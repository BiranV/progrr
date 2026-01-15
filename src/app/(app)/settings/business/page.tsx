"use client";

import React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { updateBusiness, useBusiness } from "@/hooks/useBusiness";
import { CenteredSpinner } from "@/components/CenteredSpinner";

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
  const {
    data: business,
    isPending,
    isFetching,
    isError,
    error,
    dataUpdatedAt,
    refetch,
  } = useBusiness();
  const queryClient = useQueryClient();

  const initialRef = React.useRef<BusinessDetailsForm | null>(null);
  const [form, setForm] = React.useState<BusinessDetailsForm>({
    name: "",
    phone: "",
    address: "",
    description: "",
  });
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof BusinessDetailsForm, string>>
  >({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied">("idle");
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!business) return;
    const next: BusinessDetailsForm = {
      name: String(business.name ?? ""),
      phone: String(business.phone ?? ""),
      address: String(business.address ?? ""),
      description: String(business.description ?? ""),
    };

    setForm((currentForm) => {
      // First hydrate.
      if (!initialRef.current) {
        initialRef.current = next;
        return next;
      }

      // Background refresh only when user isn't editing.
      const initialData = initialRef.current;
      const isDirtyNow =
        currentForm.name !== initialData.name ||
        currentForm.phone !== initialData.phone ||
        currentForm.address !== initialData.address ||
        currentForm.description !== initialData.description;

      if (!isDirtyNow && !isSaving) {
        initialRef.current = next;
        return next;
      }

      return currentForm;
    });
  }, [business, isSaving]);

  React.useEffect(() => {
    if (!business) return;
    if (Date.now() - dataUpdatedAt < 2 * 60 * 1000) return;
    refetch();
  }, [business, dataUpdatedAt, refetch]);

  const bookingLink = (() => {
    const publicId = String((business as any)?.publicId ?? "").trim();
    if (!/^\d{5}$/.test(publicId)) return "";
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    return `${origin}/b/${publicId}`;
  })();

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

    if (!next.address.trim()) {
      nextErrors.address = "Address cannot be empty.";
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
      queryClient.setQueryData(["business"], (prev: any) => ({
        ...(prev || {}),
        name: form.name,
        phone: form.phone,
        address: form.address,
        description: form.description,
      }));
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

      setCopyStatus("copied");
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopyStatus("idle");
      }, 3000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const updateField = <K extends keyof BusinessDetailsForm>(
    key: K,
    value: BusinessDetailsForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const showFullPageSpinner = isPending && !business && !initialRef.current;

  const showErrorState =
    !business && !initialRef.current && isError && !isPending && !isFetching;

  return showFullPageSpinner ? (
    <CenteredSpinner fullPage />
  ) : showErrorState ? (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Business details
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Failed to load your business details.
        </p>
      </div>

      <div className="text-sm text-red-600 dark:text-red-400">
        {String((error as any)?.message ?? "Request failed")}
      </div>

      <Button type="button" onClick={() => refetch()}>
        Retry
      </Button>
    </div>
  ) : (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Business details
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Edit your business information.
        </p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {errors.name}
            </p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            type="text"
            required
            placeholder="City, street"
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
          />
          {errors.address ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {errors.address}
            </p>
          ) : null}
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
            <Button
              type="button"
              variant="outline"
              onClick={onCopy}
              disabled={!bookingLink}
            >
              {copyStatus === "copied" ? "Copied!" : "Copy"}
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
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
