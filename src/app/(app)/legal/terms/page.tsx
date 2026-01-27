"use client";

import SettingsBackHeader from "@/components/settings/SettingsBackHeader";
import { useI18n } from "@/i18n/useI18n";

export default function TermsOfServicePage() {
  const { t } = useI18n();
  const supportEmail = "support@progrr.io";

  return (
    <div className="space-y-6 pb-24">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("terms.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("terms.subtitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("terms.lastUpdated", { date: t("terms.lastUpdatedDate") })}
        </p>
      </div>

      <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.acceptance.title")}
          </h2>
          <p>{t("terms.sections.acceptance.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.description.title")}
          </h2>
          <p>{t("terms.sections.description.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.eligibility.title")}
          </h2>
          <p>{t("terms.sections.eligibility.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.accounts.title")}
          </h2>
          <p>{t("terms.sections.accounts.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.acceptableUse.title")}
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t("terms.sections.acceptableUse.items.illegal")}</li>
            <li>{t("terms.sections.acceptableUse.items.abuse")}</li>
            <li>{t("terms.sections.acceptableUse.items.unauthorized")}</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.payments.title")}
          </h2>
          <p>{t("terms.sections.payments.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.ip.title")}
          </h2>
          <p>{t("terms.sections.ip.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.privacy.title")}
          </h2>
          <p>{t("terms.sections.privacy.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.availability.title")}
          </h2>
          <p>{t("terms.sections.availability.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.liability.title")}
          </h2>
          <p>{t("terms.sections.liability.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.termination.title")}
          </h2>
          <p>{t("terms.sections.termination.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.changes.title")}
          </h2>
          <p>{t("terms.sections.changes.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.law.title")}
          </h2>
          <p>{t("terms.sections.law.body")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("terms.sections.contact.title")}
          </h2>
          <p>
            {t("terms.sections.contact.body")}{" "}
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
