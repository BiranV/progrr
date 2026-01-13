"use client";

import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SettingsRow({
  title,
  description,
  destructive = false,
}: {
  title: string;
  description?: string;
  destructive?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled="true"
      className={
        "flex items-center justify-between gap-4 py-3 focus:outline-none" +
        (destructive ? "" : "")
      }
    >
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
    </div>
  );
}

export default function SettingsPage() {
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
            <SettingsRow
              title="Business details"
              description="Edit your business information"
            />
            <SettingsRow
              title="Opening hours"
              description="Set your working days and hours"
            />
            <SettingsRow
              title="Services"
              description="Manage services, duration and pricing"
            />
            <SettingsRow title="Branding" description="Logo, gallery and brand color" />
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
            <SettingsRow
              title="Booking settings"
              description="Control how customers book appointments"
            />
            <SettingsRow
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
            <SettingsRow
              title="Plans & pricing"
              description="View or upgrade your plan"
            />
            <SettingsRow
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
            <SettingsRow
              title="Support"
              description="Get help or contact support"
            />
            <SettingsRow
              title="Privacy policy"
              description="View privacy policy"
            />
            <SettingsRow
              title="Terms of service"
              description="View terms and conditions"
            />
            <SettingsRow
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
            <SettingsRow title="Log out" description="Sign out from your account" />
            <SettingsRow
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
