import { redirect } from "next/navigation";

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

  const dest = qs.toString() ? `/auth?${qs.toString()}` : "/auth";
  redirect(dest);
}
