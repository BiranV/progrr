"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

export default function PublicDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { slug } = React.use(params);
  const raw = String(slug ?? "").trim();
  const isPublicId = /^\d{5}$/.test(raw);

  const serviceId = String(searchParams.get("serviceId") ?? "").trim();
  const date = String(searchParams.get("date") ?? "").trim();
  const time = String(searchParams.get("time") ?? "").trim();

  const { data: business, resolvedPublicId } = usePublicBusiness(raw);

  React.useEffect(() => {
    if (!raw) return;
    if (isPublicId) return;
    if (!resolvedPublicId) return;

    const qs = new URLSearchParams();
    if (serviceId) qs.set("serviceId", serviceId);
    if (date) qs.set("date", date);
    if (time) qs.set("time", time);
    const qsString = qs.toString();
    router.replace(
      `/b/${encodeURIComponent(resolvedPublicId)}/details${
        qsString ? `?${qsString}` : ""
      }`
    );
  }, [date, isPublicId, raw, resolvedPublicId, router, serviceId, time]);

  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!raw) {
      router.replace("/");
      return;
    }

    if (!isPublicId) {
      return;
    }

    if (!serviceId) {
      router.replace(`/b/${encodeURIComponent(raw)}`);
      return;
    }

    if (!date) {
      router.replace(
        `/b/${encodeURIComponent(raw)}/calendar?serviceId=${encodeURIComponent(
          serviceId
        )}`
      );
      return;
    }

    if (!time) {
      router.replace(
        `/b/${encodeURIComponent(raw)}/times?serviceId=${encodeURIComponent(
          serviceId
        )}&date=${encodeURIComponent(date)}`
      );
      return;
    }
  }, [date, isPublicId, raw, router, serviceId, time]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const draft: BookingDraft = {
        businessPublicId: raw,
        serviceId,
        date,
        startTime: time,
        customerFullName: fullName.trim(),
        customerPhone: phone.trim(),
        notes: notes.trim() || undefined,
      };

      if (!draft.customerFullName) throw new Error("Full Name is required");
      if (!draft.customerPhone) throw new Error("Phone is required");

      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

      const res = await fetch("/api/public/booking/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: draft.customerPhone }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      router.push(
        `/b/${encodeURIComponent(raw)}/verify?phone=${encodeURIComponent(
          draft.customerPhone
        )}`
      );
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicBookingShell
      business={business}
      title="Your details"
      subtitle={date && time ? `${date} • ${time}` : "Tell us who you are"}
      onBack={() =>
        router.replace(
          `/b/${encodeURIComponent(raw)}/times?serviceId=${encodeURIComponent(
            serviceId
          )}&date=${encodeURIComponent(date)}`
        )
      }
      showGallery={false}
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            className="rounded-2xl"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            className="rounded-2xl"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            className="rounded-2xl"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() =>
              router.replace(
                `/b/${encodeURIComponent(
                  raw
                )}/times?serviceId=${encodeURIComponent(
                  serviceId
                )}&date=${encodeURIComponent(date)}`
              )
            }
          >
            Back
          </Button>

          <Button
            onClick={submit}
            disabled={submitting}
            className="rounded-2xl flex-1"
          >
            {submitting ? "Sending code…" : "Verify phone"}
          </Button>
        </div>
      </div>
    </PublicBookingShell>
  );
}
