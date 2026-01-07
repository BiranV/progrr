import { redirect } from "next/navigation";
import { type AuthBannerState } from "./_components/AuthBanner";
import AuthFlow from "./_components/AuthFlow";
import { requireAppUser } from "@/server/auth";

function isSafeNextPath(next: string): boolean {
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next === "/" || next.startsWith("/auth") || next.startsWith("/login")) {
    return false;
  }
  return true;
}

export default async function AuthEntryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const next = typeof sp.next === "string" ? sp.next : "";
  const authError = typeof sp.authError === "string" ? sp.authError : "";
  const authMessage = typeof sp.authMessage === "string" ? sp.authMessage : "";
  const inviteToken = typeof sp.inviteToken === "string" ? sp.inviteToken : "";

  // Hard server-side guard: if already authenticated, the auth entry page must never render.
  // Exception: invite acceptance flow is allowed to render when inviteToken is present.
  if (!inviteToken) {
    try {
      await requireAppUser();
      redirect(next && isSafeNextPath(next) ? next : "/dashboard");
    } catch {
      // Not authenticated (or blocked). Allow the auth UI to render.
    }
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
      initialInviteToken={inviteToken}
    />
  );
}
