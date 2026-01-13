"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

function SettingsRowContent({
  title,
  description,
  destructive = false,
}: {
  title: string;
  description?: string;
  destructive?: boolean;
}) {
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

      <ChevronRight
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
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
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
    </div>
  );
}

export default function SettingsPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const isLoggingOutRef = React.useRef(false);

  const onLogout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await logout(false);
    } finally {
      router.replace("/auth");
      router.refresh();
      isLoggingOutRef.current = false;
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
              title="Opening hours"
              description="Set your working days and hours"
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

      {/* Section 2: Appointments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Appointments</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            <SettingsLinkRow
              href="/settings/booking"
              title="Booking settings"
              description="Control how customers book appointments"
            />
            <SettingsLinkRow
              href="/settings/cancellation"
              title="Cancellation policy"
              description="Define cancellation rules"
            />
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
            <SettingsLinkRow
              href="/settings/delete-business"
              title="Delete business"
              description="Permanently delete your business"
              destructive
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
