import SettingsBackHeader from "@/components/settings/SettingsBackHeader";

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground">
          Your privacy is important to us.
        </p>
        <p className="text-xs text-muted-foreground">
          Last updated: January 2026
        </p>
      </div>

      <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            1. Introduction
          </h2>
          <p>
            Progrr respects your privacy. This policy explains how we collect
            and use information when you use our service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            2. Information We Collect
          </h2>
          <p>
            We collect information you provide and basic technical data, such
            as:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information (name, email, phone)</li>
            <li>Business-related data you enter into Progrr</li>
            <li>Technical data (device, browser, basic analytics)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            3. How We Use Information
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide and operate the service</li>
            <li>To improve the product</li>
            <li>To communicate important updates</li>
            <li>To provide support</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            4. Data Sharing
          </h2>
          <p>
            We do not sell personal data. We share data only with trusted
            services (such as hosting, analytics, and email) when required to
            operate the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            5. Data Security
          </h2>
          <p>
            We use industry-standard security practices and reasonable measures
            to protect user data. No method of transmission or storage is 100%
            secure, so we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            6. Data Retention
          </h2>
          <p>
            We keep data only as long as your account is active. You can request
            deletion of your data at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            7. User Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access your data</li>
            <li>Correct your data</li>
            <li>Request deletion of your data</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            8. Third-Party Services
          </h2>
          <p>
            We use third-party services for hosting, analytics, and payments (if
            applicable). These services only receive the data needed to operate
            Progrr.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            9. Changes to This Policy
          </h2>
          <p>
            We may update this policy from time to time. Changes will be
            reflected on this page. Continued use of Progrr means you accept the
            updated policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            10. Contact Us
          </h2>
          <p>
            If you have questions about this policy, email us at{" "}
            <a
              href="mailto:support@progrr.io"
              className="text-primary underline-offset-4 hover:underline"
            >
              support@progrr.io
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
