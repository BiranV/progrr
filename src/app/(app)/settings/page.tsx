"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";

function SettingsRowContent({
  title,
  description,
  destructive = false,
}: {
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  const { dir } = useLocale();
  const ChevronIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <>
      <div className="min-w-0">
        <div
          className={
            "text-sm font-medium truncate " +
            (destructive ? "text-destructive" : "text-foreground")
          }
        >
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 text-xs text-muted-foreground truncate">
            {description}
          </div>
        ) : null}
      </div>

      <ChevronIcon
        className={
          "h-4 w-4 shrink-0 text-muted-foreground" +
          (destructive ? " opacity-70" : "")
        }
      />
    </>
  );
}

function SettingsLinkRow({
  href,
  title,
  description,
  destructive = false,
}: {
  href: string;
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex items-center justify-between gap-4 py-3 focus:outline-none cursor-pointer hover:bg-muted" +
        (destructive ? "" : "")
      }
    >
      <SettingsRowContent
        title={title}
        description={description}
        destructive={destructive}
      />
    </Link>
  );
}

function SettingsActionRow({
  onActivate,
  title,
  description,
  destructive = false,
}: {
  onActivate: () => void;
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  const { dir } = useLocale();
  return (
    // A11y: use native button semantics instead of role="button".
    <button
      type="button"
      onClick={onActivate}
      className={
        "flex w-full items-start justify-between gap-4 py-3 focus:outline-none cursor-pointer hover:bg-muted " +
        (dir === "rtl" ? "text-right" : "text-left") +
        (destructive ? "" : "")
      }
    >
      <SettingsRowContent
        title={title}
        description={description}
        destructive={destructive}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { logout, setSessionUser } = useAuth();
  const { language, setLanguage } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoggingOutRef = React.useRef(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [exportPending, setExportPending] = React.useState(false);

  const onLogout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await logout(false);
      await queryClient.cancelQueries();
      queryClient.clear();
    } finally {
      router.replace("/auth");
      isLoggingOutRef.current = false;
    }
  };

  const onDeleteAccount = async () => {
    if (deletePending) return;
    setDeletePending(true);

    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      // Clear all client-side state/caches.
      setSessionUser(null);
      await queryClient.cancelQueries();
      queryClient.clear();

      router.replace("/auth/goodbye");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete account");
    } finally {
      setDeletePending(false);
    }
  };

  const onDownloadData = async () => {
    if (exportPending) return;
    setExportPending(true);
    try {
      const [onboardingRes, businessRes, customersRes, meRes] = await Promise.all([
        fetch("/api/onboarding", { method: "GET" }),
        fetch("/api/business", { method: "GET" }),
        fetch("/api/customers", { method: "GET" }),
        fetch("/api/me", { method: "GET" }),
      ]);

      const onboardingPayload = onboardingRes.ok
        ? await onboardingRes.json().catch(() => null)
        : null;
      const businessPayload = businessRes.ok
        ? await businessRes.json().catch(() => null)
        : null;
      const customersPayload = customersRes.ok
        ? await customersRes.json().catch(() => null)
        : null;
      const mePayload = meRes.ok ? await meRes.json().catch(() => null) : null;

      const onboarding = onboardingPayload && typeof onboardingPayload === "object"
        ? (onboardingPayload as any).onboarding
        : null;

      const services = Array.isArray(onboarding?.services)
        ? onboarding.services.map((s: any) => ({
          id: String(s?.id ?? "").trim(),
          name: String(s?.name ?? "").trim(),
          durationMinutes: Number(s?.durationMinutes),
          price: typeof s?.price === "number" ? s.price : Number(s?.price) || 0,
          description: typeof s?.description === "string" ? s.description : undefined,
          isActive: s?.isActive !== false,
        }))
        : [];

      const availability = onboarding?.availability
        ? {
          timezone: String(onboarding?.availability?.timezone ?? "").trim(),
          weekStartsOn:
            onboarding?.availability?.weekStartsOn === 0 ||
              onboarding?.availability?.weekStartsOn === 1
              ? onboarding.availability.weekStartsOn
              : undefined,
          days: Array.isArray(onboarding?.availability?.days)
            ? onboarding.availability.days.map((d: any) => ({
              day: Number(d?.day),
              enabled: Boolean(d?.enabled),
              ranges: Array.isArray(d?.ranges)
                ? d.ranges.map((r: any) => ({
                  start: String(r?.start ?? "").trim(),
                  end: String(r?.end ?? "").trim(),
                }))
                : undefined,
            }))
            : [],
        }
        : { timezone: "", days: [] };

      const customers = Array.isArray(customersPayload?.customers)
        ? customersPayload.customers.map((c: any) => ({
          externalId: String(c?._id ?? "").trim(),
          fullName: String(c?.fullName ?? "").trim(),
          phone: String(c?.phone ?? "").trim(),
          email: String(c?.email ?? "").trim() || undefined,
          status: String(c?.status ?? "ACTIVE"),
          activeBookingsCount: Number(c?.activeBookingsCount ?? 0),
          lastAppointmentAt: c?.lastAppointmentAt,
          createdAt: c?.createdAt,
        }))
        : [];

      const payload = {
        exportMeta: {
          exportVersion: 1,
          exportedAt: new Date().toISOString(),
        },
        business: businessPayload ?? null,
        services,
        availability,
        customers,
        system: {
          subscriptionStatus: mePayload?.business?.subscriptionStatus,
          trialStartAt: mePayload?.business?.trialStartAt,
          trialEndAt: mePayload?.business?.trialEndAt,
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "progrr-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Failed to export data");
    } finally {
      setExportPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Manage your business configuration.
        </p>
      </div>

      {/* Section 1: Business */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Business</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsLinkRow
              href="/settings/business"
              title="Business details"
              description="Edit your business information"
            />
            <SettingsLinkRow
              href="/settings/opening-hours"
              title="Booking & hours"
              description="Opening hours and booking rules"
            />
            <SettingsLinkRow
              href="/settings/services"
              title="Services"
              description="Manage services, duration and pricing"
            />
            <SettingsLinkRow
              href="/settings/branding"
              title="Branding"
              description="Logo, gallery and brand color"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Subscription */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Language & region</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={language}
              onValueChange={(value) =>
                setLanguage(value === "en" ? "en" : "he")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="he">Hebrew (RTL)</SelectItem>
                <SelectItem value="en">English (LTR)</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Default language and text direction for the app.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Subscription */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsLinkRow
              href="/settings/subscription"
              title="Plans & pricing"
              description="View or upgrade your plan"
            />
            <SettingsLinkRow
              href="/settings/billing"
              title="Billing history"
              description="Invoices and payment history"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Support & Legal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Support & Legal</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsLinkRow
              href="/support"
              title="Support"
              description="Get help or contact support"
            />
            <SettingsLinkRow
              href="/legal/privacy"
              title="Privacy policy"
              description="View privacy policy"
            />
            <SettingsLinkRow
              href="/legal/terms"
              title="Terms of service"
              description="View terms and conditions"
            />
            <SettingsLinkRow
              href="/legal/accessibility"
              title="Accessibility"
              description="Accessibility information"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Account */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsActionRow
              title="Log out"
              description="Sign out from your account"
              onActivate={onLogout}
            />
            <SettingsActionRow
              title="Delete account"
              description="Permanently delete your account and data"
              destructive
              onActivate={() => setDeleteOpen(true)}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !deletePending && setDeleteOpen(open)}
      >
        <DialogContent showCloseButton={!deletePending}>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all your data. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              This will delete:
            </div>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>Business data</li>
              <li>Customers</li>
              <li>Appointments</li>
              <li>Services</li>
              <li>Settings</li>
            </ul>

            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={onDownloadData}
              disabled={exportPending}
            >
              {exportPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Download your data before deleting
            </Button>

            <div className="space-y-2">
              <Label>Type DELETE to confirm</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={deletePending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-2xl"
              disabled={deletePending || deleteConfirmText !== "DELETE"}
              onClick={onDeleteAccount}
            >
              {deletePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
