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

function normalizeEmail(email: string) {
  return String(email || "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: finalText,
      ...(finalHtml ? { html: finalHtml } : {}),
    }),
  });

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
