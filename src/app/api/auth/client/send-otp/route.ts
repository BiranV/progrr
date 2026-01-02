import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;

  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === "production") {
      throw Object.assign(new Error("SMS provider not configured"), {
        status: 500,
      });
    }
    // Dev fallback: log OTP.
    console.log(`[DEV OTP] ${to}: ${body}`);
    return;
  }

  // Lightweight Twilio REST call without adding extra dependencies.
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
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
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? "").trim();

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
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

    await sendSms(phone, `Your Progrr verification code is: ${code}`);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
