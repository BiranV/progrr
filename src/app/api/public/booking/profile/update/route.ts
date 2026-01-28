import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { CUSTOMER_ACCESS_COOKIE_NAME } from "@/server/customer-access";
import { verifyCustomerAccessToken } from "@/server/jwt";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { buildOtpEmail } from "@/server/emails/auth";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const businessPublicId = String(body?.businessPublicId ?? "").trim();
    const fullName = String(body?.fullName ?? "").trim();
    const phoneRaw = String(body?.phone ?? "").trim();
    const phone = phoneRaw ? phoneRaw : "";
    const currentEmail = normalizeEmail(body?.currentEmail);
    const newEmailRaw = normalizeEmail(body?.newEmail);

    if (!businessPublicId || !isValidBusinessPublicId(businessPublicId)) {
      return NextResponse.json(
        { error: "Invalid businessPublicId" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_ACCESS_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    let claims: { customerId: string };
    try {
      const parsed = await verifyCustomerAccessToken(token);
      claims = { customerId: parsed.customerId };
    } catch {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    if (!currentEmail) {
      return NextResponse.json(
        { error: "currentEmail is required" },
        { status: 400 },
      );
    }
    if (!isValidEmail(currentEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 },
      );
    }
    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 },
      );
    }

    if (!claims.customerId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const wantsEmailChange =
      Boolean(newEmailRaw) && newEmailRaw !== currentEmail;
    if (wantsEmailChange && !isValidEmail(newEmailRaw)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 },
      );
    }

    const c = await collections();
    const business = await c.users.findOne(
      { "onboarding.business.publicId": businessPublicId } as any,
      { projection: { _id: 1 } },
    );
    if (!business?._id) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const customer = await c.customers.findOne({
      _id: new ObjectId(claims.customerId),
    } as any);
    if (!customer) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const sessionEmail = normalizeEmail((customer as any)?.email);
    if (sessionEmail && sessionEmail !== currentEmail) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (phone) {
      const existingWithPhone = await c.customers.findOne({
        businessUserId: business._id,
        phone,
      } as any);
      if (
        existingWithPhone?._id &&
        String(existingWithPhone._id) !== String(customer._id)
      ) {
        return NextResponse.json(
          { error: "Phone number is already used by another customer." },
          { status: 409 },
        );
      }
    }

    const customerUpdate: Record<string, any> = {
      fullName,
      email: currentEmail,
      businessUserId: business._id,
      updatedAt: new Date(),
    };
    if (phone) customerUpdate.phone = phone;

    await c.customers.updateOne({ _id: customer._id } as any, {
      $set: customerUpdate,
    });

    // Update all appointments with the current identity (keeps admin UI in sync).
    const appointmentUpdate: Record<string, any> = {
      "customer.fullName": fullName,
      "customer.email": currentEmail,
    };
    if (phone) appointmentUpdate["customer.phone"] = phone;

    await c.appointments.updateMany({ customerId: customer._id } as any, {
      $set: appointmentUpdate,
    });

    if (!wantsEmailChange) {
      return NextResponse.json({
        ok: true,
        customer: { fullName, phone, email: currentEmail },
      });
    }

    const newEmail = newEmailRaw;

    // Ensure new email isn't already used by another customer.
    const existingWithNewEmail = await c.customers.findOne({
      email: newEmail,
    } as any);

    if (
      existingWithNewEmail?._id &&
      String(existingWithNewEmail._id) !== String(customer._id)
    ) {
      return NextResponse.json(
        { error: "This email is already used by another customer." },
        { status: 409 },
      );
    }

    const db = await getDb();
    await checkRateLimit({
      db,
      req,
      purpose: "profile_email_change_request",
      email: newEmail,
      perIp: { windowMs: 60_000, limit: 20 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    // Create/replace OTP for the new email.
    const { code, hash } = generateOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await c.customerOtps.updateOne(
      { key: newEmail, purpose: "profile_email_change" },
      {
        $set: {
          key: newEmail,
          purpose: "profile_email_change",
          codeHash: hash,
          expiresAt,
          attempts: 0,
          createdAt: new Date(),
          sentAt: new Date(),
        },
      },
      { upsert: true },
    );

    await c.customers.updateOne({ _id: customer._id } as any, {
      $set: { pendingEmail: newEmail, pendingEmailRequestedAt: new Date() },
    });

    const emailContent = buildOtpEmail({
      subject: "Verify your new email",
      title: "Verify your new email",
      code,
      expiresMinutes: 10,
    });

    await sendEmail({
      to: newEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    return NextResponse.json({
      ok: true,
      requiresVerification: true,
      pendingEmail: newEmail,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
