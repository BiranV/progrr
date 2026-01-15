"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PublicBookingShell from "../_components/PublicBookingShell";
import { usePublicBusiness } from "../_components/usePublicBusiness";

type BookingDraft = {
  businessPublicId: string;
  serviceId: string;
  date: string;
  startTime: string;
  customerFullName: string;
  customerPhone: string;
  notes?: string;
};

const DRAFT_KEY = "progrr.bookingDraft.v1";
const RESULT_KEY = "progrr.bookingResult.v1";

export default function PublicVerifyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { slug } = React.use(params);
  const raw = String(slug ?? "").trim();
  const isPublicId = /^\d{5}$/.test(raw);

  const phone = String(searchParams.get("phone") ?? "").trim();

  const { data: business, resolvedPublicId } = usePublicBusiness(raw);

  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadDraft = (): BookingDraft | null => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as any;
      const businessPublicId = String(
        parsed?.businessPublicId ?? parsed?.businessSlug ?? ""
      ).trim();
      return {
        businessPublicId,
        serviceId: String(parsed?.serviceId ?? "").trim(),
        date: String(parsed?.date ?? "").trim(),
        startTime: String(parsed?.startTime ?? "").trim(),
        customerFullName: String(parsed?.customerFullName ?? "").trim(),
        customerPhone: String(parsed?.customerPhone ?? "").trim(),
        notes:
          typeof parsed?.notes === "string" ? parsed.notes.trim() : undefined,
      };
    } catch {
      return null;
    }
  };

  React.useEffect(() => {
    if (!raw) return;
    if (isPublicId) return;
    if (!resolvedPublicId) return;

    const qs = new URLSearchParams();
    if (phone) qs.set("phone", phone);
    const qsString = qs.toString();
    router.replace(
      `/b/${encodeURIComponent(resolvedPublicId)}/verify${
        qsString ? `?${qsString}` : ""
      }`
    );
  }, [isPublicId, phone, raw, resolvedPublicId, router]);

  React.useEffect(() => {
    const draft = loadDraft();
    if (!draft) {
      router.replace(`/b/${encodeURIComponent(raw)}`);
      return;
    }

    if (!isPublicId) {
      return;
    }

    if (!phone) {
      router.replace(
        `/b/${encodeURIComponent(raw)}/details?serviceId=${encodeURIComponent(
          draft.serviceId
        )}&date=${encodeURIComponent(draft.date)}&time=${encodeURIComponent(
          draft.startTime
        )}`
      );
      return;
    }
  }, [isPublicId, phone, raw, router]);

  const verifyAndConfirm = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const draft = loadDraft();
      if (!draft) throw new Error("Missing booking details");

      if (!/^\d{5}$/.test(raw)) throw new Error("Business not found");

      const verifyRes = await fetch("/api/public/booking/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });

      const verifyJson = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok)
        throw new Error(
          verifyJson?.error || `Request failed (${verifyRes.status})`
        );

      const bookingSessionId = String(
        verifyJson?.bookingSessionId ?? ""
      ).trim();
      if (!bookingSessionId) throw new Error("Verification failed");

      const confirmRes = await fetch("/api/public/booking/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          businessPublicId: raw,
          bookingSessionId,
        }),
      });

      const confirmJson = await confirmRes.json().catch(() => null);
      if (!confirmRes.ok)
        throw new Error(
          confirmJson?.error || `Request failed (${confirmRes.status})`
        );

      sessionStorage.setItem(RESULT_KEY, JSON.stringify(confirmJson));
      sessionStorage.removeItem(DRAFT_KEY);

      router.replace(`/b/${encodeURIComponent(raw)}/success`);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/booking/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicBookingShell
      business={business}
      title="Verify phone"
      subtitle={phone ? `We sent a code to ${phone}` : "Enter the code"}
      onBack={() => router.back()}
      showGallery={false}
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <Input
          className="rounded-2xl"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter 6-digit code"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={resend}
            disabled={submitting}
          >
            Resend
          </Button>

          <Button
            className="rounded-2xl flex-1"
            onClick={verifyAndConfirm}
            disabled={submitting || code.trim().length < 4}
          >
            {submitting ? "Confirming…" : "Confirm booking"}
          </Button>
        </div>
      </div>
    </PublicBookingShell>
  );
}
