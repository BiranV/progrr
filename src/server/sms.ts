export async function sendSms(args: {
    to: string;
    text: string;
}): Promise<void> {
    // Local/dev implementation: log the SMS.
    // If you wire a provider (Twilio/etc), replace this.
    if (process.env.NODE_ENV !== "production") {
        console.info(`[sms:dev] to=${args.to} text=${args.text}`);
        return;
    }

    throw Object.assign(new Error("SMS sending is not configured"), {
        status: 500,
        code: "ENV_MISSING",
    });
}
