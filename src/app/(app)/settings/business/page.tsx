"use client";

import React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { updateBusiness, useBusiness } from "@/hooks/useBusiness";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import { useI18n } from "@/i18n/useI18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";

type BusinessDetailsForm = {
  name: string;
  phone: string;
  address: string;
  description: string;
  instagram: string;
  whatsapp: string;
};

export default function BusinessDetailsPage() {
  const { t } = useI18n();
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
    instagram: "",
    whatsapp: "",
  });
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof BusinessDetailsForm, string>>
  >({});
  const [isPhoneValid, setIsPhoneValid] = React.useState(true);
  const [isWhatsAppValid, setIsWhatsAppValid] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied">("idle");
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  React.useEffect(() => {
    if (!business) return;
    const next: BusinessDetailsForm = {
      name: String(business.name ?? ""),
      phone: String(business.phone ?? ""),
      address: String(business.address ?? ""),
      description: String(business.description ?? ""),
      instagram: String((business as any).instagram ?? ""),
      whatsapp: String((business as any).whatsapp ?? ""),
    };

    setForm((currentForm) => {
      const isFormEmpty =
        !currentForm.name &&
        !currentForm.phone &&
        !currentForm.address &&
        !currentForm.description &&
        !currentForm.instagram &&
        !currentForm.whatsapp;

      // First hydrate (or recover if form is empty).
      if (!initialRef.current || isFormEmpty) {
        initialRef.current = next;
        return next;
      }

      // Background refresh only when user isn't editing.
      const initialData = initialRef.current;
      const isDirtyNow =
        currentForm.name !== initialData.name ||
        currentForm.phone !== initialData.phone ||
        currentForm.address !== initialData.address ||
        currentForm.description !== initialData.description ||
        currentForm.instagram !== initialData.instagram ||
        currentForm.whatsapp !== initialData.whatsapp;

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
    if (!origin) return "";
    return `${origin}/b/${publicId}`;
  })();

  const initialData = initialRef.current;

  const isDirty =
    !!initialData &&
    (form.name !== initialData.name ||
      form.phone !== initialData.phone ||
      form.address !== initialData.address ||
      form.description !== initialData.description ||
      form.instagram !== initialData.instagram ||
      form.whatsapp !== initialData.whatsapp);

  const validate = React.useCallback(
    (next: BusinessDetailsForm) => {
      const nextErrors: Partial<Record<keyof BusinessDetailsForm, string>> = {};

      if (!next.name.trim()) {
        nextErrors.name = t("errors.businessNameRequired");
      }

      if (!next.phone.trim()) {
        nextErrors.phone = t("errors.businessPhoneRequired");
      } else if (!isPhoneValid) {
        nextErrors.phone = t("errors.businessPhoneInvalid");
      }

      if (next.whatsapp.trim() && !isWhatsAppValid) {
        nextErrors.whatsapp = t("businessDetails.errors.whatsappInvalid");
      }

      return nextErrors;
    },
    [isPhoneValid, isWhatsAppValid, t],
  );

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
        instagram: form.instagram,
        whatsapp: form.whatsapp,
      }));
      toast.success(t("businessDetails.toastSaved"));
    } catch (err: any) {
      toast.error(err?.message || t("errors.failedToSave"));
    } finally {
      setIsSaving(false);
    }
  };

  const onCopy = async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      toast.success(t("businessDetails.toastCopy"));

      setCopyStatus("copied");
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopyStatus("idle");
      }, 3000);
    } catch {
      toast.error(t("businessDetails.toastCopyFailed"));
    }
  };

  const updateField = <K extends keyof BusinessDetailsForm>(
    key: K,
    value: BusinessDetailsForm[K],
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
          {t("settings.businessDetails")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("businessDetails.loadFailed")}
        </p>
      </div>

      <div className="text-sm text-red-600 dark:text-red-400">
        {String((error as any)?.message ?? t("businessDetails.requestFailed"))}
      </div>

      <Button type="button" onClick={() => refetch()}>
        {t("businessDetails.retry")}
      </Button>
    </div>
  ) : (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("settings.businessDetails")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("settings.businessDetailsDesc")}
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="business-name">{t("businessDetails.nameLabel")}</Label>
          <Input
            id="business-name"
            type="text"
            required
            placeholder={t("businessDetails.namePlaceholder")}
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
          <Label htmlFor="phone">{t("businessDetails.phoneLabel")}</Label>
          <PhoneInput
            id="phone"
            required
            value={form.phone}
            onChange={(v) => updateField("phone", v)}
            onValidityChange={setIsPhoneValid}
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp">{t("businessDetails.whatsappLabel")}</Label>
          <PhoneInput
            id="whatsapp"
            value={form.whatsapp}
            onChange={(v) => updateField("whatsapp", v)}
            onValidityChange={setIsWhatsAppValid}
            requireMobile
            aria-invalid={Boolean(errors.whatsapp)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("businessDetails.whatsappHelp")}
          </p>
          {errors.whatsapp ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {errors.whatsapp}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">{t("businessDetails.addressLabel")}</Label>
          <Input
            id="address"
            type="text"
            placeholder={t("businessDetails.addressPlaceholder")}
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("businessDetails.addressHelp")}
          </p>
          {errors.address ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {errors.address}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="instagram">{t("businessDetails.instagramLabel")}</Label>
          <Input
            id="instagram"
            type="text"
            placeholder={t("businessDetails.instagramPlaceholder")}
            // placeholder="@yourbusiness or https://instagram.com/yourbusiness"
            value={form.instagram}
            onChange={(e) => updateField("instagram", e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("businessDetails.instagramHelp")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            {t("businessDetails.descriptionLabel")}
          </Label>
          <Textarea
            id="description"
            placeholder={t("businessDetails.descriptionPlaceholder")}
            maxLength={250}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking-link">
            {t("businessDetails.bookingLinkLabel")}
          </Label>
          <div className="flex gap-2">
            <Input id="booking-link" readOnly value={bookingLink} />
            <Button
              type="button"
              variant="outline"
              onClick={onCopy}
              disabled={!bookingLink}
            >
              {copyStatus === "copied"
                ? t("businessDetails.copied")
                : t("businessDetails.copy")}
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
              t("businessDetails.saveChanges")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
