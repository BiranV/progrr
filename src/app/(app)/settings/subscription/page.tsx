import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRICING = [
  {
    id: "monthly",
    label: "Monthly",
    price: "₪79 / month",
    monthlyEquivalent: "₪79 / month",
    cta: "Continue after trial",
  },
  {
    id: "semi",
    label: "6 Months",
    price: "₪399 / 6 months",
    monthlyEquivalent: "₪66.5 / month",
    savings: "Save ~15%",
    cta: "Continue after trial",
  },
  {
    id: "yearly",
    label: "Yearly",
    price: "₪749 / year",
    monthlyEquivalent: "₪62 / month",
    savings: "Save ~20%",
    recommended: true,
    cta: "Continue after trial",
  },
];

export default function SubscriptionPage() {
  const isTrial = true;
  const trialDaysLeft = 10;
  const isPaid = false;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Plans & Pricing
          </h1>
          {isTrial ? (
            <Badge variant="secondary">Trial – {trialDaysLeft} days left</Badge>
          ) : null}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Start with a 14-day free trial. No feature restrictions.
        </p>
      </div>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          All plans include a 14-day free trial. No payment required to get
          started.
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          Pro plan
        </div>
        <div className="grid gap-3">
          {PRICING.map((plan) => (
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
                      Recommended
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
                  {isPaid ? "Current plan" : plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        You won’t be charged during the trial. Billing will begin after your
        trial ends if you choose to continue.
      </p>
    </div>
  );
}
