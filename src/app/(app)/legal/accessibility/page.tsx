import SettingsBackHeader from "@/components/settings/SettingsBackHeader";

export default function AccessibilityPage() {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <SettingsBackHeader />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Accessibility
        </h1>
        <p className="text-sm text-muted-foreground">
          Progrr is designed to be accessible and easy to use for everyone.
        </p>
      </div>

      <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            1. Accessibility Commitment
          </h2>
          <p>
            Progrr is committed to accessibility. We consider accessibility
            throughout design and development to provide an inclusive experience
            for all users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            2. Supported Accessibility Features
          </h2>
          <ul className="list-disc pl-5 space-y-3">
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                Text and Font Scaling
              </span>
              <div className="mt-1">
                The app supports system-level font size adjustments, and text
                scales properly across the interface.
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                Contrast and Readability
              </span>
              <div className="mt-1">
                We use high-contrast color combinations, clear text hierarchy,
                and readable typography.
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                Keyboard Navigation
              </span>
              <div className="mt-1">
                The app can be navigated using a keyboard, and focus states are
                visible and consistent.
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                Screen Reader Support
              </span>
              <div className="mt-1">
                We use semantic HTML with proper labels and roles, compatible
                with common screen readers.
              </div>
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-white">
                Responsive Layout
              </span>
              <div className="mt-1">
                Progrr works across desktop, tablet, and mobile without loss of
                functionality at different sizes.
              </div>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            3. System & Browser Accessibility Settings
          </h2>
          <p>
            Progrr respects operating system accessibility settings and browser
            preferences. You can control accessibility using system font size,
            high contrast modes, and zoom or magnification tools. Accessibility
            customization is handled at the system level, not via an in-app
            widget.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            4. No Accessibility Overlay
          </h2>
          <p>
            Progrr does not use third-party accessibility overlays. This is an
            intentional choice to avoid performance, usability, and compliance
            issues. We prefer native accessibility support.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            5. Ongoing Improvements
          </h2>
          <p>
            Accessibility is continuously reviewed, and improvements are made as
            part of ongoing development. Feedback is always welcome.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            6. Contact for Accessibility Feedback
          </h2>
          <p>
            If you notice an accessibility issue or need assistance, email us at{" "}
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
