"use client";

import { Mail } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SettingsBackHeader from "@/components/settings/SettingsBackHeader";
import { useI18n } from "@/i18n/useI18n";

export default function SupportPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("support.title")}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("support.subtitle")}
        </p>
      </div>

      <div className="grid gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {t("support.contactTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("support.contactSubtitle")}
            </p>
            <Button asChild className="rounded-2xl">
              <a href="mailto:support@progrr.io">
                {t("support.contactEmail", { email: "support@progrr.io" })}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("support.infoTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>{t("support.responseTime")}</div>
          <div>{t("support.hours")}</div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        {t("support.urgentNote")}
      </div>
    </div>
  );
}
