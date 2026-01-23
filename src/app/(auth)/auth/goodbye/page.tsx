"use client";

import Link from "next/link";
import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";

export default function GoodbyePage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.goodbyeTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("auth.goodbyeBody")}
          </p>

          <div className="flex gap-3">
            <Button asChild>
              <Link href="/auth">{t("auth.goodbyeSignIn")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">{t("auth.goodbyeHome")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
