"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/useI18n";

export default function SubscriptionPage() {
  const { t } = useI18n();
  const isTrial = true;
  const trialDaysLeft = 10;
  const isPaid = false;

  const pricing = [
    {
      id: "monthly",
      label: t("subscription.plan.monthly"),
      price: t("subscription.price.monthly"),
      monthlyEquivalent: t("subscription.monthlyEquivalent.monthly"),
      cta: t("subscription.cta.continueAfterTrial"),
    },
    {
      id: "semi",
      label: t("subscription.plan.semi"),
      price: t("subscription.price.semi"),
      monthlyEquivalent: t("subscription.monthlyEquivalent.semi"),
      savings: t("subscription.savings.semi"),
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
            <Badge variant="secondary">
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
                  ? "border-primary/50 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                  : undefined
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{plan.label}</CardTitle>
                  {plan.recommended ? (
                    <Badge className="bg-primary text-primary-foreground">
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
