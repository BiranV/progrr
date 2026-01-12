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
import { Check, Sparkles, Crown, Zap, BookOpen } from "lucide-react";
import { User } from "@/types";

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
      description: "For trying it out",
      icon: Zap,
      popular: false,
      theme: {
        card: "border border-gray-200 dark:border-gray-700",
        badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-200",
        icon: "text-indigo-600 dark:text-indigo-200",
      },
      features: [
        "Max clients: 10",
        "Max plans (workout + meal): 20",
        "Exercises/Foods external catalog: not included",
        "Custom video uploads: not included",
        "Admin logo: not included",
        "PWA app logo customization: not included",
      ],
    },
    {
      key: "basic",
      name: "Basic",
      description: "For solo coaches",
      icon: BookOpen,
      popular: false,
      theme: {
        card: "border border-gray-200 dark:border-gray-700",
        badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
        icon: "text-purple-600 dark:text-purple-200",
      },
      features: [
        "Max clients: 20",
        "Max plans (workout + meal): 50",
        "Exercises/Foods external catalog: included",
        "Custom video uploads: not included",
        "Admin logo: included",
        "PWA app logo customization: not included",
      ],
    },
    {
      key: "professional",
      name: "Professional",
      description: "For growing businesses",
      icon: Sparkles,
      popular: true,
      theme: {
        card: "border-2 border-indigo-600 shadow-xl lg:scale-105 z-10",
        badge: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200",
        icon: "text-green-600 dark:text-green-200",
      },
      features: [
        "Max clients: 100",
        "Max plans (workout + meal): unlimited",
        "Exercises/Foods external catalog: included",
        "Custom video uploads: not included",
        "Admin logo: included",
        "PWA app logo customization: not included",
      ],
    },
    {
      key: "advanced",
      name: "Advanced",
      description: "For power users",
      icon: Crown,
      popular: false,
      theme: {
        card: "border border-gray-200 dark:border-gray-700",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-100",
        icon: "text-amber-600 dark:text-amber-100",
      },
      features: [
        "Max clients: unlimited",
        "Max plans (workout + meal): unlimited",
        "Exercises/Foods external catalog: included",
        "Custom video uploads: included",
        "Admin logo: included",
        "PWA app logo customization: included",
      ],
    },
  ] as const;

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
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Plans differ only by limits and branding/media capabilities.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan =
              user?.role === "admin" && String((user as any)?.plan ?? "") === plan.key;
            return (
              <Card
                key={plan.name}
                className={`relative ${plan.theme.card} min-w-0`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <CardHeader className="text-center pb-8 pt-8">
                  <div
                    className={`inline-flex p-3 rounded-2xl mb-4 mx-auto ${plan.theme.badge}`}
                  >
                    <Icon className={`w-8 h-8 ${plan.theme.icon}`} />
                  </div>
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${plan.popular
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : ""
                      }`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => {
                      if (!user) return router.push("/auth");
                      if (isCurrentPlan) return;

                      // No billing in-app: send users to Settings for upgrade help.
                      router.push("/settings");
                    }}
                    disabled={Boolean(user) && isCurrentPlan}
                  >
                    {!user
                      ? "Sign Up"
                      : isCurrentPlan
                        ? "Current plan"
                        : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Comparison */}
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                All plans include
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  "Client management",
                  "Workout & meal planning",
                  "Messaging",
                  "Meetings",
                  "Food & exercise libraries",
                  "Data export",
                  "Mobile-friendly web app",
                  "Progress tracking",
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
