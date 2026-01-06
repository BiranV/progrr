import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AuthShell from "./_components/AuthShell";
import AuthBanner, { type AuthBannerState } from "./_components/AuthBanner";

export default async function AuthEntryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const next = typeof sp.next === "string" ? sp.next : "";
  const authError = typeof sp.authError === "string" ? sp.authError : "";
  const authMessage = typeof sp.authMessage === "string" ? sp.authMessage : "";

  const banner: AuthBannerState = authError
    ? { type: "error", text: authError }
    : authMessage
    ? { type: "message", text: authMessage }
    : null;

  const adminHref = next
    ? `/auth/admin?next=${encodeURIComponent(next)}`
    : "/auth/admin";
  const clientHref = next
    ? `/auth/client?next=${encodeURIComponent(next)}`
    : "/auth/client";

  return (
    <AuthShell>
      <Card className="relative w-full border-0 overflow-hidden shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold">Welcome to Progrr</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Choose how you’d like to continue
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthBanner banner={banner} />

          <div className="space-y-3">
            <Button
              asChild
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
            >
              <Link href={adminHref}>Continue as Admin</Link>
            </Button>

            <div className="space-y-2">
              <Button
                asChild
                variant="outline"
                className="w-full bg-white/70 dark:bg-gray-900/40"
              >
                <Link href={clientHref}>I’m a Client</Link>
              </Button>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Clients can access Progrr only after being invited by a coach.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
