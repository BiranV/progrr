import { redirect } from "next/navigation";

import { type AuthBannerState } from "../auth/_components/AuthBanner";
import AuthFlow from "../auth/_components/AuthFlow";
import { requireAppUser } from "@/server/auth";

function isSafeNextPath(next: string): boolean {
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next === "/" || next.startsWith("/auth") || next.startsWith("/login")) {
    return false;
  }
  return true;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const next = typeof sp.next === "string" ? sp.next : "";
  const email = typeof sp.email === "string" ? sp.email : "";
  const authError = typeof sp.authError === "string" ? sp.authError : "";
  const authMessage = typeof sp.authMessage === "string" ? sp.authMessage : "";

  try {
    await requireAppUser();
    redirect(next && isSafeNextPath(next) ? next : "/dashboard");
  } catch {
    // Not authenticated. Allow the login UI to render.
  }

  const banner: AuthBannerState = authError
    ? { type: "error", text: authError }
    : authMessage
    ? { type: "message", text: authMessage }
    : null;

  return (
    <AuthFlow
      initialBanner={banner}
      initialNext={next}
      initialView="login"
      initialEmail={email}
    />
  );
}
