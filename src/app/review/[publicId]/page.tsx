"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";

import { useI18n } from "@/i18n/useI18n";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import OtpInput from "@/components/OtpInput";

const OTP_LENGTH = 6;

type AppointmentInfo = {
  businessName: string;
  appointment: {
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    reviewSubmitted: boolean;
  };
};

export default function PublicReviewPage() {
  const { t } = useI18n();
  const params = useParams();
  const searchParams = useSearchParams();

  const publicId = String((params as any)?.publicId ?? "").trim();
  const appointmentId = String(searchParams.get("appointmentId") ?? "").trim();

  const [info, setInfo] = React.useState<AppointmentInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState("");
  const [verifyToken, setVerifyToken] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [reviewAccessToken, setReviewAccessToken] = React.useState("");
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");

  const [step, setStep] = React.useState<
    "email" | "otp" | "review" | "submitted" | "unavailable"
  >("email");

  const [error, setError] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      if (!publicId || !appointmentId) {
        setLoadError(t("reviewPage.errors.invalidLink"));
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setLoadError(null);
        const res = await fetch(
          `/api/public/reviews/appointment?businessPublicId=${encodeURIComponent(
            publicId,
          )}&appointmentId=${encodeURIComponent(appointmentId)}`,
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || t("errors.failedToLoad"));
        }

        if (!active) return;
        setInfo(json as AppointmentInfo);

        const appt = (json as AppointmentInfo).appointment;
        if (appt.reviewSubmitted) {
          setStep("submitted");
        } else if (String(appt.status || "") !== "COMPLETED") {
          setStep("unavailable");
        }
      } catch (err: any) {
        if (!active) return;
        setLoadError(String(err?.message || t("errors.failedToLoad")));
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [appointmentId, publicId, t]);

  const appointmentSummary = React.useMemo(() => {
    if (!info?.appointment) return "";
    const { serviceName, date, startTime, endTime } = info.appointment;
    const pieces = [
      serviceName,
      date,
      startTime && endTime ? `${startTime}–${endTime}` : "",
    ]
      .map((s) => String(s ?? "").trim())
      .filter(Boolean);
    return pieces.join(" • ");
  }, [info]);

  const requestOtp = async () => {
    if (isSending) return;
    setError(null);
    setIsSending(true);

    try {
      const res = await fetch("/api/public/reviews/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessPublicId: publicId,
          appointmentId,
          email,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || t("errors.failedToSave"));
      }
      setVerifyToken(String(json?.verifyToken ?? ""));
      setOtpCode("");
      setStep("otp");
    } catch (err: any) {
      setError(String(err?.message || t("errors.failedToSave")));
    } finally {
      setIsSending(false);
    }
  };

  const verifyOtp = async () => {
    if (isVerifying) return;
    setError(null);
    setIsVerifying(true);

    try {
      const res = await fetch("/api/public/reviews/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessPublicId: publicId,
          appointmentId,
          verifyToken,
          otp: otpCode,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || t("errors.failedToSave"));
      }
      setReviewAccessToken(String(json?.reviewAccessToken ?? ""));
      setStep("review");
    } catch (err: any) {
      setError(String(err?.message || t("errors.failedToSave")));
    } finally {
      setIsVerifying(false);
    }
  };

  const submitReview = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/public/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewAccessToken,
          rating,
          comment,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || t("errors.failedToSave"));
      }
      setStep("submitted");
    } catch (err: any) {
      setError(String(err?.message || t("errors.failedToSave")));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <CenteredSpinner fullPage />;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewPage.title")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-rose-500">
            {loadError}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t("reviewPage.title")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-300">
          {info?.businessName || t("common.appName")}
        </p>
        {appointmentSummary ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {appointmentSummary}
          </p>
        ) : null}
      </div>

      {step === "submitted" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewPage.thanksTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 dark:text-gray-300">
            {t("reviewPage.thanksDescription")}
          </CardContent>
        </Card>
      ) : null}

      {step === "unavailable" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewPage.unavailableTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 dark:text-gray-300">
            {t("reviewPage.unavailableDescription")}
          </CardContent>
        </Card>
      ) : null}

      {step === "email" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewPage.verifyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t("reviewPage.emailLabel")}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("reviewPage.emailPlaceholder")}
                disabled={isSending}
              />
            </div>
            {error ? (
              <div className="text-sm text-rose-500">{error}</div>
            ) : null}
            <Button
              type="button"
              className="w-full"
              onClick={requestOtp}
              disabled={!email || isSending}
            >
              {isSending ? t("common.sending") : t("reviewPage.sendCode")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "otp" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewPage.codeTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t("reviewPage.codeSent", { email })}
            </p>
            <OtpInput
              id="review-otp"
              name="review-otp"
              value={otpCode}
              onChange={setOtpCode}
              length={OTP_LENGTH}
              disabled={isVerifying}
            />
            {error ? (
              <div className="text-sm text-rose-500">{error}</div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="w-full"
                onClick={verifyOtp}
                disabled={otpCode.length < OTP_LENGTH || isVerifying}
              >
                {isVerifying ? t("common.verifying") : t("reviewPage.verify")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={requestOtp}
                disabled={isSending}
              >
                {isSending ? t("common.sending") : t("reviewPage.resendCode")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "review" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("reviewPage.formTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t("reviewPage.ratingLabel")}
              </div>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = rating >= value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`rounded-full p-1 transition ${
                        selected ? "text-yellow-500" : "text-gray-300"
                      }`}
                      aria-label={t("reviewPage.ratingAria", { rating: value })}
                    >
                      <Star
                        className="h-7 w-7"
                        fill={selected ? "currentColor" : "none"}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t("reviewPage.commentLabel")}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                placeholder={t("reviewPage.commentPlaceholder")}
                disabled={isSubmitting}
              />
            </div>
            {error ? (
              <div className="text-sm text-rose-500">{error}</div>
            ) : null}
            <Button
              type="button"
              className="w-full"
              onClick={submitReview}
              disabled={!rating || isSubmitting}
            >
              {isSubmitting ? t("common.loading") : t("reviewPage.submit")}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
