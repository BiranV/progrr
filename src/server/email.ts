import { normalizeEmail } from "@/lib/email";

type SendEmailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    const suffix = process.env.NODE_ENV === "development" ? `: ${name}` : "";
    throw Object.assign(new Error(`Email sending is not configured${suffix}`), {
      status: 500,
      code: "ENV_MISSING",
    });
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");

  // Dev goal: work on localhost even without domain verification.
  // - If you *have* a verified domain, set EMAIL_FROM and we'll use it.
  // - Otherwise we fall back to a Resend-verified sender.
  const envFrom = process.env.EMAIL_FROM;
  const from =
    process.env.NODE_ENV === "development"
      ? String(envFrom || "").trim() || "Progrr <onboarding@resend.dev>"
      : requireEnv("EMAIL_FROM");

  const to = normalizeEmail(args.to);
  if (!to) {
    throw Object.assign(new Error("Email is required"), { status: 400 });
  }

  const subject = String(args.subject || "").trim();
  if (!subject) {
    throw Object.assign(new Error("Email subject is required"), {
      status: 400,
    });
  }

  const text = String(args.text || "").trim();
  const html = typeof args.html === "string" ? args.html : undefined;
  const finalText = text || subject;
  const finalHtml = html && html.trim() ? html : undefined;

  if (!finalText && !finalHtml) {
    throw Object.assign(new Error("Email content is required"), {
      status: 400,
    });
  }

  const payload = {
    from,
    to: [to],
    subject,
    text: finalText,
    ...(finalHtml ? { html: finalHtml } : {}),
  };

  const url = "https://api.resend.com/emails";
  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };

  // Controlled retries for transient failures only (no infinite retries).
  const backoffsMs = [0, 250, 750];
  let res: Response | null = null;
  let lastErr: any = null;

  for (let i = 0; i < backoffsMs.length; i++) {
    if (backoffsMs[i] > 0) await sleep(backoffsMs[i]);
    try {
      res = await fetch(url, init);
      if (res.ok) break;

      // Retry only for transient upstream issues.
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        continue;
      }

      break;
    } catch (e: any) {
      lastErr = e;
      // Retry network errors.
      continue;
    }
  }

  if (!res) {
    throw Object.assign(new Error("Failed to send email"), {
      status: 502,
      cause: lastErr,
    });
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = raw;

    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        message =
          (parsed as any)?.message ||
          (parsed as any)?.error ||
          (parsed as any)?.details ||
          raw;
      }
    } catch {
      // ignore JSON parse errors
    }

    const normalizedMessage = String(message || "").trim();

    if (
      process.env.NODE_ENV === "production" &&
      res.status === 403 &&
      /domain\s+is\s+not\s+verified/i.test(normalizedMessage)
    ) {
      throw Object.assign(
        new Error(
          "Email sender domain is not verified. Verify your domain in Resend (Domains) or set EMAIL_FROM to a verified sender."
        ),
        { status: 500 }
      );
    }

    const friendly = normalizedMessage
      ? `Failed to send email: ${normalizedMessage}`
      : `Failed to send email (${res.status})`;

    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw Object.assign(new Error(friendly), { status });
  }
}
