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
import { Check, Sparkles, Crown, Zap } from "lucide-react";
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
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const plans = [
    {
      name: "Starter",
      price: "$29",
      period: "/month",
      description: "Perfect for new coaches",
      icon: Zap,
      color: "indigo",
      features: [
        "Up to 10 clients",
        "Basic workout plans",
        "Email support",
        "Client messaging",
        "Mobile app access",
      ],
    },
    {
      name: "Professional",
      price: "$79",
      period: "/month",
      description: "For growing businesses",
      icon: Sparkles,
      color: "purple",
      popular: true,
      features: [
        "Up to 50 clients",
        "Advanced workout & meal plans",
        "Priority support",
        "Video meetings",
        "Analytics & reports",
        "Custom branding",
        "API access",
      ],
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "/month",
      description: "For established coaches",
      icon: Crown,
      color: "amber",
      features: [
        "Unlimited clients",
        "Everything in Professional",
        "Dedicated account manager",
        "White-label solution",
        "Advanced integrations",
        "Custom development",
        "SLA guarantee",
      ],
    },
  ];

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
            Choose the perfect plan for your coaching business. Upgrade or
            downgrade anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-16">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.name}
                className={`relative ${
                  plan.popular
                    ? "border-2 border-indigo-600 shadow-xl scale-105 z-10"
                    : "border border-gray-200 dark:border-gray-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <CardHeader className="text-center pb-8 pt-8">
                  <div
                    className={`inline-flex p-3 rounded-2xl bg-${plan.color}-100 dark:bg-${plan.color}-900/20 mb-4 mx-auto`}
                  >
                    <Icon className={`w-8 h-8 text-${plan.color}-600`} />
                  </div>
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-5xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {plan.period}
                    </span>
                  </div>
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
                    className={`w-full ${
                      plan.popular ? "bg-indigo-600 hover:bg-indigo-700" : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => {
                      if (user) {
                        router.push("/dashboard");
                      } else {
                        router.push("/");
                      }
                    }}
                  >
                    {user ? "Get Started" : "Sign Up"}
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
                  "Secure cloud storage",
                  "Mobile & web access",
                  "Data encryption",
                  "Regular backups",
                  "GDPR compliant",
                  "99.9% uptime",
                  "Client portal access",
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

        {/* CTA Section */}
        <div className="text-center mt-16">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Need a custom plan? Have questions?
          </p>
          <Button variant="outline" size="lg">
            Contact Sales
          </Button>
        </div>
      </div>
    </div>
  );
}
