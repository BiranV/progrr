"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { getTrialInfo } from "@/lib/trial";

export default function SubscriptionPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const subscriptionStatus = user?.business?.subscriptionStatus ?? "trial";
  const timeZone =
    (user as any)?.onboarding?.availability?.timezone ||
    (user as any)?.onboarding?.business?.timezone ||
    "UTC";
  const { daysLeft: trialDaysLeft, isActive: isTrialActive } = getTrialInfo({
    trialStartAt: user?.business?.trialStartAt,
    trialEndAt: user?.business?.trialEndAt,
    timeZone,
  });
  const isTrial = subscriptionStatus === "trial" && isTrialActive;
  const isPaid = subscriptionStatus === "active";
  const isTrialEndingSoon = trialDaysLeft > 0 && trialDaysLeft <= 3;

  const pricing = [
    {
      id: "monthly",
      label: t("subscription.plan.monthly"),
      price: t("subscription.price.monthly"),
      monthlyEquivalent: t("subscription.monthlyEquivalent.monthly"),
      cta: t("subscription.cta.continueAfterTrial"),
    },
    {
      id: "yearly",
      label: t("subscription.plan.yearly"),
      price: t("subscription.price.yearly"),
      monthlyEquivalent: t("subscription.monthlyEquivalent.yearly"),
      savings: t("subscription.savings.yearly"),
      recommended: true,
      cta: t("subscription.cta.continueAfterTrial"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("subscription.title")}
          </h1>
          {isTrial ? (
            <Badge
              className={
                "border backdrop-blur-sm " +
                (isTrialEndingSoon
                  ? "bg-rose-50/80 text-rose-700 border-rose-200/70"
                  : "bg-gray-100/80 text-gray-700 border-gray-200/70 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700/60")
              }
            >
              {t("subscription.trialBadge", { days: trialDaysLeft })}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("subscription.subtitle")}
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3">
          {pricing.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.recommended
                  ? "border-[#165CF0] shadow-[0_0_0_1px_rgba(22,92,240,0.35),0_12px_28px_-18px_rgba(22,92,240,0.55)]"
                  : undefined
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{plan.label}</CardTitle>
                  {plan.recommended ? (
                    <Badge className="border backdrop-blur-sm bg-blue-50/80 text-blue-700 border-blue-200/70">
                      {t("subscription.recommended")}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xl font-semibold text-gray-900 dark:text-white">
                    {plan.price}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {plan.monthlyEquivalent}
                  </div>
                  {plan.savings ? (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      {plan.savings}
                    </div>
                  ) : null}
                </div>

                <Button
                  className="w-full rounded-2xl"
                  disabled={isPaid}
                  variant={plan.recommended ? "default" : "outline"}
                >
                  {isPaid ? t("subscription.currentPlan") : plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("subscription.footerNote")}
      </p>
    </div>
  );
}
