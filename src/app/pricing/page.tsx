"use client";

import React from "react";
import { db } from "@/lib/db";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  Crown,
  Lock,
  Sparkles,
  Zap,
  BookOpen,
  Users,
  ListChecks,
} from "lucide-react";
import { User } from "@/types";
import { PLAN_CONFIG } from "@/config/plans";

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await db.auth.me();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const plans = [
    {
      key: "free",
      name: "Free",
      description: "Explore the core workflow.",
      icon: BookOpen,
      popular: false,
      theme: {
        card: "border border-gray-200 dark:border-gray-700",
        badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-200",
        icon: "text-indigo-600 dark:text-indigo-200",
      },
    },
    {
      key: "basic",
      name: "Basic",
      description: "For solo coaches who want faster setup.",
      icon: Zap,
      popular: false,
      theme: {
        card: "border border-gray-200 dark:border-gray-700",
        badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
        icon: "text-purple-600 dark:text-purple-200",
      },
    },
    {
      key: "professional",
      name: "Professional",
      description: "For growing coaching businesses.",
      icon: Sparkles,
      popular: true,
      theme: {
        card: "border border-gray-200 dark:border-gray-700",
        badge: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200",
        icon: "text-green-600 dark:text-green-200",
      },
    },
    {
      key: "advanced",
      name: "Advanced",
      description: "For teams who want full control.",
      icon: Crown,
      popular: false,
      theme: {
        card: "border border-gray-200 dark:border-gray-700",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-100",
        icon: "text-amber-600 dark:text-amber-100",
      },
    },
  ] as const;

  const formatLimit = React.useCallback((limit: number, label: string) => {
    if (Number.isFinite(limit)) return `Up to ${limit} ${label}`;
    return `Unlimited ${label}`;
  }, []);

  const renderCapability = React.useCallback(
    (args: { label: string; included: boolean }) => (
      <li className="flex items-start gap-3">
        {args.included ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        ) : (
          <Lock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        )}

        <span className="text-gray-800 dark:text-gray-200 flex-1">
          {args.label}
        </span>
      </li>
    ),
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Subscription Tiers
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Tiers differ only by limits and a few clear feature gates.
          </p>
          {/*  */}
        </div>


        {/* Pricing Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const config = PLAN_CONFIG[plan.key];
            const isCurrentPlan =
              user?.role === "admin" && String((user as any)?.plan ?? "") === plan.key;

            const currentTier =
              user?.role === "admin"
                ? (String((user as any)?.plan ?? "free") as
                  | "free"
                  | "basic"
                  | "professional"
                  | "advanced")
                : null;

            const tierOrder = ["free", "basic", "professional", "advanced"] as const;
            const currentIndex = currentTier ? tierOrder.indexOf(currentTier) : -1;
            const planIndex = tierOrder.indexOf(plan.key);
            const isUpgrade = currentTier != null && planIndex > currentIndex;
            const isDowngrade = currentTier != null && planIndex < currentIndex;

            const primaryLabel = !user
              ? "Sign Up"
              : user?.role !== "admin"
                ? "Back to dashboard"
                : isCurrentPlan
                  ? "Current plan"
                  : isUpgrade
                    ? `Upgrade to ${plan.name}`
                    : isDowngrade
                      ? `Downgrade to ${plan.name}`
                      : "Choose";
            return (
              <Card
                key={plan.name}
                className={`relative ${plan.theme.card} min-w-0 flex flex-col h-full ${isCurrentPlan
                  ? "border-2 border-indigo-600 shadow-xl dark:border-indigo-400 dark:ring-1 dark:ring-indigo-400/30 dark:shadow-[0_18px_60px_rgba(99,102,241,0.25)]"
                  : ""
                  }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-sm">
                    Most Popular
                  </div>
                )}

                {isCurrentPlan ? (
                  <div className="absolute -top-4 right-4 z-20 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800 shadow-sm ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-100 dark:ring-indigo-400/40">
                    Current
                  </div>
                ) : null}

                <CardHeader className="text-center pb-8 pt-8">
                  <div
                    className={`inline-flex p-3 rounded-2xl mb-4 mx-auto ${plan.theme.badge}`}
                  >
                    <Icon className={`w-8 h-8 ${plan.theme.icon}`} />
                  </div>
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>

                  <div className="mt-4 flex items-end justify-center gap-1 text-gray-900 dark:text-white">
                    <span className="text-4xl font-bold tracking-tight">
                      ${config.priceMonthly}
                    </span>
                    <span className="pb-1 text-sm text-gray-500 dark:text-gray-400">
                      /month
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {formatLimit(config.maxClients, "active clients")}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ListChecks className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {formatLimit(config.maxPlans, "plans")}
                      </span>
                    </li>
                  </ul>

                  <div className="h-px bg-gray-200 dark:bg-gray-800 mb-6" />

                  <ul className="space-y-3 mb-8">
                    {renderCapability({
                      label: "Exercise & food catalog",
                      included: config.allowExternalCatalogApi,
                    })}
                    {renderCapability({
                      label: "Coach branding (logo)",
                      included: config.allowAdminLogo,
                    })}
                    {renderCapability({
                      label: "Custom video uploads",
                      included: config.allowCustomVideoUploads,
                    })}
                    {renderCapability({
                      label: "Your brand on the client app",
                      included: config.allowPwaBranding,
                    })}
                  </ul>

                  <Button
                    className="w-full"
                    variant="outline"
                    style={{ marginTop: "auto" }}
                    onClick={() => {
                      if (!user) return router.push("/auth");
                      if (user?.role !== "admin") return router.push("/dashboard");
                      if (isCurrentPlan) return;

                      // No billing in-app yet; take user to Settings.
                      router.push("/settings");
                    }}
                    disabled={Boolean(user) && user?.role === "admin" && isCurrentPlan}
                  >
                    {primaryLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div >
  );
}

