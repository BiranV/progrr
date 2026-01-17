"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { ChevronRight } from "lucide-react";
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
  const { logout, setSessionUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoggingOutRef = React.useRef(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);

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

      {/* Section 3: Support & Legal */}
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

      {/* Section 4: Account */}
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
            <SettingsLinkRow
              href="/settings/delete-business"
              title="Delete business"
              description="Permanently delete your business"
              destructive
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
              disabled={deletePending}
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
