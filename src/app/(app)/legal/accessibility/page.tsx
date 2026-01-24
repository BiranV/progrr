"use client";

import React, { Suspense } from "react";
import SettingsBackHeader from "@/components/settings/SettingsBackHeader";
import { useI18n } from "@/i18n/useI18n";

function AccessibilityContent() {
  const { t } = useI18n();
  const supportEmail = "support@progrr.io";

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("accessibility.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("accessibility.subtitle")}
        </p>
      </div>

      <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("accessibility.sections.commitment.title")}
          </h2>
          <p>{t("accessibility.sections.commitment.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("accessibility.sections.features.title")}
          </h2>
          <ul className="list-disc pl-5 space-y-3">
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                {t("accessibility.sections.features.items.text.title")}
              </span>
              <div className="mt-1">
                {t("accessibility.sections.features.items.text.body")}
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                {t("accessibility.sections.features.items.contrast.title")}
              </span>
              <div className="mt-1">
                {t("accessibility.sections.features.items.contrast.body")}
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                {t("accessibility.sections.features.items.keyboard.title")}
              </span>
              <div className="mt-1">
                {t("accessibility.sections.features.items.keyboard.body")}
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                {t("accessibility.sections.features.items.screenReader.title")}
              </span>
              <div className="mt-1">
                {t("accessibility.sections.features.items.screenReader.body")}
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                {t("accessibility.sections.features.items.responsive.title")}
              </span>
              <div className="mt-1">
                {t("accessibility.sections.features.items.responsive.body")}
              </div>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("accessibility.sections.settings.title")}
          </h2>
          <p>{t("accessibility.sections.settings.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("accessibility.sections.overlay.title")}
          </h2>
          <p>{t("accessibility.sections.overlay.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("accessibility.sections.improvements.title")}
          </h2>
          <p>{t("accessibility.sections.improvements.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("accessibility.sections.contact.title")}
          </h2>
          <p>
            {t("accessibility.sections.contact.body")} {" "}
            <a
              href={`mailto:${supportEmail}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

export default function AccessibilityPage() {
  return (
    <Suspense fallback={<div />}>
      <AccessibilityContent />
    </Suspense>
  );
}
