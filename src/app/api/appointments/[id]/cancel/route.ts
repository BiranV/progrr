import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { sendEmail } from "@/server/email";
import { buildAppointmentCanceledEmail } from "@/server/emails/booking";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid appointment id" },
        { status: 400 }
      );
    }

    const c = await collections();

    const apptId = new ObjectId(id);
    const appt = await c.appointments.findOne({ _id: apptId });
    if (!appt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if ((appt.businessUserId as ObjectId).toHexString() !== String(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (appt.status === "CANCELLED" || appt.status === "CANCELED") {
      return NextResponse.json({ ok: true, alreadyCanceled: true });
    }

    await c.appointments.updateOne(
      { _id: apptId },
      { $set: { status: "CANCELED", cancelledAt: new Date(), cancelledBy: "BUSINESS" } }
    );

    const owner = await c.users.findOne({ _id: appt.businessUserId as ObjectId } as any);
    const onboarding = (owner as any)?.onboarding ?? {};
    const businessName = String((onboarding as any)?.business?.name ?? "").trim();

    const customerEmailRaw = String((appt as any)?.customer?.email ?? "").trim();
    const customerEmail = customerEmailRaw.toLowerCase();
    const canEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);

    let emailSent: boolean | undefined = undefined;
    let emailError: string | undefined = undefined;

    if (canEmail) {
      try {
        const content = buildAppointmentCanceledEmail({
          businessName,
          serviceName: String((appt as any)?.serviceName ?? "").trim(),
          date: String((appt as any)?.date ?? ""),
          startTime: String((appt as any)?.startTime ?? ""),
          endTime: String((appt as any)?.endTime ?? ""),
        });

        await sendEmail({
          to: customerEmail,
          subject: content.subject,
          text: content.text,
          html: content.html,
        });
        emailSent = true;
      } catch (e: any) {
        emailSent = false;
        emailError = String(e?.message || "Failed to send email");
      }
    }

    return NextResponse.json({
      ok: true,
      email: emailSent === undefined ? undefined : { sent: emailSent, error: emailError },
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
