import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";

type SmsDelivery = "twilio" | "dev_log";

async function sendSms(to: string, body: string): Promise<SmsDelivery> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid || !token || (!from && !messagingServiceSid)) {
    if (process.env.NODE_ENV === "production") {
      throw Object.assign(new Error("SMS provider not configured"), {
        status: 500,
      });
    }
    // Dev fallback: log OTP.
    console.log(`[DEV OTP] ${to}: ${body}`);
    return "dev_log";
  }

  // Lightweight Twilio REST call without adding extra dependencies.
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const form = new URLSearchParams();
  form.set("To", to);
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    form.set("From", from);
  }
  form.set("Body", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(
      new Error(`Failed to send SMS (${res.status}) ${text}`),
      {
        status: 500,
      }
    );
  }

  return "twilio";
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "")
      .replace(/\s+/g, "")
      .trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    if (!phone.startsWith("+") || !/^\+\d{6,15}$/.test(phone)) {
      return NextResponse.json(
        {
          error:
            "Phone must be in international format (E.164), e.g. +972501234567",
        },
        { status: 400 }
      );
    }

    const c = await collections();

    // Hard rule: do not create users during login.
    const client = await c.clients.findOne({ phone });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { code, hash } = generateOtp(6);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await c.otps.updateOne(
      { phone },
      {
        $set: {
          phone,
          codeHash: hash,
          expiresAt,
          attempts: 0,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const delivery = await sendSms(
      phone,
      `Your Progrr verification code is: ${code}`
    );

    return NextResponse.json({ ok: true, delivery });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
