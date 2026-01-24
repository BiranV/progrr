"use client";

import SettingsBackHeader from "@/components/settings/SettingsBackHeader";
import { useI18n } from "@/i18n/useI18n";

export default function PrivacyPolicyPage() {
  const { t } = useI18n();
  const supportEmail = "support@progrr.io";

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("privacy.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("privacy.subtitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("privacy.lastUpdated", { date: t("privacy.lastUpdatedDate") })}
        </p>
      </div>

      <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.introduction.title")}
          </h2>
          <p>
            {t("privacy.sections.introduction.body")}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.information.title")}
          </h2>
          <p>
            {t("privacy.sections.information.body")}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t("privacy.sections.information.items.account")}</li>
            <li>{t("privacy.sections.information.items.business")}</li>
            <li>{t("privacy.sections.information.items.technical")}</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.usage.title")}
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t("privacy.sections.usage.items.provide")}</li>
            <li>{t("privacy.sections.usage.items.improve")}</li>
            <li>{t("privacy.sections.usage.items.updates")}</li>
            <li>{t("privacy.sections.usage.items.support")}</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.sharing.title")}
          </h2>
          <p>
            {t("privacy.sections.sharing.body")}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.security.title")}
          </h2>
          <p>
            {t("privacy.sections.security.body")}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.retention.title")}
          </h2>
          <p>
            {t("privacy.sections.retention.body")}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.rights.title")}
          </h2>
          <p>{t("privacy.sections.rights.body")}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t("privacy.sections.rights.items.access")}</li>
            <li>{t("privacy.sections.rights.items.correct")}</li>
            <li>{t("privacy.sections.rights.items.delete")}</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.thirdParty.title")}
          </h2>
          <p>
            {t("privacy.sections.thirdParty.body")}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.changes.title")}
          </h2>
          <p>
            {t("privacy.sections.changes.body")}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("privacy.sections.contact.title")}
          </h2>
          <p>
            {t("privacy.sections.contact.body")}{" "}
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
