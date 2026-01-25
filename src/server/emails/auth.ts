type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(input: unknown): string {
  const value = String(input ?? "").trim();
  // Only allow http(s) links in emails.
  if (!/^https?:\/\//i.test(value)) return "";
  return value;
}

function pickPublicAppOrigin(): string {
  const emailOrigin = String(process.env.EMAIL_PUBLIC_ORIGIN || "").trim();
  if (emailOrigin) return emailOrigin.replace(/\/+$/, "");

  const explicit = String(
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "",
  ).trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = String(process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "";
}

function progrrLogoUrl(): string {
  const explicit = safeUrl(process.env.EMAIL_LOGO_URL);
  if (explicit) return explicit;

  const origin = pickPublicAppOrigin();
  if (!origin) return "";
  return safeUrl(`${origin}/logo-new2.png`);
}

function renderLayout(args: {
  productName: string;
  title: string;
  preheader: string;
  bodyHtml: string;
  logoUrl?: string;
  logoAlign?: "center" | "left";
  footerText?: string;
}): string {
  const productName = escapeHtml(args.productName);
  const title = escapeHtml(args.title);
  const preheader = escapeHtml(args.preheader);
  const logoUrl = safeUrl(args.logoUrl);
  const logoAlign = args.logoAlign === "left" ? "left" : "center";
  const footerText = escapeHtml(
    args.footerText ??
      `If you didn’t request this email, you can safely ignore it.`,
  );

  // Note: Keep styles inline and conservative for Gmail/Outlook compatibility.
  // Colors are limited to neutral grays already used elsewhere in the codebase.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f7f7f7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f7f7f7;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:560px;max-width:560px;">
            <tr>
              <td align="${logoAlign}" style="padding:0 4px 16px 4px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
                ${
                  logoUrl
                    ? `<img src="${escapeHtml(
                        logoUrl,
                      )}" alt="${productName}" width="140" style="display:block;width:140px;max-width:160px;height:auto;border:0;outline:none;text-decoration:none;" />`
                    : `<div style="font-size:16px;font-weight:700;letter-spacing:0.2px;">${productName}</div>`
                }
              </td>
            </tr>

            <tr>
              <td style="background-color:#ffffff;border-radius:14px;padding:24px 22px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
                <div style="font-size:22px;font-weight:750;margin:0 0 12px 0;">${title}</div>
                ${args.bodyHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:14px 6px 0 6px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#6b7280;">
                <div style="font-size:12px;line-height:1.45;">${footerText}</div>
                <div style="font-size:12px;line-height:1.45;margin-top:6px;">Sent by ${productName}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildOtpEmail(args: {
  productName?: string;
  subject: string;
  title?: string;
  code: string;
  expiresMinutes: number;
  recipientLabel?: string;
}): EmailContent {
  const productName = args.productName ?? "Progrr";
  const subject = String(args.subject || "").trim() || "Your verification code";
  const title = String(args.title || "").trim() || "Your verification code";
  const code = String(args.code || "").trim();
  const expiresMinutes = Number(args.expiresMinutes || 10);
  const logoUrl = progrrLogoUrl();

  const safeRecipient = args.recipientLabel
    ? escapeHtml(args.recipientLabel)
    : "";

  const preheader = `Your code is ${code}. Expires in ${expiresMinutes} minutes.`;

  const bodyHtml = `
    <div style="font-size:14px;line-height:1.6;margin:0 0 14px 0;">
      ${safeRecipient ? `<div style=\"margin:0 0 10px 0;\">Hi ${safeRecipient},</div>` : ""}
      <div style="margin:0 0 10px 0;">Use the code below to continue:</div>
    </div>

    <div style="margin:0 0 14px 0;">
      <div style="display:inline-block;background-color:#f3f4f6;border-radius:12px;padding:14px 16px;">
        <div style="font-size:26px;letter-spacing:6px;font-weight:800;color:#111827;">${escapeHtml(
          code,
        )}</div>
      </div>
    </div>

    <div style="font-size:13px;line-height:1.6;color:#374151;">
      This code expires in <strong>${escapeHtml(expiresMinutes)}</strong> minutes.
    </div>
  `;

  const textLines = [
    title,
    "",
    `Code: ${code}`,
    `Expires in ${expiresMinutes} minutes.`,
    "",
    "If you didn’t request this email, you can safely ignore it.",
  ];

  return {
    subject,
    text: textLines.join("\n"),
    html: renderLayout({
      productName,
      title,
      preheader,
      bodyHtml,
      logoUrl,
    }),
  };
}

export function buildInviteEmail(args: {
  productName?: string;
  subject?: string;
  title?: string;
  inviteLink: string;
  expiresDays: number;
}): EmailContent {
  const productName = args.productName ?? "Progrr";
  const subject =
    String(args.subject || "").trim() || "You've been invited to Progrr";
  const title = String(args.title || "").trim() || "You're invited";
  const inviteLink = safeUrl(args.inviteLink);
  const expiresDays = Number(args.expiresDays || 7);
  const logoUrl = progrrLogoUrl();

  const preheader = "Accept your invitation to get started.";

  const buttonHtml = inviteLink
    ? `
      <div style="margin:0 0 16px 0;">
        <a href="${escapeHtml(
          inviteLink,
        )}" style="display:inline-block;padding:12px 16px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:750;">
          Accept invitation
        </a>
      </div>
    `
    : "";

  const linkFallbackHtml = inviteLink
    ? `
      <div style="font-size:12px;line-height:1.6;color:#374151;word-break:break-all;">
        Or copy and paste this link into your browser:<br />
        <a href="${escapeHtml(inviteLink)}" style="color:#111827;">${escapeHtml(
          inviteLink,
        )}</a>
      </div>
    `
    : "";

  const bodyHtml = `
    <div style="font-size:14px;line-height:1.6;margin:0 0 14px 0;">
      You’ve been invited to <strong>${escapeHtml(productName)}</strong>.
    </div>

    ${buttonHtml}

    <div style="font-size:13px;line-height:1.6;color:#374151;margin:0 0 12px 0;">
      This invitation link expires in <strong>${escapeHtml(expiresDays)}</strong> days.
    </div>

    ${linkFallbackHtml}
  `;

  const textLines = [
    title,
    "",
    "Accept your invitation:",
    inviteLink || "(invalid link)",
    "",
    `This link expires in ${expiresDays} days.`,
  ];

  return {
    subject,
    text: textLines.join("\n"),
    html: renderLayout({
      productName,
      title,
      preheader,
      bodyHtml,
      footerText:
        "If you weren’t expecting an invitation, you can ignore this email.",
      logoUrl,
    }),
  };
}
