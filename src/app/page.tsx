import { redirect } from "next/navigation";
import { requireAppUser } from "@/server/auth";

function isSafeNextPath(next: string): boolean {
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next === "/" || next.startsWith("/auth") || next.startsWith("/login")) {
    return false;
  }
  return true;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const qs = new URLSearchParams();

  const next = typeof sp.next === "string" ? sp.next : "";
  const authError = typeof sp.authError === "string" ? sp.authError : "";
  const authMessage = typeof sp.authMessage === "string" ? sp.authMessage : "";

  if (next) qs.set("next", next);
  if (authError) qs.set("authError", authError);
  if (authMessage) qs.set("authMessage", authMessage);

  // If the user is already authenticated, the home route should never send them
  // to the login/welcome screen.
  try {
    await requireAppUser();
    const authedDest = next && isSafeNextPath(next) ? next : "/dashboard";
    redirect(authedDest);
  } catch {
    const dest = qs.toString() ? `/welcome?${qs.toString()}` : "/welcome";
    redirect(dest);
  }
}
