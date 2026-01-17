type EmailContent = {
    subject: string;
    text: string;
    html?: string;
};

function escapeHtml(input: unknown): string {
    return String(input ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function buildAppointmentRescheduledEmail(args: {
    businessName?: string;
    serviceName?: string;
    oldDate: string;
    oldStartTime: string;
    oldEndTime: string;
    newDate: string;
    newStartTime: string;
    newEndTime: string;
}): EmailContent {
    const businessName = String(args.businessName || "").trim() || "Progrr";
    const serviceName = String(args.serviceName || "").trim();

    const subject = serviceName
        ? `${businessName}: ${serviceName} rescheduled`
        : `${businessName}: Appointment rescheduled`;

    const textLines = [
        "Your appointment has been rescheduled.",
        "",
        serviceName ? `Service: ${serviceName}` : "",
        `Previous: ${args.oldDate} ${args.oldStartTime}–${args.oldEndTime}`,
        `New: ${args.newDate} ${args.newStartTime}–${args.newEndTime}`,
        "",
        `— ${businessName}`,
    ].filter(Boolean);

    const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#111827;">
    <div style="font-size:18px;font-weight:700;margin:0 0 10px 0;">Appointment rescheduled</div>
    <div style="font-size:14px;margin:0 0 14px 0;">Your appointment has been rescheduled.</div>

    ${serviceName ? `<div style="font-size:14px;margin:0 0 10px 0;"><strong>Service:</strong> ${escapeHtml(serviceName)}</div>` : ""}

    <div style="font-size:14px;margin:0 0 6px 0;"><strong>Previous:</strong> ${escapeHtml(args.oldDate)} ${escapeHtml(args.oldStartTime)}–${escapeHtml(args.oldEndTime)}</div>
    <div style="font-size:14px;margin:0 0 14px 0;"><strong>New:</strong> ${escapeHtml(args.newDate)} ${escapeHtml(args.newStartTime)}–${escapeHtml(args.newEndTime)}</div>

    <div style="font-size:13px;color:#6b7280;">— ${escapeHtml(businessName)}</div>
  </div>`;

    return {
        subject,
        text: textLines.join("\n"),
        html,
    };
}

export function buildAppointmentCanceledEmail(args: {
    businessName?: string;
    serviceName?: string;
    date: string;
    startTime: string;
    endTime: string;
}): EmailContent {
    const businessName = String(args.businessName || "").trim() || "Progrr";
    const serviceName = String(args.serviceName || "").trim();

    const subject = serviceName
        ? `${businessName}: ${serviceName} canceled`
        : `${businessName}: Appointment canceled`;

    const textLines = [
        "Your appointment has been canceled.",
        "",
        serviceName ? `Service: ${serviceName}` : "",
        `When: ${args.date} ${args.startTime}–${args.endTime}`,
        "",
        `— ${businessName}`,
    ].filter(Boolean);

    const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#111827;">
    <div style="font-size:18px;font-weight:700;margin:0 0 10px 0;">Appointment canceled</div>
    <div style="font-size:14px;margin:0 0 14px 0;">Your appointment has been canceled.</div>

    ${serviceName ? `<div style="font-size:14px;margin:0 0 10px 0;"><strong>Service:</strong> ${escapeHtml(serviceName)}</div>` : ""}

    <div style="font-size:14px;margin:0 0 14px 0;"><strong>When:</strong> ${escapeHtml(args.date)} ${escapeHtml(args.startTime)}–${escapeHtml(args.endTime)}</div>

    <div style="font-size:13px;color:#6b7280;">— ${escapeHtml(businessName)}</div>
  </div>`;

    return {
        subject,
        text: textLines.join("\n"),
        html,
    };
}
