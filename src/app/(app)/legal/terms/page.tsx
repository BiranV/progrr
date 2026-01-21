import SettingsBackHeader from "@/components/settings/SettingsBackHeader";

export default function TermsOfServicePage() {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground">
          Please read these terms carefully before using Progrr.
        </p>
        <p className="text-xs text-muted-foreground">
          Last updated: January 2026
        </p>
      </div>

      <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using Progrr, you agree to these terms. If you do
            not agree, you should not use the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            2. Description of Service
          </h2>
          <p>
            Progrr provides business management and scheduling tools. The
            service may evolve over time, and features may be added, changed, or
            removed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            3. Eligibility
          </h2>
          <p>
            You must be legally able to enter a binding agreement to use Progrr.
            You are responsible for compliance with local laws.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            4. User Accounts
          </h2>
          <p>
            You are responsible for maintaining the security of your account and
            for all activity under it. Progrr is not liable for unauthorized
            access caused by your negligence.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            5. Acceptable Use
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>No illegal use of the service</li>
            <li>No abuse, misuse, or disruption of the service</li>
            <li>No attempts to access unauthorized systems or data</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            6. Payments and Subscriptions (If Applicable)
          </h2>
          <p>
            Some features may require payment. Pricing and billing terms are
            presented separately. Subscriptions may renew automatically unless
            canceled.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            7. Intellectual Property
          </h2>
          <p>
            Progrr owns the platform, code, design, and branding. You retain
            ownership of your business data. No rights are granted beyond using
            the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            8. Data and Privacy
          </h2>
          <p>Your use of Progrr is also governed by our Privacy Policy.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            9. Service Availability
          </h2>
          <p>
            The service is provided “as is” without guarantees of uninterrupted
            or error-free operation. Maintenance or downtime may occur.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            10. Limitation of Liability
          </h2>
          <p>
            Progrr is not liable for indirect or consequential damages.
            Liability is limited to the maximum extent permitted by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            11. Termination
          </h2>
          <p>
            You may stop using the service at any time. Progrr may suspend or
            terminate accounts for violations. Termination does not affect
            accrued rights or obligations.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            12. Changes to Terms
          </h2>
          <p>
            We may update these terms from time to time. Updates will be
            reflected on this page. Continued use means you accept the updated
            terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            13. Governing Law
          </h2>
          <p>These terms are governed by applicable local law.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            14. Contact Information
          </h2>
          <p>
            For legal inquiries, email us at{" "}
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
